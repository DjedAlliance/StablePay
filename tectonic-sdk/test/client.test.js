import { test } from "node:test";
import assert from "node:assert/strict";
import { TectonicClient } from "../src/tectonic.js";
import { RESERVE_HEALTH } from "../src/constants.js";

const D = 10n ** 18n;
const ADDRESS = "0x1111111111111111111111111111111111111111";
const MERCHANT = "0x2222222222222222222222222222222222222222";
const PAYER = "0x3333333333333333333333333333333333333333";

/**
 * Minimal stand-in for a viem public client. Only the two methods the
 * TectonicClient uses are implemented, which keeps these tests free of a
 * network, a node, and viem's transport stack.
 */
function stubClient(overrides = {}) {
  const state = {
    fee: 15n * 10n ** 15n,
    treasuryFee: 5n * 10n ** 15n,
    decimals: 18,
    criticalReserveRatio: 12n * 10n ** 17n,
    safeReserveRatio: 15n * 10n ** 17n,
    equityCoin: "0x4444444444444444444444444444444444444444",
    oracle: "0x5555555555555555555555555555555555555555",
    symbol: "SC",
    scPriceMint: 5n * 10n ** 14n,
    scPriceRedeem: 5n * 10n ** 14n,
    ratio: 3n * D,
    stabilityFee: 0n,
    balanceOf: 1000n * D,
    balanceOfAfterStabilityFee: 1000n * D,
    R: 100n * D,
    L: 30n * D,
    E: 70n * D,
    totalSupply: 60000n * D,
    ...overrides,
  };

  return {
    state,
    calls: [],
    async readContract({ functionName }) {
      this.calls.push(functionName);
      if (!(functionName in state)) {
        throw new Error(`stub: unexpected read ${functionName}`);
      }
      return state[functionName];
    },
    async estimateGas() {
      return 200000n;
    },
  };
}

function makeClient(overrides) {
  const publicClient = stubClient(overrides);
  const client = new TectonicClient({ address: ADDRESS, publicClient });
  return { client, publicClient };
}

test("constructor rejects a missing address", () => {
  assert.throws(
    () => new TectonicClient({ rpcUrl: "http://localhost:8545" }),
    /contract address is required/
  );
});

test("constructor rejects having neither a client nor an rpcUrl", () => {
  assert.throws(() => new TectonicClient({ address: ADDRESS }), /publicClient or rpcUrl/);
});

test("methods refuse to run before init()", async () => {
  const { client } = makeClient();
  await assert.rejects(() => client.quoteMint("10"), /call init\(\) before/);
});

test("init caches the immutable parameters", async () => {
  const { client, publicClient } = makeClient();
  const params = await client.init();

  assert.equal(params.fee, 15n * 10n ** 15n);
  assert.equal(params.decimals, 18);
  assert.equal(params.symbol, "SC");

  const callsAfterInit = publicClient.calls.length;
  await client.quoteMint("10");
  // The quote should read the price but must not re-read the fees.
  assert.ok(!publicClient.calls.slice(callsAfterInit).includes("fee"), "fees were re-read");
});

test("init produces an actionable error when the address is not a Tectonic contract", async () => {
  const publicClient = {
    async readContract() {
      throw new Error("execution reverted");
    },
  };
  const client = new TectonicClient({ address: ADDRESS, publicClient });
  await assert.rejects(() => client.init(), /not a Tectonic contract/);
});

test("quoteMint returns the exact wei cost plus a formatted display string", async () => {
  const { client } = makeClient();
  await client.init();
  const quote = await client.quoteMint("100");

  assert.equal(typeof quote.requiredBC, "bigint");
  assert.equal(quote.amountSC, 100n * D);
  assert.ok(quote.requiredBC > 0n);
  assert.equal(typeof quote.requiredBCFormatted, "string");
  // 100 SC at 0.0005 BC each is 0.05 BC before ~2% of fees.
  assert.ok(quote.requiredBC > 5n * 10n ** 16n, "cost exceeds the fee-free amount");
  assert.ok(quote.requiredBC < 6n * 10n ** 16n, "cost is not wildly inflated");
});

test("quoteMint and quotePayment are mutually consistent", async () => {
  const { client } = makeClient();
  await client.init();

  const quote = await client.quoteMint("100");
  const inverse = await client.quotePayment(quote.requiredBC);
  assert.ok(inverse.amountSC >= 100n * D, "round trip never loses the merchant money");
});

test("buildMintTx targets the contract and encodes the receiver", async () => {
  const { client } = makeClient();
  await client.init();
  const quote = await client.quoteMint("100");

  const tx = await client.buildMintTx({
    payer: PAYER,
    receiver: MERCHANT,
    value: quote.requiredBC,
  });

  assert.equal(tx.to, ADDRESS);
  assert.equal(tx.from, PAYER);
  assert.equal(tx.value, quote.requiredBC);
  assert.ok(tx.data.startsWith("0x"));
  // The merchant address must appear in the calldata, not the payer's.
  assert.ok(tx.data.toLowerCase().includes(MERCHANT.slice(2).toLowerCase()), "receiver encoded");
  assert.ok(!tx.data.toLowerCase().includes(PAYER.slice(2).toLowerCase()), "payer not encoded");
  // Gas is estimated with headroom rather than hard-coded.
  assert.equal(tx.gas, (200000n * 150n) / 100n);
});

test("buildMintTx rejects a non-bigint value", async () => {
  const { client } = makeClient();
  await client.init();
  await assert.rejects(
    () => client.buildMintTx({ payer: PAYER, receiver: MERCHANT, value: 1000 }),
    /must be a positive bigint/
  );
});

test("buildMintTx survives a failed gas estimate", async () => {
  const publicClient = stubClient();
  publicClient.estimateGas = async () => {
    throw new Error("insufficient funds for gas");
  };
  const client = new TectonicClient({ address: ADDRESS, publicClient });
  await client.init();

  const tx = await client.buildMintTx({ payer: PAYER, receiver: MERCHANT, value: 10n ** 15n });
  assert.equal(tx.gas, undefined, "falls back to wallet estimation instead of throwing");
  assert.equal(tx.to, ADDRESS);
});

test("buildTransferTx targets the protocol contract, which is the token", async () => {
  const { client } = makeClient();
  await client.init();
  const tx = client.buildTransferTx({ from: PAYER, to: MERCHANT, amount: 5n * D });

  assert.equal(tx.to, ADDRESS, "Tectonic is its own ERC-20");
  assert.equal(tx.value, 0n);
});

test("reserve health is classified against the contract's own thresholds", async () => {
  const healthy = makeClient({ ratio: 3n * D });
  await healthy.client.init();
  assert.equal((await healthy.client.getReserveHealth()).health, RESERVE_HEALTH.HEALTHY);

  const accruing = makeClient({ ratio: 13n * 10n ** 17n, stabilityFee: 2n * 10n ** 14n });
  await accruing.client.init();
  assert.equal((await accruing.client.getReserveHealth()).health, RESERVE_HEALTH.FEE_ACCRUING);

  const critical = makeClient({ ratio: 11n * 10n ** 17n });
  await critical.client.init();
  assert.equal((await critical.client.getReserveHealth()).health, RESERVE_HEALTH.CRITICAL);
});

test("getBalance exposes both the raw and the fee-adjusted balance", async () => {
  const { client } = makeClient({
    balanceOf: 1000n * D,
    balanceOfAfterStabilityFee: 990n * D,
  });
  await client.init();
  const balance = await client.getBalance(MERCHANT);

  assert.equal(balance.raw, 1000n * D);
  assert.equal(balance.effective, 990n * D);
  assert.ok(balance.effective < balance.raw, "stability fee reduces the effective balance");
});
