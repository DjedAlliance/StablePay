/**
 * End-to-end smoke test against the Tectonic deployment on Ethereum Sepolia.
 *
 * This is the check the stubbed unit tests cannot make: it drives the real
 * contract on a real chain and asserts that the SDK's off-chain pricing agrees
 * with the on-chain result. Specifically, it proves the property StablePay's
 * correctness rests on — a merchant invoiced for N stablecoins receives at
 * least N stablecoins.
 *
 * By default it only reads from the chain. Pass --mint with PRIVATE_KEY set to
 * a funded Sepolia account to also send a real mint to MERCHANT (defaults to
 * the payer itself).
 *
 * Usage (from StablePay/tectonic-sdk):
 *   node scripts/smoke-sepolia.mjs
 *   node scripts/smoke-sepolia.mjs --amount 2
 *   PRIVATE_KEY=0x... node scripts/smoke-sepolia.mjs --mint
 */

import { createWalletClient, createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { TectonicClient } from "../src/tectonic.js";
import { fromBaseUnits, stablecoinsForPayment } from "../src/pricing.js";

const RPC = process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

const DEPLOYMENT = {
  tectonic: "0xea262fB18992ddE398a5b6fa7A4F879FfB262aC1",
  equityCoin: "0x22B2f0CAf598B9E5FCf888fB89eD50c2F4735F1a",
  oracle: "0x4f007748666F2b941AA014E5a2a41841e681A32b",
  fee: 10n ** 15n,
  superCriticalReserveRatio: 105n * 10n ** 16n,
  criticalReserveRatio: 110n * 10n ** 16n,
  safeReserveRatio: 150n * 10n ** 16n,
};

const amountArgIndex = process.argv.indexOf("--amount");
const INVOICE = amountArgIndex !== -1 ? process.argv[amountArgIndex + 1] : "1";
const MINT = process.argv.includes("--mint");

let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok    ${label}${detail ? "  " + detail : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`);
  }
}

const sameAddress = (a, b) => a.toLowerCase() === b.toLowerCase();

async function main() {
  console.log(`Tectonic at ${DEPLOYMENT.tectonic} on Sepolia via ${RPC}\n`);

  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    console.error(`RPC is on chain ${chainId}, expected Sepolia (${sepolia.id})`);
    process.exit(1);
  }

  const client = new TectonicClient({ address: DEPLOYMENT.tectonic, publicClient });

  // --- 1. connect and read parameters -------------------------------------
  console.log("Parameters");
  const params = await client.init();
  check("init() read the contract", params.decimals === 18, `decimals=${params.decimals}`);
  check("symbol is readable", typeof params.symbol === "string", `symbol=${params.symbol}`);
  check("fee matches the deployment", params.fee === DEPLOYMENT.fee, `fee=${params.fee}`);
  check("devFee is readable", typeof params.devFee === "bigint", `devFee=${params.devFee}`);
  check(
    "reserve ratios match the deployment",
    params.superCriticalReserveRatio === DEPLOYMENT.superCriticalReserveRatio &&
      params.criticalReserveRatio === DEPLOYMENT.criticalReserveRatio &&
      params.safeReserveRatio === DEPLOYMENT.safeReserveRatio
  );
  check("equity coin address matches the deployment", sameAddress(params.equityCoin, DEPLOYMENT.equityCoin));
  check("oracle address matches the deployment", sameAddress(params.oracle, DEPLOYMENT.oracle));

  // --- 2. state and health -------------------------------------------------
  console.log("\nState");
  const state = await client.getState();
  console.log(`  reserve=${formatEther(state.reserve)} liabilities=${formatEther(state.liabilities)}`);
  check("reserve is non-empty", state.reserve > 0n);
  check("liabilities never exceed the reserve", state.liabilities <= state.reserve);

  const health = await client.getReserveHealth();
  check("reserve health is classified", !!health.health, `health=${health.health} ratio=${health.ratio}`);

  // --- 3. quote ------------------------------------------------------------
  console.log("\nQuote");
  const quote = await client.quoteMint(INVOICE);
  console.log(`  ${INVOICE} ${params.symbol} costs ${quote.requiredBCFormatted} ETH`);
  check("quote is positive", quote.requiredBC > 0n);
  check(
    "quote is in a sane range for the configured price",
    quote.requiredBC > (quote.amountSC * quote.scPriceMint) / 10n ** 18n,
    "(strictly above the fee-free cost)"
  );
  const minted = stablecoinsForPayment(quote.requiredBC, quote.scPriceMint, client.fees);
  check("quoted payment mints at least the invoice", minted >= quote.amountSC, `surplus=${minted - quote.amountSC} base units`);

  if (!MINT) {
    console.log(`\n${pass} passed, ${fail} failed (read-only; pass --mint with PRIVATE_KEY to send a mint)`);
    process.exit(fail === 0 ? 0 : 1);
  }

  if (!process.env.PRIVATE_KEY) {
    console.error("\n--mint needs PRIVATE_KEY set to a funded Sepolia account");
    process.exit(1);
  }

  // --- 4. the real thing: mint to the merchant -----------------------------
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
  const merchant = process.env.MERCHANT ?? account.address;

  console.log(`\nMint (payer ${account.address}, merchant ${merchant})`);
  const before = await client.getBalance(merchant);

  const tx = await client.buildMintTx({
    payer: account.address,
    receiver: merchant,
    value: quote.requiredBC,
  });
  check("gas was estimated, not hard-coded", typeof tx.gas === "bigint", `gas=${tx.gas}`);

  const hash = await walletClient.sendTransaction({
    to: tx.to,
    value: tx.value,
    data: tx.data,
    gas: tx.gas,
  });
  console.log(`  tx https://sepolia.etherscan.io/tx/${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  check("transaction succeeded", receipt.status === "success", `gasUsed=${receipt.gasUsed}`);

  const after = await client.getBalance(merchant);
  const received = after.raw - before.raw;
  const invoiced = quote.amountSC;

  console.log(`  invoiced ${fromBaseUnits(invoiced, 18, 6)}, received ${fromBaseUnits(received, 18, 6)}`);

  // This is the assertion the whole integration depends on.
  check("MERCHANT WAS NOT SHORT-CHANGED", received >= invoiced, `surplus=${received - invoiced} base units`);
  const verified = client.verifyMint({ receipt, receiver: merchant, expectedSC: invoiced });
  check("Minted event covers the invoice", verified.ok, `minted=${fromBaseUnits(verified.minted, 18, 6)}`);
  check(
    "overpayment is dust",
    received - invoiced <= invoiced / 10n ** 9n + 1n,
    "(within one part per billion)"
  );

  // --- 5. merchant-facing balance -----------------------------------------
  console.log("\nMerchant balance");
  check(
    "effective balance is readable and <= raw",
    after.effective <= after.raw,
    `raw=${fromBaseUnits(after.raw, 18, 4)} effective=${fromBaseUnits(after.effective, 18, 4)}`
  );

  const warningsHealth = await client.getReserveHealth();
  console.log(`  reserve health after the mint: ${warningsHealth.health} (ratio=${warningsHealth.ratio})`);

  // --- summary -------------------------------------------------------------
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nSmoke test threw:\n", error);
  process.exit(1);
});
