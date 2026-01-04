import { BC_DECIMALS, TRANSACTION_VALIDITY } from "../constants";
import { decimalScaling, buildTx } from "../helpers";
import {
  getFees,
  appendFees,
  convertToBC,
  deductFees,
  FEE_UI_UNSCALED,
  tradeDataPriceCore,
} from "./tradeUtils";

/**
 * Function that calculates fees and how much BC (totalBCAmount) user should pay to receive desired amount of reserve coin
 * @param {*} djed DjedContract
 * @param {*} rcDecimals Reserve coin decimals
 * @param {*} amountScaled Reserve coin amount that user wants to buy
 * @returns
 */
export const tradeDataPriceBuyRc = async (djed, rcDecimals, amountScaled) => {
  try {
    const data = await tradeDataPriceCore(
      djed,
      "neutronPriceInBase",
      rcDecimals,
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
    console.log("error", error);
  }
};

export const tradeDataPriceSellRc = async (djed, rcDecimals, amountScaled) => {
  try {
    const data = await tradeDataPriceCore(
      djed,
      "neutronPriceInBase",
      rcDecimals,
      amountScaled
    );

    const { fusionFee } = await getFees(djed);
    const value = convertToBC(
      data.amountUnscaled,
      data.priceUnscaled,
      rcDecimals
    ).toString();

    const totalBCAmount = deductFees(value, fusionFee);

    return {
      ...data,
      totalBCScaled: decimalScaling(totalBCAmount.toString(), BC_DECIMALS),
      totalBCUnscaled: totalBCAmount.toString(),
    };
  } catch (error) {
    console.log("error", error);
  }
};

export const buyRcTx = (djed, account, value, UI, DJED_ADDRESS) => {
  // Assuming fission also handles RC buying or there's a specific way.
  // If fission splits, this might be tricky.
  // For now, using fission as placeholder or if it's the only entry point.
  // NOTE: This might need adjustment if there's a specific "buy neutron" path.
  const data = djed.methods
    .fission(value, account, [])
    .encodeABI();
  return buildTx(account, DJED_ADDRESS, value, data);
};

export const sellRcTx = (djed, account, amount, UI, DJED_ADDRESS) => {
  const data = djed.methods
    .fusion(amount, account)
    .encodeABI();
  return buildTx(account, DJED_ADDRESS, 0, data);
};
