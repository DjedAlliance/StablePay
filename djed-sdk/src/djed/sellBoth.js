import { BC_DECIMALS } from "../constants";
import {
  decimalScaling,
  decimalUnscaling,
  buildTx,
  web3Promise,
  scaledUnscaledPromise,
} from "../helpers";
import {
  getFees,
  convertToBC,
  deductFees,
  FEE_UI_UNSCALED,
  getPriceMethod,
} from "./tradeUtils";

/**
 * Function that calculates fees and how much BC (totalBCAmount) user will receive if he sells desired amount of stable coin and reserve coin
 * @param {*} djed DjedContract
 * @param {*} scDecimals Stable coin decimals
 * @param {*} rcDecimals Reserve coin decimals
 * @param {*} amountScScaled Stable coin amount that user wants to sell
 * @param {*} amountRcScaled Reserve coin amount that user wants to sell
 * @returns
 */
export const tradeDataPriceSellBoth = async (
  djed,
  scDecimals,
  rcDecimals,
  amountScScaled,
  amountRcScaled
) => {
  try {
    const scPriceMethod = await getPriceMethod(djed, 'sellSC');
    const [scPriceData, rcPriceData] = await Promise.all([
      scaledUnscaledPromise(web3Promise(djed, scPriceMethod, 0), BC_DECIMALS),
      scaledUnscaledPromise(web3Promise(djed, "rcTargetPrice", 0), BC_DECIMALS),
    ]);

    const amountScUnscaled = decimalUnscaling(amountScScaled, scDecimals);
    const amountRcUnscaled = decimalUnscaling(amountRcScaled, rcDecimals);

    const scValueBC = convertToBC(
      amountScUnscaled,
      scPriceData[1],
      scDecimals
    );
    const rcValueBC = convertToBC(
      amountRcUnscaled,
      rcPriceData[1],
      rcDecimals
    );

    const totalValueBC = (BigInt(scValueBC) + BigInt(rcValueBC)).toString();

    const { treasuryFee, fee } = await getFees(djed);
    const totalBCAmount = deductFees(totalValueBC, fee, treasuryFee);

    return {
      scPriceScaled: scPriceData[0],
      scPriceUnscaled: scPriceData[1],
      rcPriceScaled: rcPriceData[0],
      rcPriceUnscaled: rcPriceData[1],
      amountScUnscaled,
      amountRcUnscaled,
      totalBCScaled: decimalScaling(totalBCAmount.toString(), BC_DECIMALS),
      totalBCUnscaled: totalBCAmount.toString(),
    };
  } catch (error) {
    console.error("Error in tradeDataPriceSellBoth:", error);
  }
};

/**
 * Function to sell both stablecoins and reservecoins
 * @param {*} djed DjedContract
 * @param {*} account User address
 * @param {*} amountSC Unscaled amount of stablecoins to sell
 * @param {*} amountRC Unscaled amount of reservecoins to sell
 * @param {*} UI UI address for fee
 * @param {*} DJED_ADDRESS Address of Djed contract
 * @returns 
 */
export const sellBothTx = (
  djed,
  account,
  amountSC,
  amountRC,
  UI,
  DJED_ADDRESS
) => {
  const data = djed.methods
    .sellBothCoins(amountSC, amountRC, account, FEE_UI_UNSCALED, UI)
    .encodeABI();
  return buildTx(account, DJED_ADDRESS, 0, data);
};