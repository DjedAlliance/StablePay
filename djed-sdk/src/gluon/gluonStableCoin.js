import { BC_DECIMALS, TRANSACTION_VALIDITY } from "../constants";
import { decimalScaling, buildTx } from "../helpers";
import {
  tradeDataPriceCore,
  getFees,
  appendFees,
  convertToBC,
  deductFees,
  FEE_UI_UNSCALED,
} from "./tradeUtils";

/**
 * Function that calculates fees and how much BC (totalBCAmount) user should pay to receive desired amount of stable coin
 * @param {*} djed DjedContract
 * @param {*} scDecimals Stable coin decimals
 * @param {*} amountScaled Stable coin amount that user wants to buy
 * @returns
 */
export const tradeDataPriceBuySc = async (djed, scDecimals, amountScaled) => {
  try {
    const data = await tradeDataPriceCore(
      djed,
      "protonPriceInBase",
      scDecimals,
      amountScaled
    );
    const { fissionFee } = await getFees(djed);
    const totalBCUnscaled = appendFees(
      data.totalUnscaled,
      fissionFee,
      FEE_UI_UNSCALED
    );

    return {
      ...data,
      totalBCScaled: decimalScaling(totalBCUnscaled, BC_DECIMALS),
      totalBCUnscaled,
    };
  } catch (error) {
    console.error("tradeDataPriceBuySc error", error);
    throw error;
  }
};

/**
 * Function that calculates fees and how much BC (totalBCAmount) user will receive if he sells desired amount of stable coin
 * @param {*} djed DjedContract
 * @param {*} scDecimals Stable coin decimals
 * @param {*} amountScaled Stable coin amount that user wants to sell
 * @returns
 */
export const tradeDataPriceSellSc = async (djed, scDecimals, amountScaled) => {
  try {
    const data = await tradeDataPriceCore(
      djed,
      "protonPriceInBase",
      scDecimals,
      amountScaled
    );
    const { fusionFee } = await getFees(djed);
    const value = convertToBC(
      data.amountUnscaled,
      data.priceUnscaled,
      scDecimals
    ).toString();

    const totalBCAmount = deductFees(value, fusionFee);

    return {
      ...data,
      totalBCScaled: decimalScaling(totalBCAmount.toString(), BC_DECIMALS),
    };
  } catch (error) {
    console.error("tradeDataPriceSellSc error", error);
    throw error;
  }
};

// Function to allow User 1 (payer) to pay and User 2 (receiver) to receive stablecoins
export const buyScTx = (djed, payer, receiver, value, DJED_ADDRESS) => {
  // `receiver` will get the stablecoins
  // fission(amountIn, to, updateData)
  const data = djed.methods.fission(value, receiver, []).encodeABI();
  
  // `payer` is sending the funds
  return buildTx(payer, DJED_ADDRESS, value, data);
};

export const sellScTx = (djed, account, amount, DJED_ADDRESS) => {
  // fusion(m, to)
  // m is likely the amount of Proton to burn? Or amount of Base to receive?
  // Assuming m is amount of Proton to burn based on typical burn patterns.
  const data = djed.methods
    .fusion(amount, account)
    .encodeABI();
  return buildTx(account, DJED_ADDRESS, 0, data);
};

/**
 * This function should calculate the future stable coin price that we can expect after some transaction.
 * @param {string} amountBC The unscaled amount of BC (e.g. for 1BC, value should be 1 * 10^BC_DECIMALS)
 * @param {string} amountSC The unscaled amount of StableCoin (e.g. for 1SC, value should be 1 * 10^SC_DECIMALS)
 * @param djedContract - Instance of Djed contract
 * @param stableCoinContract - Instance of Stablecoin contract
 * @param oracleContract - Instance of Oracle contract
 * @param scDecimalScalingFactor - If stablecoin has 6 decimals, scDecimalScalingFactor will be calculated as 10^6
 * @returns future stablecoin price
 */
export const calculateFutureScPrice = async ({
  amountBC,
  amountSC,
  djedContract,
  oracleContract,
  stableCoinContract,
  scDecimalScalingFactor,
}) => {
  throw new Error("calculateFutureScPrice not implemented for Gluon");
};
