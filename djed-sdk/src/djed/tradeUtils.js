import {
  TRANSACTION_USD_LIMIT,
  BC_DECIMALS,
  SCALING_DECIMALS,
  FEE_UI,
  CONFIRMATION_WAIT_PERIOD,
} from "../constants";
import {
  decimalUnscaling,
  decimalScaling,
  scaledUnscaledPromise,
  web3Promise,
} from "../helpers";

export const scalingFactor = decimalUnscaling("1", SCALING_DECIMALS);

export const FEE_UI_UNSCALED = decimalUnscaling(
  FEE_UI.toString(),
  SCALING_DECIMALS
);

export const tradeDataPriceCore = (djed, method, decimals, amountScaled) => {
  const amountUnscaled = decimalUnscaling(amountScaled, decimals);
  return scaledUnscaledPromise(web3Promise(djed, method, 0), BC_DECIMALS).then(
    (price) => {
      const [priceScaled, priceUnscaled] = price;
      const totalUnscaled = convertToBC(
        amountUnscaled,
        priceUnscaled,
        decimals
      ).toString();

      const totalScaled = decimalScaling(totalUnscaled, BC_DECIMALS);

      return {
        amountScaled,
        amountUnscaled,
        totalScaled,
        totalUnscaled,
        priceUnscaled,
        priceScaled,
      };
    }
  );
};

/**
 * Function that converts coin amount to BC
 * @param {*} amount unscaled coin amount to be converted to BC
 * @param {*} price unscaled coin price
 * @param {*} decimals coin decimals
 * @returns unscaled BC amount
 */
export const convertToBC = (amount, price, decimals) => {
  const decimalScalingFactor = BigInt(Math.pow(10, decimals));
  return (BigInt(amount) * BigInt(price)) / decimalScalingFactor;
};

/**
 * Calculate if the transaction will reach the maximum reserve ratio
 * @param scPrice - Unscaled stablecoin price
 * @param reserveBc - Unscaled reserve of base coin with appended potential transaction amount.
 * Example: If user wants to buy 1RC, the reserveBc param will be calculated as sum of current reserve of BC and desired RC amount converted in BC
 * @param totalScSupply - Unscaled total stablecoin supply
 * @param reserveRatioMax - Unscaled maximum reserve ratio
 * @param scDecimalScalingFactor - If stablecoin has 6 decimals, scDecimalScalingFactor will be calculated as 10^6
 * @param thresholdSupplySC - Unscaled threshold SC supply
 * @returns
 */
export const calculateIsRatioBelowMax = ({
  scPrice,
  reserveBc,
  totalScSupply,
  reserveRatioMax,
  scDecimalScalingFactor,
  thresholdSupplySC,
}) => {
  const scalingFactorBigInt = BigInt(scalingFactor);

  return (
    BigInt(reserveBc) * scalingFactorBigInt * BigInt(scDecimalScalingFactor) <
      BigInt(totalScSupply) * BigInt(scPrice) * BigInt(reserveRatioMax) ||
    BigInt(totalScSupply) <= BigInt(thresholdSupplySC)
  );
};

/**
 * Calculate if the transaction will reach the minimum reserve ratio
 * @param scPrice - Unscaled stablecoin price
 * @param reserveBc - Unscaled reserve of base coin with calculated potential transaction amount.
 * Example: If user wants to buy 1SC, the reserveBc param will be calculated as sum of current reserve of BC and desired SC amount converted in BC
 * @param totalScSupply - Unscaled total stablecoin supply
 * @param reserveRatioMin - Unscaled minimum reserve ratio
 * @param scDecimalScalingFactor - If stablecoin has 6 decimals, scDecimalScalingFactor will be calculated as 10^6
 * @returns
 */
export const calculateIsRatioAboveMin = ({
  scPrice,
  reserveBc,
  totalScSupply,
  reserveRatioMin,
  scDecimalScalingFactor,
}) => {
  const scalingFactorBigInt = BigInt(scalingFactor);

  return (
    BigInt(reserveBc) * scalingFactorBigInt * BigInt(scDecimalScalingFactor) >
    BigInt(totalScSupply) * BigInt(scPrice) * BigInt(reserveRatioMin)
  );
};

/**
 *
 * @param {*} amountUSD
 * @param {*} totalSCSupply
 * @param {*} thresholdSCSupply
 * @returns
 */
export const isTxLimitReached = (amountUSD, totalSCSupply, thresholdSCSupply) =>
  amountUSD > TRANSACTION_USD_LIMIT &&
  BigInt(totalSCSupply) >= BigInt(thresholdSCSupply);

export const promiseTx = (isWalletConnected, tx, Singer) => {
  if (!isWalletConnected) {
    return Promise.reject(new Error("Metamask not connected!"));
  }
  if (!signer) {
    return Promise.reject(new Error("Couldn't get Signer"));
  }
  return signer.sendTransaction(tx);
};

export const verifyTx = (web3, hash) => {
  const start = Date.now();
  const timeout = 60_000;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const receipt = await web3.eth.getTransactionReceipt(hash);
        if (receipt) {
          return resolve(receipt.status);
        }
        if (Date.now() - start >= timeout) {
          return reject(new Error("Transaction confirmation timeout"));
        }
        setTimeout(poll, CONFIRMATION_WAIT_PERIOD);
      } catch (e) {
        reject(e);
      }
    };
    poll();
  });
};

/**
 * Function that deducts all platform fees from the BC amount
 * @param {*} value The amount of BC from which fees should be deducted
 * @param {*} fee The platform fee
 * @param {*} treasuryFee The treasury fee
 * @returns BC value with all fees calculated
 */
export const calculateTxFees = (value, fee, treasuryFee, feeUI) => {
  const f = (BigInt(value) * BigInt(fee)) / BigInt(scalingFactor);
  const f_ui =
    (BigInt(value) * BigInt(feeUI || FEE_UI_UNSCALED)) / BigInt(scalingFactor);
  const f_t = (BigInt(value) * BigInt(treasuryFee)) / BigInt(scalingFactor);

  return { f, f_ui, f_t };
};

/**
 * Function that deducts all platform fees from the BC amount
 * @param {*} value The amount of BC from which fees should be deducted
 * @param {*} fee The platform fee
 * @param {*} treasuryFee The treasury fee
 * @returns BC value with all fees calculated
 */
export const deductFees = (value, fee, treasuryFee) => {
  const { f, f_ui, f_t } = calculateTxFees(value, fee, treasuryFee);
  return BigInt(value) - f - f_ui - f_t;
};

/**
 * Function that appends all platform fees to the BC amount
 * @param {*} amountBC The unscaled amount of BC (e.g. for 1BC, value should be 1 * 10^BC_DECIMALS)
 * @param {*} treasuryFee Treasury fee unscaled (e.g. If the fee is 1%, than 1/100 * scalingFactor)
 * @param {*} fee Fee unscaled (e.g. If the fee is 1%, than 1/100 * scalingFactor)
 * @param {*} fee_UI UI fee unscaled (e.g. If the fee is 1%, than 1/100 * scalingFactor)
 * @returns Unscaled BC amount with calculated fees
 */
export const appendFees = (amountBC, treasuryFee, fee, fee_UI) => {
  const totalFees = BigInt(treasuryFee) + BigInt(fee) + BigInt(fee_UI);
  const substractedFees = BigInt(scalingFactor) - totalFees;
  const appendedFeesAmount =
    (BigInt(amountBC) * BigInt(scalingFactor)) / substractedFees;

  return appendedFeesAmount.toString();
};

/**
 * Function that returns treasury and platform fees
 * @param {*} djed Djed contract
 * @returns Treasury and platform fee
 */
export const getFees = async (djed) => {
  try {
    const [treasuryFee, fee] = await Promise.all([
      web3Promise(djed, "treasuryFee"),
      web3Promise(djed, "fee"),
    ]);
    return {
      treasuryFee,
      fee,
    };
  } catch (error) {
    console.log("error", error);
  }
};
