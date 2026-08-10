import { test } from "node:test";
import assert from "node:assert/strict";
// Imported from the leaf modules rather than the package entry point on
// purpose: the pricing math is pure and must stay testable without viem or any
// network stack. If this import ever needs a chain client, the layering broke.
import { D } from "../src/constants.js";
import {
  netFactor,
  stablecoinsForPayment,
  requiredPaymentForStablecoins,
  payoutForRedemption,
  totalFeePercent,
  toBaseUnits,
  fromBaseUnits,
  ceilDiv,
} from "../src/pricing.js";

const FEES = { fee: 15n * 10n ** 15n, treasuryFee: 5n * 10n ** 15n }; // 1.5% + 0.5%
const PRICE = 5n * 10n ** 14n; // 0.0005 BC per stablecoin

/**
 * Reference implementation of Tectonic.mint()'s arithmetic, transcribed
 * straight from the Solidity. The round-trip property below is only meaningful
 * because this mirrors the contract's flooring behaviour exactly.
 */
function contractMint(value, price, { fee, treasuryFee }) {
  const f = (value * fee) / D;
  const fT = (value * treasuryFee) / D;
  const amountBC = value - f - fT;
  return (amountBC * D) / price;
}

test("netFactor subtracts both fees from D", () => {
  assert.equal(netFactor(FEES), D - FEES.fee - FEES.treasuryFee);
});

test("netFactor rejects fees that consume the whole payment", () => {
  assert.throws(() => netFactor({ fee: D, treasuryFee: 1n }), /consume the entire payment/);
});

test("stablecoinsForPayment matches the contract's arithmetic", () => {
  const value = 10n ** 18n;
  assert.equal(stablecoinsForPayment(value, PRICE, FEES), contractMint(value, PRICE, FEES));
});

test("requiredPaymentForStablecoins never underpays the receiver", () => {
  const amountSC = 100n * 10n ** 18n;
  const required = requiredPaymentForStablecoins(amountSC, PRICE, FEES);
  const minted = contractMint(required, PRICE, FEES);
  assert.ok(minted >= amountSC, `minted ${minted} < requested ${amountSC}`);
});

test("PROPERTY: the merchant is never short-changed, across amounts and prices", () => {
  const amounts = [1n, 7n, 1000n, 10n ** 6n, 10n ** 12n, 10n ** 18n, 12345678901234567n, 10n ** 24n];
  const prices = [1n, 3n, 10n ** 6n, 5n * 10n ** 14n, 10n ** 18n, 7n * 10n ** 19n];
  const feeSets = [
    { fee: 0n, treasuryFee: 0n },
    { fee: 15n * 10n ** 15n, treasuryFee: 5n * 10n ** 15n },
    { fee: 10n ** 17n, treasuryFee: 3n * 10n ** 16n }, // 10% + 3%
    { fee: 1n, treasuryFee: 1n }, // pathologically small
  ];

  let checked = 0;
  for (const amountSC of amounts) {
    for (const price of prices) {
      for (const fees of feeSets) {
        const required = requiredPaymentForStablecoins(amountSC, price, fees);
        const minted = contractMint(required, price, fees);
        assert.ok(
          minted >= amountSC,
          `short-changed: amountSC=${amountSC} price=${price} fees=${JSON.stringify(
            fees,
            (_, v) => (typeof v === "bigint" ? v.toString() : v)
          )} -> minted=${minted}`
        );
        checked++;
      }
    }
  }
  assert.ok(checked > 100, `expected a wide sweep, only checked ${checked}`);
});

test("PROPERTY: rounding overpayment stays negligible", () => {
  const amounts = [10n ** 18n, 100n * 10n ** 18n, 12345n * 10n ** 15n];
  for (const amountSC of amounts) {
    const required = requiredPaymentForStablecoins(amountSC, PRICE, FEES);
    const minted = contractMint(required, PRICE, FEES);
    const excess = minted - amountSC;
    // Well under one part per billion of the invoice.
    assert.ok(excess <= amountSC / 10n ** 9n + 1n, `excess ${excess} too large for ${amountSC}`);
  }
});

test("requiredPaymentForStablecoins rejects non-positive amounts", () => {
  assert.throws(() => requiredPaymentForStablecoins(0n, PRICE, FEES), /must be positive/);
});

test("quotes reject a zero oracle price rather than dividing by zero", () => {
  assert.throws(() => requiredPaymentForStablecoins(10n, 0n, FEES), /scPriceMint must be positive/);
  assert.throws(() => stablecoinsForPayment(10n, 0n, FEES), /scPriceMint must be positive/);
});

test("payoutForRedemption applies both fees", () => {
  const amountSC = 100n * 10n ** 18n;
  const gross = (amountSC * PRICE) / D;
  const payout = payoutForRedemption(amountSC, PRICE, FEES);
  assert.ok(payout < gross);
  assert.equal(payout, gross - (gross * FEES.fee) / D - (gross * FEES.treasuryFee) / D);
});

test("totalFeePercent formats the combined rate", () => {
  assert.equal(totalFeePercent(FEES), "2.00");
  assert.equal(totalFeePercent({ fee: 0n, treasuryFee: 0n }), "0.00");
  assert.equal(totalFeePercent({ fee: 25n * 10n ** 14n, treasuryFee: 0n }), "0.25");
});

test("toBaseUnits parses decimals exactly, without floating point", () => {
  assert.equal(toBaseUnits("1", 18), 10n ** 18n);
  assert.equal(toBaseUnits("1.5", 18), 15n * 10n ** 17n);
  assert.equal(toBaseUnits("0.1", 18), 10n ** 17n);
  assert.equal(toBaseUnits("10.000001", 6), 10000001n);
  assert.equal(toBaseUnits(42, 2), 4200n);
  // The classic float trap: 0.1 + 0.2 !== 0.3 in IEEE 754.
  assert.equal(toBaseUnits("0.1", 18) + toBaseUnits("0.2", 18), toBaseUnits("0.3", 18));
});

test("toBaseUnits rejects precision loss and malformed input", () => {
  assert.throws(() => toBaseUnits("1.0000001", 6), /more than 6 decimal places/);
  assert.throws(() => toBaseUnits("abc", 18), /not a valid decimal amount/);
  assert.throws(() => toBaseUnits("", 18), /not a valid decimal amount/);
});

test("fromBaseUnits round-trips toBaseUnits", () => {
  for (const value of ["1", "1.5", "0.000001", "123456.789"]) {
    assert.equal(fromBaseUnits(toBaseUnits(value, 18), 18), value);
  }
  assert.equal(fromBaseUnits(10n ** 18n, 18), "1");
  assert.equal(fromBaseUnits(0n, 18), "0");
});

test("ceilDiv rounds up only when there is a remainder", () => {
  assert.equal(ceilDiv(10n, 5n), 2n);
  assert.equal(ceilDiv(11n, 5n), 3n);
  assert.equal(ceilDiv(0n, 5n), 0n);
  assert.throws(() => ceilDiv(1n, 0n), /non-positive denominator/);
});

test("REGRESSION: a fee scaled for 1e24 fails loudly instead of mispricing", () => {
  // The likeliest porting mistake is carrying over a 1e24 fixed-point
  // convention. A 1.5% fee expressed at 1e24 is 15e21, which exceeds
  // Tectonic's D=1e18, so netFactor rejects it outright. Failing loudly here
  // is the point: a silently wrong fee scale would misprice every invoice.
  assert.equal(D, 10n ** 18n);
  const misScaledFee = 15n * 10n ** 21n; // 1.5% at 1e24 scaling
  assert.throws(
    () => requiredPaymentForStablecoins(10n ** 18n, PRICE, { fee: misScaledFee, treasuryFee: 0n }),
    /consume the entire payment/
  );
  // The correctly scaled fee prices normally.
  assert.ok(requiredPaymentForStablecoins(10n ** 18n, PRICE, FEES) > 0n);
});
