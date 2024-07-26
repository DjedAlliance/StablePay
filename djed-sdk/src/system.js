import { BC_DECIMALS, SCALING_DECIMALS } from "./constants";
import { scaledUnscaledPromise, web3Promise, scaledPromise, percentScaledPromise, decimalScaling, percentageScale } from "./helpers";

export const getCoinDetails = async (djedInstance) => {
  const { stableCoin, reserveCoin, djed, scDecimals, rcDecimals } = djedInstance;

  const [
    [scaledNumberSc, unscaledNumberSc],
    [scaledPriceSc, unscaledPriceSc],
    [scaledNumberRc, unscaledNumberRc],
    [scaledReserveBc, unscaledReserveBc],
    scaledBuyPriceRc,
    scaledScExchangeRate
  ] = await Promise.all([
    scaledUnscaledPromise(web3Promise(stableCoin, "totalSupply"), scDecimals),
    scaledUnscaledPromise(web3Promise(djed, "scPrice", 0), BC_DECIMALS),
    scaledUnscaledPromise(web3Promise(reserveCoin, "totalSupply"), rcDecimals),
    scaledUnscaledPromise(web3Promise(djed, "R", 0), BC_DECIMALS),
    scaledPromise(web3Promise(djed, "rcBuyingPrice", 0), BC_DECIMALS),
    scaledPromise(web3Promise(djed, "scPrice", 0), BC_DECIMALS)
  ]);
  const emptyValue = decimalScaling("0".toString(10), BC_DECIMALS);
  let scaledSellPriceRc = emptyValue;
  let unscaledSellPriceRc = emptyValue;
  let percentReserveRatio = emptyValue;

  // Check total stablecoin supply
  if (BigInt(unscaledNumberRc) !== 0n) {
    [scaledSellPriceRc, unscaledSellPriceRc] = await scaledUnscaledPromise(
      web3Promise(djed, "rcTargetPrice", 0),
      BC_DECIMALS
    );
  }

  // Check total reservecoin supply
  if (BigInt(unscaledNumberSc) !== 0n) {
    percentReserveRatio = await percentScaledPromise(
      web3Promise(djed, "ratio"),
      SCALING_DECIMALS
    );
  }

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
    scaledScExchangeRate
  };
};

export const getSystemParams = async (djed) => {
  const [
    reserveRatioMinUnscaled,
    reserveRatioMaxUnscaled,
    feeUnscaled,
    treasuryFee,
    thresholdSupplySC
  ] = await Promise.all([
    web3Promise(djed, "reserveRatioMin"),
    web3Promise(djed, "reserveRatioMax"),
    web3Promise(djed, "fee"),
    percentScaledPromise(web3Promise(djed, "treasuryFee"), SCALING_DECIMALS),
    web3Promise(djed, "thresholdSupplySC")
  ]);

  return {
    reserveRatioMin: percentageScale(reserveRatioMinUnscaled, SCALING_DECIMALS, true),
    reserveRatioMax: percentageScale(reserveRatioMaxUnscaled, SCALING_DECIMALS, true),
    reserveRatioMinUnscaled,
    reserveRatioMaxUnscaled,
    fee: percentageScale(feeUnscaled, SCALING_DECIMALS, true),
    feeUnscaled,
    treasuryFee,
    thresholdSupplySC
  };
};

export const getAccountDetails = async (account, djedInstance) => {
  const { web3, stableCoin, reserveCoin, scDecimals, rcDecimals } = djedInstance;

  const [
    [scaledBalanceSc, unscaledBalanceSc],
    [scaledBalanceRc, unscaledBalanceRc],
    [scaledBalanceBc, unscaledBalanceBc]
  ] = await Promise.all([
    scaledUnscaledPromise(web3Promise(stableCoin, "balanceOf", account), scDecimals),
    scaledUnscaledPromise(web3Promise(reserveCoin, "balanceOf", account), rcDecimals),
    scaledUnscaledPromise(web3.eth.getBalance(account), BC_DECIMALS)
  ]);

  return {
    scaledBalanceSc,
    unscaledBalanceSc,
    scaledBalanceRc,
    unscaledBalanceRc,
    scaledBalanceBc,
    unscaledBalanceBc
  };
};

// Function to get coin budgets (currently returns null values)
export const getCoinBudgets = async (DjedInstance, unscaledBalanceBc) => {
  const { djed, scDecimals, rcDecimals } = DjedInstance;
  return {
    scaledBudgetSc: null,
    unscaledBudgetSc: null,
    scaledBudgetRc: null,
    unscaledBudgetRc: null
  };
};
