import {
  TRANSACTION_USD_LIMIT,
  BC_DECIMALS,
  SCALING_DECIMALS,
  FEE_UI,
  CONFIRMATION_WAIT_PERIOD,
} from "../constants";
import {
  decimalUnscaling,
  decimalScaling,
  scaledUnscaledPromise,
  web3Promise,
} from "../helpers";

export const scalingFactor = decimalUnscaling("1", SCALING_DECIMALS);
export const FEE_UI_UNSCALED = decimalUnscaling(
  (FEE_UI / 100).toString(),
  SCALING_DECIMALS
);

export const tradeDataPriceCore = (djed, method, decimals, amountScaled) => {
  const amountUnscaled = decimalUnscaling(amountScaled, decimals);
  return scaledUnscaledPromise(web3Promise(djed, method, 0), BC_DECIMALS).then(
    (price) => {
      const [priceScaled, priceUnscaled] = price;
      const totalUnscaled = convertToBC(
        amountUnscaled,
        priceUnscaled,
        decimals
      ).toString();

      const totalScaled = decimalScaling(totalUnscaled, BC_DECIMALS);

      return {
        amountScaled,
        amountUnscaled,
        totalScaled,
        totalUnscaled,
        priceUnscaled,
        priceScaled,
      };
    }
  );
};

export const convertToBC = (amount, price, decimals) => {
  const decimalScalingFactor = BigInt(Math.pow(10, decimals));
  return (BigInt(amount) * BigInt(price)) / decimalScalingFactor;
};

export const calculateIsRatioBelowMax = ({
  scPrice,
  reserveBc,
  totalScSupply,
  reserveRatioMax,
  scDecimalScalingFactor,
  thresholdSupplySC,
}) => {
  const scalingFactorBigInt = BigInt(scalingFactor);

  return (
    BigInt(reserveBc) * scalingFactorBigInt * BigInt(scDecimalScalingFactor) <
      BigInt(totalScSupply) * BigInt(scPrice) * BigInt(reserveRatioMax) ||
    BigInt(totalScSupply) <= BigInt(thresholdSupplySC)
  );
};

export const calculateIsRatioAboveMin = ({
  scPrice,
  reserveBc,
  totalScSupply,
  reserveRatioMin,
  scDecimalScalingFactor,
}) => {
  const scalingFactorBigInt = BigInt(scalingFactor);

  return (
    BigInt(reserveBc) * scalingFactorBigInt * BigInt(scDecimalScalingFactor) >
    BigInt(totalScSupply) * BigInt(scPrice) * BigInt(reserveRatioMin)
  );
};

export const isTxLimitReached = (amountUSD, totalSCSupply, thresholdSCSupply, txLimit) =>
  (BigInt(amountUSD) > BigInt(txLimit || TRANSACTION_USD_LIMIT)) &&
  BigInt(totalSCSupply) >= BigInt(thresholdSCSupply);

export const promiseTx = (isWalletConnected, tx, signer) => {
  if (!isWalletConnected) {
    return Promise.reject(new Error("Metamask not connected!"));
  }
  if (!signer) {
    return Promise.reject(new Error("Couldn't get Signer"));
  }
  return signer.sendTransaction(tx);
};

export const verifyTx = (web3, hash) => {
  return new Promise((res) => {
    setTimeout(() => {
      web3.eth
        .getTransactionReceipt(hash)
        .then((receipt) => res(receipt.status));
    }, CONFIRMATION_WAIT_PERIOD);
  });
};

export const calculateTxFees = (value, fee, treasuryFee, feeUI) => {
  const f = (BigInt(value) * BigInt(fee)) / BigInt(scalingFactor);
  const f_ui =
    (BigInt(value) * BigInt(feeUI || FEE_UI_UNSCALED)) / BigInt(scalingFactor);
  const f_t = (BigInt(value) * BigInt(treasuryFee)) / BigInt(scalingFactor);

  return { f, f_ui, f_t };
};

export const deductFees = (value, fee, treasuryFee) => {
  const { f, f_ui, f_t } = calculateTxFees(value, fee, treasuryFee);
  return BigInt(value) - f - f_ui - f_t;
};

export const appendFees = (amountBC, treasuryFee, fee, fee_UI) => {
  const totalFees = BigInt(treasuryFee) + BigInt(fee) + BigInt(fee_UI);
  const substractedFees = BigInt(scalingFactor) - totalFees;
  const appendedFeesAmount =
    (BigInt(amountBC) * BigInt(scalingFactor)) / substractedFees;

  return appendedFeesAmount.toString();
};

export const getFees = async (djed) => {
  try {
    const [treasuryFee, fee] = await Promise.all([
      web3Promise(djed, "treasuryFee"),
      web3Promise(djed, "fee"),
    ]);
    return {
      treasuryFee,
      fee,
    };
  } catch (error) {
    console.log("error", error);
  }
};

/**
 * Added getPriceMethod export to fix Rollup Error
 */
export const getPriceMethod = async (djed, operation) => {
  const isShu = await djed.methods.scMaxPrice(0).call().then(() => true).catch(() => false);
  
  if (!isShu) return "scPrice";

  switch (operation) {
    case 'buySC': return "scMaxPrice";
    case 'sellSC': return "scMinPrice";
    case 'buyRC': return "scMinPrice";
    case 'sellRC': return "scMaxPrice";
    default: return "scPrice";
  }
};
