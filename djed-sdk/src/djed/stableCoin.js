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
      "scPrice",
      scDecimals,
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
      "scPrice",
      scDecimals,
      amountScaled
    );
    const { treasuryFee, fee } = await getFees(djed);
    const value = convertToBC(
      data.amountUnscaled,
      data.priceUnscaled,
      scDecimals
    ).toString();

    const totalBCAmount = deductFees(value, fee, treasuryFee);

    return {
      ...data,
      totalBCScaled: decimalScaling(totalBCAmount.toString(), BC_DECIMALS),
    };
  } catch (error) {
    console.log("error", error);
  }
};

// Function to allow User 1 (payer) to pay and User 2 (receiver) to receive stablecoins
// export const buyScTx = (djed, payer, receiver, value, UI, DJED_ADDRESS) => {
//   // `receiver` will get the stablecoins
//   const data = djed.methods.buyStableCoins(receiver, FEE_UI_UNSCALED, UI).encodeABI();
  
//   // `payer` is sending the funds
//   return buildTx(payer, DJED_ADDRESS, value, data);
// };
export const buyScTx = async (djed, payer, receiver, value, UI, DJED_ADDRESS) => {
  const data = djed.interface.encodeFunctionData("buyStableCoins", [receiver, FEE_UI_UNSCALED, UI]);
  return buildTx(payer, DJED_ADDRESS, value, data);
};

// export const sellScTx = (djed, account, amount, UI, DJED_ADDRESS) => {
//   const data = djed.methods
//     .sellStableCoins(amount, account, FEE_UI_UNSCALED, UI)
//     .encodeABI();
//   return buildTx(account, DJED_ADDRESS, 0, data);
// };
export const sellScTx = async (djed, account, amount, UI, DJED_ADDRESS) => {
  const data = djed.interface.encodeFunctionData("sellStableCoins", [amount, account, FEE_UI_UNSCALED, UI]);
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
// export const calculateFutureScPrice = async ({
//   amountBC,
//   amountSC,
//   djedContract,
//   oracleContract,
//   stableCoinContract,
//   scDecimalScalingFactor,
// }) => {
//   try {
//     const [scTargetPrice, scSupply, ratio] = await Promise.all([
//       web3Promise(oracleContract, "readData"),
//       web3Promise(stableCoinContract, "totalSupply"),
//       web3Promise(djedContract, "R", 0),
//     ]);

//     const futureScSupply = BigInt(scSupply) + BigInt(amountSC);
//     const futureRatio = BigInt(ratio) + BigInt(amountBC);

//     if (futureScSupply === 0n) {
//       return scTargetPrice;
//     } else {
//       const futurePrice =
//         (futureRatio * BigInt(scDecimalScalingFactor)) / futureScSupply;
//       return BigInt(scTargetPrice) < futurePrice
//         ? scTargetPrice
//         : futurePrice.toString();
//     }
//   } catch (error) {
//     console.log("calculateFutureScPrice error ", error);
//   }
// };
export const calculateFutureScPrice = async ({
  amountBC,
  amountSC,
  djedContract,
  oracleContract,
  stableCoinContract,
  scDecimalScalingFactor,
}) => {
  try {
    const [scTargetPrice, scSupply, ratio] = await Promise.all([
      oracleContract.readData(),
      stableCoinContract.totalSupply(),
      djedContract.R(0),
    ]);

    const futureScSupply = BigInt(scSupply) + BigInt(amountSC);
    const futureRatio = BigInt(ratio) + BigInt(amountBC);

    if (futureScSupply === 0n) {
      return scTargetPrice;
    } else {
      const futurePrice = (futureRatio * BigInt(scDecimalScalingFactor)) / futureScSupply;
      return BigInt(scTargetPrice) < futurePrice ? scTargetPrice : futurePrice.toString();
    }
  } catch (error) {
    console.error("calculateFutureScPrice error", error);
  }
};
