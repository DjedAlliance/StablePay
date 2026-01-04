import { BC_DECIMALS, SCALING_DECIMALS } from "../constants";
import {
  scaledUnscaledPromise,
  web3Promise,
  scaledPromise,
  percentScaledPromise,
  decimalScaling,
  percentageScale,
} from "../helpers";

export const getCoinDetails = async (
  stableCoin,
  reserveCoin,
  djed,
  scDecimals,
  rcDecimals
) => {
  try {
    const [
      [scaledNumberSc, unscaledNumberSc],
      [scaledPriceSc, unscaledPriceSc],
      [scaledNumberRc, unscaledNumberRc],
      [scaledReserveBc, unscaledReserveBc],
      scaledBuyPriceRc,
      scaledScExchangeRate,
    ] = await Promise.all([
      scaledUnscaledPromise(web3Promise(stableCoin, "totalSupply"), scDecimals),
      scaledUnscaledPromise(web3Promise(djed, "protonPriceInBase"), BC_DECIMALS),
      scaledUnscaledPromise(
        web3Promise(reserveCoin, "totalSupply"),
        rcDecimals
      ),
      scaledUnscaledPromise(web3Promise(djed, "reserve"), BC_DECIMALS),
      scaledPromise(web3Promise(djed, "neutronPriceInBase"), BC_DECIMALS),
      scaledPromise(web3Promise(djed, "protonPriceInBase"), BC_DECIMALS),
    ]);

    // Define default empty value
    const emptyValue = decimalScaling("0".toString(10), BC_DECIMALS);
    let scaledSellPriceRc = emptyValue;
    let unscaledSellPriceRc = emptyValue;
    let percentReserveRatio = emptyValue;

    // Check total reserve coin supply to calculate sell price
    if (BigInt(unscaledNumberRc) !== 0n) {
      [scaledSellPriceRc, unscaledSellPriceRc] = await scaledUnscaledPromise(
        web3Promise(djed, "neutronPriceInBase"),
        BC_DECIMALS
      );
    }

    // Check total stable coin supply to calculate reserve ratio
    if (BigInt(unscaledNumberSc) !== 0n) {
      percentReserveRatio = await percentScaledPromise(
        web3Promise(djed, "reserveRatioPeggedAsset"),
        SCALING_DECIMALS
      );
    }

    // Return the results
    return {
      scaledNumberSc,
      unscaledNumberSc,
      scaledPriceSc,
      unscaledPriceSc,
      scaledNumberRc,
      unscaledNumberRc,
      scaledReserveBc,
      unscaledReserveBc,
      percentReserveRatio,
      scaledBuyPriceRc,
      scaledSellPriceRc,
      unscaledSellPriceRc,
      scaledScExchangeRate,
    };
  } catch (error) {
    console.error("Error fetching coin details:", error);
    throw new Error("Failed to fetch coin details");
  }
};

export const getSystemParams = async (djed) => {
  const [
    reserveRatioMinUnscaled,
    fissionFeeUnscaled,
    fusionFeeUnscaled,
  ] = await Promise.all([
    web3Promise(djed, "CRITICAL_RESERVE_RATIO"),
    web3Promise(djed, "FISSION_FEE"),
    web3Promise(djed, "FUSION_FEE"),
  ]);

  return {
    reserveRatioMin: percentageScale(
      reserveRatioMinUnscaled,
      SCALING_DECIMALS,
      true
    ),
    reserveRatioMax: "N/A", // Gluon might not have a max ratio in the same way
    reserveRatioMinUnscaled,
    reserveRatioMaxUnscaled: "0",
    fee: percentageScale(fissionFeeUnscaled, SCALING_DECIMALS, true),
    feeUnscaled: fissionFeeUnscaled,
    treasuryFee: "0", // Gluon fees are consolidated
    thresholdSupplySC: "0",
  };
};

export const getAccountDetails = async (
  web3,
  account,
  stableCoin,
  reserveCoin,
  scDecimals,
  rcDecimals
) => {
  const [
    [scaledBalanceSc, unscaledBalanceSc],
    [scaledBalanceRc, unscaledBalanceRc],
    [scaledBalanceBc, unscaledBalanceBc],
  ] = await Promise.all([
    scaledUnscaledPromise(
      web3Promise(stableCoin, "balanceOf", account),
      scDecimals
    ),
    scaledUnscaledPromise(
      web3Promise(reserveCoin, "balanceOf", account),
      rcDecimals
    ),
    scaledUnscaledPromise(web3.eth.getBalance(account), BC_DECIMALS),
  ]);

  return {
    scaledBalanceSc,
    unscaledBalanceSc,
    scaledBalanceRc,
    unscaledBalanceRc,
    scaledBalanceBc,
    unscaledBalanceBc,
  };
};
