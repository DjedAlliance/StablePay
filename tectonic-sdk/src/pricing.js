import { D, ROUNDING_SAFETY_WEI } from "./constants.js";

/**
 * Pure pricing arithmetic for Tectonic. No network access, no contract
 * instances: everything here is a function of values already read from chain,
 * which makes it directly unit-testable.
 *
 * These functions mirror Tectonic.sol exactly. The Solidity side is pinned by
 * the `SDK` tests in tectonic-local/test/Tectonic.t.sol; if one side changes,
 * the other must change with it.
 */

/** @typedef {{ fee: bigint, treasuryFee: bigint }} Fees */

/**
 * Net fraction of a payment that survives fees, scaled by D.
 *
 * Solidity: deductFees() returns value - value*fee/D - value*treasuryFee/D.
 *
 * @param {Fees} fees
 * @returns {bigint} D - fee - treasuryFee
 */
export function netFactor({ fee, treasuryFee }) {
  const net = D - toBigInt(fee) - toBigInt(treasuryFee);
  if (net <= 0n) {
    throw new Error(
      `Tectonic: fees consume the entire payment (fee + treasuryFee >= D). ` +
        `fee=${fee}, treasuryFee=${treasuryFee}`
    );
  }
  return net;
}

/**
 * How many stablecoins a given payment mints.
 *
 * Solidity: amountSC = (deductFees(msg.value) * D) / scPriceMint()
 *
 * @param {bigint|string|number} amountBC payment in wei
 * @param {bigint|string|number} scPriceMint wei per whole stablecoin
 * @param {Fees} fees
 * @returns {bigint} stablecoins in base units
 */
export function stablecoinsForPayment(amountBC, scPriceMint, fees) {
  const value = toBigInt(amountBC);
  const price = requirePositive(scPriceMint, "scPriceMint");
  const { fee, treasuryFee } = fees;

  // Reproduce the contract's two separate floor divisions rather than folding
  // them into one: the results differ by up to 1 wei, and the merchant-facing
  // guarantee depends on matching the contract exactly.
  const f = (value * toBigInt(fee)) / D;
  const fT = (value * toBigInt(treasuryFee)) / D;
  const net = value - f - fT;

  return (net * D) / price;
}

/**
 * How much basecoin must be sent so that `amountSC` stablecoins are minted.
 *
 * This is the inverse of stablecoinsForPayment, rounded up so the receiver is
 * never short. In StablePay's native-payment flow the receiver is the
 * *merchant*, so underpaying by one base unit means an invoice silently
 * settles short — always round in the merchant's favour.
 *
 * @param {bigint|string|number} amountSC stablecoins in base units
 * @param {bigint|string|number} scPriceMint wei per whole stablecoin
 * @param {Fees} fees
 * @returns {bigint} payment in wei
 */
export function requiredPaymentForStablecoins(amountSC, scPriceMint, fees) {
  const amount = toBigInt(amountSC);
  if (amount <= 0n) throw new Error("Tectonic: amountSC must be positive");
  const price = requirePositive(scPriceMint, "scPriceMint");
  const net = netFactor(fees);

  const numerator = amount * price;
  const required = ceilDiv(numerator, net);
  return required + ROUNDING_SAFETY_WEI;
}

/**
 * Basecoin returned for redeeming `amountSC` stablecoins.
 *
 * Solidity: value = amountSC * scPriceRedeem / D, then deductFees(value).
 *
 * @param {bigint|string|number} amountSC
 * @param {bigint|string|number} scPriceRedeem
 * @param {Fees} fees
 * @returns {bigint} payout in wei
 */
export function payoutForRedemption(amountSC, scPriceRedeem, fees) {
  const amount = toBigInt(amountSC);
  const price = requirePositive(scPriceRedeem, "scPriceRedeem");
  const value = (amount * price) / D;
  const f = (value * toBigInt(fees.fee)) / D;
  const fT = (value * toBigInt(fees.treasuryFee)) / D;
  return value - f - fT;
}

/**
 * Effective fee rate a payer absorbs, as a percentage string for display.
 * @param {Fees} fees
 * @returns {string} e.g. "2.00"
 */
export function totalFeePercent({ fee, treasuryFee }) {
  const total = toBigInt(fee) + toBigInt(treasuryFee);
  // Two decimal places, computed in integer arithmetic.
  const basisPoints = (total * 10000n) / D;
  return (Number(basisPoints) / 100).toFixed(2);
}

/** Ceiling division for positive bigints. */
export function ceilDiv(numerator, denominator) {
  if (denominator <= 0n) throw new Error("Tectonic: division by non-positive denominator");
  return (numerator + denominator - 1n) / denominator;
}

/**
 * Convert a human-readable decimal string to base units without floating point.
 * `toBaseUnits("1.5", 18) === 1500000000000000000n`
 *
 * Float math is unusable here: Number("0.1") + Number("0.2") already loses
 * precision, and an invoice amount must be exact.
 *
 * Amounts are always non-negative: a negative invoice amount is a caller bug,
 * so it is rejected here rather than propagating a negative bigint into the
 * pricing math (where it would only surface much later, if at all).
 *
 * @param {string|number|bigint} value
 * @param {number} decimals
 * @returns {bigint}
 */
export function toBaseUnits(value, decimals) {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error(`Tectonic: "${value}" is negative; amounts must be non-negative`);
    }
    return value;
  }
  const str = String(value).trim();
  if (str.startsWith("-")) {
    throw new Error(`Tectonic: "${value}" is negative; amounts must be non-negative`);
  }
  if (!/^\d*\.?\d*$/.test(str) || str === "" || str === ".") {
    throw new Error(`Tectonic: "${value}" is not a valid decimal amount`);
  }
  const [whole = "0", fraction = ""] = str.split(".");
  if (fraction.length > decimals) {
    throw new Error(
      `Tectonic: "${value}" has more than ${decimals} decimal places and cannot be represented exactly`
    );
  }
  const padded = fraction.padEnd(decimals, "0");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

/**
 * Convert base units to a human-readable decimal string.
 * @param {bigint|string|number} value
 * @param {number} decimals
 * @param {number} [displayDecimals] truncate the fraction for display
 * @returns {string}
 */
export function fromBaseUnits(value, decimals, displayDecimals) {
  const v = toBigInt(value);
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  let fraction = (abs % divisor).toString().padStart(decimals, "0");
  if (displayDecimals !== undefined) fraction = fraction.slice(0, displayDecimals);
  fraction = fraction.replace(/0+$/, "");
  const sign = negative ? "-" : "";
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

function toBigInt(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`Tectonic: ${value} is not an integer; pass a bigint or decimal string`);
    }
    return BigInt(value);
  }
  return BigInt(value);
}

function requirePositive(value, name) {
  const v = toBigInt(value);
  if (v <= 0n) throw new Error(`Tectonic: ${name} must be positive, got ${v}`);
  return v;
}
