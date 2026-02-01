import { BC_DECIMALS, SCALING_DECIMALS } from "../constants";
import {
  scaledUnscaledPromise,
  web3Promise,
  scaledPromise,
  percentScaledPromise,
  decimalScaling,
  percentageScale,
} from "../helpers";
import { checkIfShu } from "./djed";

export const getCoinDetails = async (
  stableCoin,
  reserveCoin,
  djed,
  scDecimals,
  rcDecimals
) => {
  try {
    const isShu = await checkIfShu(djed);
    const priceMethod = isShu ? "scMaxPrice" : "scPrice";

    const [
      [scaledNumberSc, unscaledNumberSc],
      [scaledPriceSc, unscaledPriceSc],
      [scaledNumberRc, unscaledNumberRc],
      [scaledReserveBc, unscaledReserveBc],
      scaledBuyPriceRc,
      scaledScExchangeRate,
    ] = await Promise.all([
      scaledUnscaledPromise(web3Promise(stableCoin, "totalSupply"), scDecimals),
      scaledUnscaledPromise(web3Promise(djed, priceMethod, 0), BC_DECIMALS),
      scaledUnscaledPromise(
        web3Promise(reserveCoin, "totalSupply"),
        rcDecimals
      ),
      scaledUnscaledPromise(web3Promise(djed, "R", 0), BC_DECIMALS),
      scaledPromise(web3Promise(djed, "rcBuyingPrice", 0), BC_DECIMALS),
      scaledPromise(web3Promise(djed, priceMethod, 0), BC_DECIMALS),
    ]);

    // Define default empty value
    const emptyValue = decimalScaling("0".toString(10), BC_DECIMALS);
    let scaledSellPriceRc = emptyValue;
    let unscaledSellPriceRc = emptyValue;
    let percentReserveRatio = emptyValue;
    let percentReserveRatioMin = emptyValue;
    let percentReserveRatioMax = emptyValue;

    // Check total reserve coin supply to calculate sell price
    if (BigInt(unscaledNumberRc) !== 0n) {
      [scaledSellPriceRc, unscaledSellPriceRc] = await scaledUnscaledPromise(
        web3Promise(djed, "rcTargetPrice", 0),
        BC_DECIMALS
      );
    }

    // Check total stable coin supply to calculate reserve ratio
    if (BigInt(unscaledNumberSc) !== 0n) {
      if (isShu) {
        const [ratioMin, ratioMax] = await Promise.all([
           percentScaledPromise(web3Promise(djed, "ratioMin"), SCALING_DECIMALS),
           percentScaledPromise(web3Promise(djed, "ratioMax"), SCALING_DECIMALS)
        ]);
        percentReserveRatioMin = ratioMin;
        percentReserveRatioMax = ratioMax;
        percentReserveRatio = `${ratioMin} - ${ratioMax}`;
      } else {
        percentReserveRatio = await percentScaledPromise(
          web3Promise(djed, "ratio"),
          SCALING_DECIMALS
        );
      }
    }

    // Return the results
    return {
      isShu,
      scaledNumberSc,
      unscaledNumberSc,
      scaledPriceSc,
      unscaledPriceSc,
      scaledNumberRc,
      unscaledNumberRc,
      scaledReserveBc,
      unscaledReserveBc,
      percentReserveRatio,
      percentReserveRatioMin,
      percentReserveRatioMax,
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
    reserveRatioMaxUnscaled,
    feeUnscaled,
    treasuryFee,
    thresholdSupplySC,
    initialTreasuryFee,
    treasuryRevenueTarget,
    treasuryRevenue,
    rcMinPrice,
    txLimit,
  ] = await Promise.all([
    web3Promise(djed, "reserveRatioMin"),
    web3Promise(djed, "reserveRatioMax"),
    web3Promise(djed, "fee"),
    percentScaledPromise(web3Promise(djed, "treasuryFee"), SCALING_DECIMALS),
    web3Promise(djed, "thresholdSupplySC"),
    web3Promise(djed, "initialTreasuryFee"),
    web3Promise(djed, "treasuryRevenueTarget"),
    web3Promise(djed, "treasuryRevenue"),
    web3Promise(djed, "rcMinPrice"),
    web3Promise(djed, "txLimit"),
  ]);

  return {
    reserveRatioMin: percentageScale(
      reserveRatioMinUnscaled,
      SCALING_DECIMALS,
      true
    ),
    reserveRatioMax: percentageScale(
      reserveRatioMaxUnscaled,
      SCALING_DECIMALS,
      true
    ),
    reserveRatioMinUnscaled,
    reserveRatioMaxUnscaled,
    fee: percentageScale(feeUnscaled, SCALING_DECIMALS, true),
    feeUnscaled,
    treasuryFee,
    thresholdSupplySC,
    initialTreasuryFee: percentageScale(initialTreasuryFee, SCALING_DECIMALS, true),
    initialTreasuryFeeUnscaled: initialTreasuryFee,
    treasuryRevenueTarget,
    treasuryRevenue,
    rcMinPrice,
    txLimit,
  };
};
      true
    ),
    reserveRatioMax: percentageScale(
      reserveRatioMaxUnscaled,
      SCALING_DECIMALS,
      true
    ),
    reserveRatioMinUnscaled,
    reserveRatioMaxUnscaled,
    fee: percentageScale(feeUnscaled, SCALING_DECIMALS, true),
    feeUnscaled,
    treasuryFee,
    thresholdSupplySC,
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
