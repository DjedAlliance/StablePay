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
      "rcBuyingPrice",
      rcDecimals,
      amountScaled
    );
    const { treasuryFee, fee } = await getFees(djed);

    const totalBCUnscaled = appendFees(
      data.totalUnscaled,
      treasuryFee,
      fee,
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
      "rcTargetPrice",
      rcDecimals,
      amountScaled
    );

    const { treasuryFee, fee } = await getFees(djed);
    const value = convertToBC(
      data.amountUnscaled,
      data.priceUnscaled,
      rcDecimals
    ).toString();

    const totalBCAmount = deductFees(value, fee, treasuryFee);

    return {
      ...data,
      totalBCScaled: decimalScaling(totalBCAmount.toString(), BC_DECIMALS),
      totalBCUnscaled: totalBCAmount.toString(),
    };
  } catch (error) {
    console.log("error", error);
  }
};

// export const buyRcTx = (djed, account, value, UI, DJED_ADDRESS) => {
//   const data = djed.methods
//     .buyReserveCoins(account, FEE_UI_UNSCALED, UI)
//     .encodeABI();
//   return buildTx(account, DJED_ADDRESS, value, data);
// };
export const buyRcTx = async (djed, signer, account, value, UI) => {
  try {
    const tx = await djed.connect(signer).buyReserveCoins(account, FEE_UI_UNSCALED, UI, {
      value, 
    });
    return tx;
  } catch (error) {
    console.error("Error in buyRcTx:", error);
  }
};

// export const sellRcTx = (djed, account, amount, UI, DJED_ADDRESS) => {
//   const data = djed.methods
//     .sellReserveCoins(amount, account, FEE_UI_UNSCALED, UI)
//     .encodeABI();
//   return buildTx(account, DJED_ADDRESS, 0, data);
// };
export const sellRcTx = async (djed, signer, account, amount, UI) => {
  try {
    const tx = await djed.connect(signer).sellReserveCoins(amount, account, FEE_UI_UNSCALED, UI);
    return tx;
  } catch (error) {
    console.error("Error in sellRcTx:", error);
  }
};
