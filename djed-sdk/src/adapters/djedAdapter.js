import { FEE_UI_UNSCALED } from "../djed/tradeUtils";

export const createDjedAdapter = (djedContract) => {
  if (!djedContract || !djedContract.methods) {
    throw new Error("Djed contract instance is required");
  }

  return {
    buyStableCoins: (receiver, UI) =>
      djedContract.methods.buyStableCoins(receiver, FEE_UI_UNSCALED, UI),

    sellStableCoins: (amount, account, UI) =>
      djedContract.methods.sellStableCoins(amount, account, FEE_UI_UNSCALED, UI),
  };
};