import { FEE_UI_UNSCALED } from "../djed/tradeUtils";

export const createDjedAdapter = (djedContract) => {
  const methods = djedContract?.methods;

  const missingMethods = [];

  if (!methods) {
    throw new Error("Invalid Djed contract instance: methods object is missing");
  }

  if (typeof methods.buyStableCoins !== "function") {
    missingMethods.push("buyStableCoins");
  }

  if (typeof methods.sellStableCoins !== "function") {
    missingMethods.push("sellStableCoins");
  }

  if (missingMethods.length > 0) {
    throw new Error(
      `Djed contract is missing required methods: ${missingMethods.join(", ")}`
    );
  }

  return {
    buyStableCoins: (receiver, ui) =>
      methods.buyStableCoins(receiver, FEE_UI_UNSCALED, ui),

    sellStableCoins: (amount, account, ui) =>
      methods.sellStableCoins(amount, account, FEE_UI_UNSCALED, ui),
  };
};