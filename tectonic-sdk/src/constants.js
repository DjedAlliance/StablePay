/**
 * Tectonic fixed-point conventions.
 *
 * IMPORTANT: Tectonic scales fees and ratios by D = 1e18. Other stablecoin
 * protocols commonly use 1e24, and a fee value scaled for that convention is
 * a million times too large here — large enough to consume the entire
 * payment. netFactor() rejects any fee at or above D rather than letting a
 * mis-scaled value silently misprice every transaction.
 */

/** Fixed-point denominator used throughout Tectonic.sol. */
export const D = 10n ** 18n;

/** Decimals of the basecoin (native currency) on all supported EVM chains. */
export const BC_DECIMALS = 18;

/** Decimals of the Tectonic stablecoin. It is an OpenZeppelin ERC20 default. */
export const SC_DECIMALS = 18;

/**
 * Extra wei added to a computed mint cost to absorb integer-division flooring
 * inside the contract. One wei is economically irrelevant and guarantees the
 * receiver is never short of the invoiced amount.
 */
export const ROUNDING_SAFETY_WEI = 1n;

/**
 * Multiplier applied to an eth_estimateGas result before sending a mint.
 *
 * Tectonic's mint() may run up to numRedemptionIterations (100) triggered
 * redemptions before minting when the reserve ratio is below critical, and the
 * number of iterations depends on chain state at execution time rather than at
 * estimation time. A fixed gas limit is unsafe here: it would strand the
 * transaction out of gas exactly when the protocol is under stress.
 */
export const GAS_LIMIT_MULTIPLIER_PERCENT = 150n;

export const TRANSACTION_VALIDITY = {
  OK: "Transaction is valid.",
  WALLET_NOT_CONNECTED: "Wallet not connected",
  WRONG_NETWORK: "Wallet connected to the wrong network",
  NONNUMERIC_INPUT: "Amount has to be a number",
  NEGATIVE_INPUT: "Amount cannot be negative",
  ZERO_INPUT: "Amount cannot be zero",
  INSUFFICIENT_BC: "Insufficient balance",
  INSUFFICIENT_SC: "Insufficient StableCoin balance",
};

/**
 * Reserve-ratio health bands, derived from the contract's own thresholds.
 * Tectonic never blocks an operation on the reserve ratio — it has no
 * minimum-ratio gate — but the widget should tell a merchant what they are
 * walking into.
 */
export const RESERVE_HEALTH = {
  HEALTHY: "healthy", // ratio > safeReserveRatio: no stability fee
  FEE_ACCRUING: "fee-accruing", // critical <= ratio <= safe: holders are charged a stability fee
  CRITICAL: "critical", // ratio < critical: triggered redemptions are active
};
