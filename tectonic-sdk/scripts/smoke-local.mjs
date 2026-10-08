/**
 * End-to-end smoke test against a local Tectonic deployment.
 *
 * This is the check the stubbed unit tests cannot make: it drives the real
 * contract on a real chain and asserts that the SDK's off-chain pricing agrees
 * with the on-chain result. Specifically, it proves the property StablePay's
 * correctness rests on — a merchant invoiced for N stablecoins receives at
 * least N stablecoins.
 *
 * Prerequisites:
 *   1. anvil running on http://127.0.0.1:8545
 *   2. tectonic-local/script/DeployLocal.s.sol broadcast against it
 *
 * Usage (from StablePay/tectonic-sdk):
 *   node scripts/smoke-local.mjs
 *   node scripts/smoke-local.mjs --amount 250
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createWalletClient, createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { TectonicClient } from "../src/tectonic.js";
import { fromBaseUnits } from "../src/pricing.js";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";

// anvil's deterministic accounts #0 and #1.
const PAYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const MERCHANT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const amountArgIndex = process.argv.indexOf("--amount");
const INVOICE = amountArgIndex !== -1 ? process.argv[amountArgIndex + 1] : "100";

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(here, "../../tectonic-local/deployments/local.json");

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

function loadManifest() {
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    console.error(
      `Could not read ${manifestPath}\n\n` +
        `Deploy first:\n` +
        `  cd ../tectonic-local\n` +
        `  forge script script/DeployLocal.s.sol --rpc-url ${RPC} --broadcast \\\n` +
        `    --private-key ${PAYER_KEY}\n`
    );
    process.exit(1);
  }
}

async function main() {
  const manifest = loadManifest();
  console.log(`Tectonic at ${manifest.tectonic} on ${RPC}\n`);

  const account = privateKeyToAccount(PAYER_KEY);
  const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) });
  const walletClient = createWalletClient({ account, chain: foundry, transport: http(RPC) });

  const client = new TectonicClient({ address: manifest.tectonic, publicClient });

  // --- 1. connect and read parameters -------------------------------------
  console.log("Parameters");
  const params = await client.init();
  check("init() read the contract", params.decimals === 18, `decimals=${params.decimals}`);
  check("symbol is readable", typeof params.symbol === "string", `symbol=${params.symbol}`);
  check(
    "fees match the manifest",
    params.fee === BigInt(manifest.fee) && params.treasuryFee === BigInt(manifest.treasuryFee),
    `fee=${params.fee} treasuryFee=${params.treasuryFee}`
  );
  check(
    "equity coin address matches the manifest",
    params.equityCoin.toLowerCase() === manifest.equityCoin.toLowerCase()
  );

  // --- 2. state and health -------------------------------------------------
  console.log("\nState");
  const state = await client.getState();
  console.log(`  reserve=${formatEther(state.reserve)} liabilities=${formatEther(state.liabilities)}`);
  check("reserve is non-empty", state.reserve > 0n);
  check("liabilities never exceed the reserve", state.liabilities <= state.reserve);

  const health = await client.getReserveHealth();
  check("reserve health is classified", !!health.health, `health=${health.health}`);

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

  // --- 4. the real thing: mint to the merchant -----------------------------
  console.log("\nMint");
  const before = await client.getBalance(MERCHANT);

  const tx = await client.buildMintTx({
    payer: account.address,
    receiver: MERCHANT,
    value: quote.requiredBC,
  });
  check("gas was estimated, not hard-coded", typeof tx.gas === "bigint", `gas=${tx.gas}`);

  const hash = await walletClient.sendTransaction({
    to: tx.to,
    value: tx.value,
    data: tx.data,
    gas: tx.gas,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  check("transaction succeeded", receipt.status === "success", `gasUsed=${receipt.gasUsed}`);

  const after = await client.getBalance(MERCHANT);
  const received = after.raw - before.raw;
  const invoiced = quote.amountSC;

  console.log(`  invoiced ${fromBaseUnits(invoiced, 18, 6)}, received ${fromBaseUnits(received, 18, 6)}`);

  // This is the assertion the whole integration depends on.
  check("MERCHANT WAS NOT SHORT-CHANGED", received >= invoiced, `surplus=${received - invoiced} base units`);
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
