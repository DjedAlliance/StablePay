import { FEE_UI_UNSCALED } from "../djed/tradeUtils";

export const createDjedAdapter = (djedContract) => {
  const methods = djedContract?.methods;

  // Fail fast if required methods are missing
  if (
    !methods ||
    typeof methods.buyStableCoins !== "function" ||
    typeof methods.sellStableCoins !== "function"
  ) {
    throw new Error(
      "Invalid Djed contract instance: missing required methods (buyStableCoins, sellStableCoins)"
    );
  }

  return {
    buyStableCoins: (receiver, UI) =>
      methods.buyStableCoins(receiver, FEE_UI_UNSCALED, UI),

    sellStableCoins: (amount, account, UI) =>
      methods.sellStableCoins(amount, account, FEE_UI_UNSCALED, UI),
  };
};