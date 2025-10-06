import { ethers } from 'ethers';

// import Web3 from "web3";


const getEthers = async (BLOCKCHAIN_URI) => {
  if (window.ethereum) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []); 
      return provider;
    } catch (error) {
      throw error;
    }
  } else {
    throw new Error("Please install Metamask");
  }
};

// export function web3Promise(contract, method, ...args) {
//   return contract.methods[method](...args).call();
// }


// Function to call a contract method and return a promise
async function ethersPromise(contract, method, ...args) {
  return await contract[method](...args);
}

// Function to build a transaction
// Set gas limit to 500,000 by default
function buildTx(from_, to_, value_, data_, setGasLimit = true) {
  const tx = {
    to: to_,
    from: from_,
    value: "0x" + BigInt(value_).toString(16), // Use BigInt instead of BN
    data: data_,
  };
  if (setGasLimit) {
    tx.gasLimit = 500_000;
  }
  return tx;
}
// export function convertInt(promise) {
//   return promise.then((value) => parseInt(value));
// }
async function convertInt(promise) {
  const value = await promise;
  return parseInt(value);
}

// export function reverseString(s) {
//   return s.split("").reverse().join("");
// }
function reverseString(s) {
  return s.split("").reverse().join("");
}

function intersperseCommas(s) {
  let newString = s.replace(/(.{3})/g, "$1,");
  if (s.length % 3 === 0) {
    return newString.slice(0, newString.length - 1);
  } else {
    return newString;
  }
}

function decimalScaling(unscaledString, decimals, show = 6) {
  if (decimals <= 0) {
    return unscaledString + "0".repeat(-decimals);
  }

  let prefix;
  let suffix;

  if (unscaledString.length <= decimals) {
    prefix = "0";
    suffix = "0".repeat(decimals - unscaledString.length) + unscaledString;
  } else {
    prefix = unscaledString.slice(0, -decimals);
    suffix = unscaledString.slice(-decimals);
  }

  suffix = suffix.slice(0, show);
  suffix = intersperseCommas(suffix);

  if (show <= decimals) {
    // Remove commas after the decimal point
    suffix = suffix.replace(/,/g, "");
  }

  prefix = reverseString(intersperseCommas(reverseString(prefix)));

  return prefix + "." + suffix;
}

function decimalUnscaling(scaledString, decimals) {
  scaledString = scaledString.replaceAll(",", "");
  let pos = scaledString.indexOf(".");
  if (pos < 0) {
    return scaledString + "0".repeat(decimals);
  }

  let s =
    scaledString.slice(0, pos) +
    scaledString.slice(pos + 1, pos + 1 + decimals);
  if (scaledString.length - pos - 1 < decimals) {
    s += "0".repeat(decimals - (scaledString.length - pos - 1));
  }
  return s;
}

// export function scaledPromise(promise, scaling) {
//   return promise.then((value) => decimalScaling(value.toString(10), scaling));
// }
async function scaledPromise(promise, scaling) {
  const value = await promise;
  return decimalScaling(value.toString(), scaling);
}

// export function scaledUnscaledPromise(promise, scaling) {
//   return promise.then((value) => [
//     decimalScaling(value.toString(10), scaling),
//     value,
//   ]);
// }
async function scaledUnscaledPromise(promise, scaling) {
  const value = await promise;
  return [decimalScaling(value.toString(), scaling), value];
}

function percentageScale(value, scaling, showSymbol = false) {
  const calculatedValue = decimalScaling(value.toString(10), scaling - 2, 2);
  if (showSymbol) {
    return calculatedValue + "%";
  }
  return calculatedValue;
}

// export function percentScaledPromise(promise, scaling) {
//   return promise.then((value) => percentageScale(value, scaling, true));
// }

async function percentScaledPromise(promise, scaling) {
  const value = await promise;
  return percentageScale(value, scaling, true);
}

// currency conversions:
function calculateBcUsdEquivalent(coinsDetails, amountFloat) {
  const adaPerUsd = parseFloat(
    coinsDetails?.scaledScExchangeRate.replaceAll(",", "")
  );
  const eqPrice = (1e6 * amountFloat) / adaPerUsd;
  return decimalScaling(eqPrice.toFixed(0).toString(10), 6);
}

function getBcUsdEquivalent(coinsDetails, amountFloat) {
  return "$" + calculateBcUsdEquivalent(coinsDetails, amountFloat);
}

function calculateRcUsdEquivalent(coinsDetails, amountFloat) {
  const adaPerRc = parseFloat(coinsDetails?.scaledSellPriceRc);
  const adaPerUsd = parseFloat(
    coinsDetails?.scaledScExchangeRate.replaceAll(",", "")
  );
  const eqPrice = (1e6 * amountFloat * adaPerRc) / adaPerUsd;
  return decimalScaling(eqPrice.toFixed(0).toString(10), 6);
}
function getRcUsdEquivalent(coinsDetails, amountFloat) {
  return "$" + calculateRcUsdEquivalent(coinsDetails, amountFloat);
}

function getScAdaEquivalent(coinsDetails, amountFloat) {
  const adaPerSc = parseFloat(coinsDetails?.scaledPriceSc.replaceAll(",", ""));
  const eqPrice = 1e6 * amountFloat * adaPerSc;
  return decimalScaling(eqPrice.toFixed(0).toString(10), 6);
}

const BC_DECIMALS = 18;
const SCALING_DECIMALS = 24;
const TRANSACTION_USD_LIMIT = 10000;
const FEE_UI=0.01;
const REFRESH_PERIOD = 4000;
const CONFIRMATION_WAIT_PERIOD = REFRESH_PERIOD + 1000;

const scalingFactor = decimalUnscaling("1", SCALING_DECIMALS);
const FEE_UI_UNSCALED = decimalUnscaling(
  (FEE_UI / 100).toString(),
  SCALING_DECIMALS
);
// export const tradeDataPriceCore = (djed, method, decimals, amountScaled) => {
//   const amountUnscaled = decimalUnscaling(amountScaled, decimals);
//   return scaledUnscaledPromise(web3Promise(djed, method, 0), BC_DECIMALS).then(
//     (price) => {
//       const [priceScaled, priceUnscaled] = price;
//       const totalUnscaled = convertToBC(
//         amountUnscaled,
//         priceUnscaled,
//         decimals
//       ).toString();

//       const totalScaled = decimalScaling(totalUnscaled, BC_DECIMALS);

//       return {
//         amountScaled,
//         amountUnscaled,
//         totalScaled,
//         totalUnscaled,
//         priceUnscaled,
//         priceScaled,
//       };
//     }
//   );
// };
const tradeDataPriceCore = async (djed, method, decimals, amountScaled) => {
  const amountUnscaled = decimalUnscaling(amountScaled, decimals);
  const price = await scaledUnscaledPromise(ethersPromise(djed, method, 0), BC_DECIMALS);
  const [priceScaled, priceUnscaled] = price;
  const totalUnscaled = convertToBC(amountUnscaled, priceUnscaled, decimals).toString();
  const totalScaled = decimalScaling(totalUnscaled, BC_DECIMALS);

  return {
    amountScaled,
    amountUnscaled,
    totalScaled,
    totalUnscaled,
    priceUnscaled,
    priceScaled,
  };
};

/**
 * Function that converts coin amount to BC
 * @param {*} amount unscaled coin amount to be converted to BC
 * @param {*} price unscaled coin price
 * @param {*} decimals coin decimals
 * @returns unscaled BC amount
 */
const convertToBC = (amount, price, decimals) => {
  const decimalScalingFactor = BigInt(Math.pow(10, decimals));
  return (BigInt(amount) * BigInt(price)) / decimalScalingFactor;
};

/**
 * Calculate if the transaction will reach the maximum reserve ratio
 * @param scPrice - Unscaled stablecoin price
 * @param reserveBc - Unscaled reserve of base coin with appended potential transaction amount.
 * Example: If user wants to buy 1RC, the reserveBc param will be calculated as sum of current reserve of BC and desired RC amount converted in BC
 * @param totalScSupply - Unscaled total stablecoin supply
 * @param reserveRatioMax - Unscaled maximum reserve ratio
 * @param scDecimalScalingFactor - If stablecoin has 6 decimals, scDecimalScalingFactor will be calculated as 10^6
 * @param thresholdSupplySC - Unscaled threshold SC supply
 * @returns
 */
const calculateIsRatioBelowMax = ({
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

/**
 * Calculate if the transaction will reach the minimum reserve ratio
 * @param scPrice - Unscaled stablecoin price
 * @param reserveBc - Unscaled reserve of base coin with calculated potential transaction amount.
 * Example: If user wants to buy 1SC, the reserveBc param will be calculated as sum of current reserve of BC and desired SC amount converted in BC
 * @param totalScSupply - Unscaled total stablecoin supply
 * @param reserveRatioMin - Unscaled minimum reserve ratio
 * @param scDecimalScalingFactor - If stablecoin has 6 decimals, scDecimalScalingFactor will be calculated as 10^6
 * @returns
 */
const calculateIsRatioAboveMin = ({
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

/**
 *
 * @param {*} amountUSD
 * @param {*} totalSCSupply
 * @param {*} thresholdSCSupply
 * @returns
 */
const isTxLimitReached = (amountUSD, totalSCSupply, thresholdSCSupply) =>
  amountUSD > TRANSACTION_USD_LIMIT &&
  BigInt(totalSCSupply) >= BigInt(thresholdSCSupply);

// export const promiseTx = (isWalletConnected, tx, signer) => {
//   if (!isWalletConnected) {
//     return Promise.reject(new Error("Metamask not connected!"));
//   }
//   if (!signer) {
//     return Promise.reject(new Error("Couldn't get Signer"));
//   }
//   return signer.sendTransaction(tx);
// };
const promiseTx = async (isWalletConnected, tx, signer) => {
  if (!isWalletConnected) {
    throw new Error("Metamask not connected!");
  }
  if (!signer) {
    throw new Error("Couldn't get Signer");
  }
  return signer.sendTransaction(tx);
};

// export const verifyTx = (web3, hash) => {
//   return new Promise((res) => {
//     setTimeout(() => {
//       web3.eth
//         .getTransactionReceipt(hash)
//         .then((receipt) => res(receipt.status));
//     }, CONFIRMATION_WAIT_PERIOD);
//   });
// };
const verifyTx = async (provider, hash) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const receipt = await provider.getTransactionReceipt(hash);
      resolve(receipt.status);
    }, CONFIRMATION_WAIT_PERIOD);
  });
};

/**
 * Function that deducts all platform fees from the BC amount
 * @param {*} value The amount of BC from which fees should be deducted
 * @param {*} fee The platform fee
 * @param {*} treasuryFee The treasury fee
 * @returns BC value with all fees calculated
 */
const calculateTxFees = (value, fee, treasuryFee, feeUI) => {
  const f = (BigInt(value) * BigInt(fee)) / BigInt(scalingFactor);
  const f_ui =
    (BigInt(value) * BigInt(feeUI || FEE_UI_UNSCALED)) / BigInt(scalingFactor);
  const f_t = (BigInt(value) * BigInt(treasuryFee)) / BigInt(scalingFactor);

  return { f, f_ui, f_t };
};

/**
 * Function that deducts all platform fees from the BC amount
 * @param {*} value The amount of BC from which fees should be deducted
 * @param {*} fee The platform fee
 * @param {*} treasuryFee The treasury fee
 * @returns BC value with all fees calculated
 */
const deductFees = (value, fee, treasuryFee) => {
  const { f, f_ui, f_t } = calculateTxFees(value, fee, treasuryFee);
  return BigInt(value) - f - f_ui - f_t;
};

/**
 * Function that appends all platform fees to the BC amount
 * @param {*} amountBC The unscaled amount of BC (e.g. for 1BC, value should be 1 * 10^BC_DECIMALS)
 * @param {*} treasuryFee Treasury fee unscaled (e.g. If the fee is 1%, than 1/100 * scalingFactor)
 * @param {*} fee Fee unscaled (e.g. If the fee is 1%, than 1/100 * scalingFactor)
 * @param {*} fee_UI UI fee unscaled (e.g. If the fee is 1%, than 1/100 * scalingFactor)
 * @returns Unscaled BC amount with calculated fees
 */
const appendFees = (amountBC, treasuryFee, fee, fee_UI) => {
  const totalFees = BigInt(treasuryFee) + BigInt(fee) + BigInt(fee_UI);
  const substractedFees = BigInt(scalingFactor) - totalFees;
  const appendedFeesAmount =
    (BigInt(amountBC) * BigInt(scalingFactor)) / substractedFees;

  return appendedFeesAmount.toString();
};

/**
 * Function that returns treasury and platform fees
 * @param {*} djed Djed contract
 * @returns Treasury and platform fee
 */
// export const getFees = async (djed) => {
//   try {
//     const [treasuryFee, fee] = await Promise.all([
//       web3Promise(djed, "treasuryFee"),
//       web3Promise(djed, "fee"),
//     ]);
//     return {
//       treasuryFee,
//       fee,
//     };
//   } catch (error) {
//     console.log("error", error);
//   }
// };
const getFees = async (djed) => {
  try {
    const [treasuryFee, fee] = await Promise.all([
      ethersPromise(djed, "treasuryFee"),
      ethersPromise(djed, "fee"),
    ]);
    return { treasuryFee, fee };
  } catch (error) {
    console.error("Error fetching fees:", error);
  }
};

/**
 * Function that calculates fees and how much BC (totalBCAmount) user should pay to receive desired amount of reserve coin
 * @param {*} djed DjedContract
 * @param {*} rcDecimals Reserve coin decimals
 * @param {*} amountScaled Reserve coin amount that user wants to buy
 * @returns
 */
const tradeDataPriceBuyRc = async (djed, rcDecimals, amountScaled) => {
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

const tradeDataPriceSellRc = async (djed, rcDecimals, amountScaled) => {
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
const buyRcTx = async (djed, signer, account, value, UI) => {
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
const sellRcTx = async (djed, signer, account, amount, UI) => {
  try {
    const tx = await djed.connect(signer).sellReserveCoins(amount, account, FEE_UI_UNSCALED, UI);
    return tx;
  } catch (error) {
    console.error("Error in sellRcTx:", error);
  }
};

/**
 * Function that calculates fees and how much BC (totalBCAmount) user should pay to receive desired amount of stable coin
 * @param {*} djed DjedContract
 * @param {*} scDecimals Stable coin decimals
 * @param {*} amountScaled Stable coin amount that user wants to buy
 * @returns
 */
const tradeDataPriceBuySc = async (djed, scDecimals, amountScaled) => {
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
const tradeDataPriceSellSc = async (djed, scDecimals, amountScaled) => {
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
const buyScTx = async (djed, payer, receiver, value, UI, DJED_ADDRESS) => {
  const data = djed.interface.encodeFunctionData("buyStableCoins", [receiver, FEE_UI_UNSCALED, UI]);
  return buildTx(payer, DJED_ADDRESS, value, data);
};

// export const sellScTx = (djed, account, amount, UI, DJED_ADDRESS) => {
//   const data = djed.methods
//     .sellStableCoins(amount, account, FEE_UI_UNSCALED, UI)
//     .encodeABI();
//   return buildTx(account, DJED_ADDRESS, 0, data);
// };
const sellScTx = async (djed, account, amount, UI, DJED_ADDRESS) => {
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
const calculateFutureScPrice = async ({
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

var contractName$2 = "Djed";
var abi$2 = [
	{
		inputs: [
			{
				internalType: "address",
				name: "oracleAddress",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "_scalingFactor",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "_treasury",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "_initialTreasuryFee",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "_treasuryRevenueTarget",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "_reserveRatioMin",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "_reserveRatioMax",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "_fee",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "_thresholdSupplySC",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "_rcMinPrice",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "_txLimit",
				type: "uint256"
			}
		],
		stateMutability: "payable",
		type: "constructor"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "buyer",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "receiver",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amountRC",
				type: "uint256"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amountBC",
				type: "uint256"
			}
		],
		name: "BoughtReserveCoins",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "buyer",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "receiver",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amountSC",
				type: "uint256"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amountBC",
				type: "uint256"
			}
		],
		name: "BoughtStableCoins",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "seller",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "receiver",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amountSC",
				type: "uint256"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amountRC",
				type: "uint256"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amountBC",
				type: "uint256"
			}
		],
		name: "SoldBothCoins",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "seller",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "receiver",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amountRC",
				type: "uint256"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amountBC",
				type: "uint256"
			}
		],
		name: "SoldReserveCoins",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "seller",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "receiver",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amountSC",
				type: "uint256"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amountBC",
				type: "uint256"
			}
		],
		name: "SoldStableCoins",
		type: "event"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_currentPaymentAmount",
				type: "uint256"
			}
		],
		name: "E",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "L",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_currentPaymentAmount",
				type: "uint256"
			}
		],
		name: "R",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "receiver",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "fee_ui",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "ui",
				type: "address"
			}
		],
		name: "buyReserveCoins",
		outputs: [
		],
		stateMutability: "payable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "receiver",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "feeUI",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "ui",
				type: "address"
			}
		],
		name: "buyStableCoins",
		outputs: [
		],
		stateMutability: "payable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "fee",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "initialTreasuryFee",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "oracle",
		outputs: [
			{
				internalType: "contract IFreeOracle",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "ratio",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_currentPaymentAmount",
				type: "uint256"
			}
		],
		name: "rcBuyingPrice",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "rcDecimalScalingFactor",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "rcMinPrice",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_currentPaymentAmount",
				type: "uint256"
			}
		],
		name: "rcTargetPrice",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "reserveCoin",
		outputs: [
			{
				internalType: "contract Coin",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "reserveRatioMax",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "reserveRatioMin",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "scDecimalScalingFactor",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_currentPaymentAmount",
				type: "uint256"
			}
		],
		name: "scPrice",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "scalingFactor",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "amountSC",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "amountRC",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "receiver",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "fee_ui",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "ui",
				type: "address"
			}
		],
		name: "sellBothCoins",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "amountRC",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "receiver",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "fee_ui",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "ui",
				type: "address"
			}
		],
		name: "sellReserveCoins",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "amountSC",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "receiver",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "feeUI",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "ui",
				type: "address"
			}
		],
		name: "sellStableCoins",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "stableCoin",
		outputs: [
			{
				internalType: "contract Coin",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "thresholdSupplySC",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "treasury",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "treasuryFee",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "treasuryRevenue",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "treasuryRevenueTarget",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "txLimit",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	}
];
var djedArtifact = {
	contractName: contractName$2,
	abi: abi$2
};

var contractName$1 = "Coin";
var abi$1 = [
	{
		inputs: [
			{
				internalType: "string",
				name: "name",
				type: "string"
			},
			{
				internalType: "string",
				name: "symbol",
				type: "string"
			}
		],
		stateMutability: "nonpayable",
		type: "constructor"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "spender",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "value",
				type: "uint256"
			}
		],
		name: "Approval",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "value",
				type: "uint256"
			}
		],
		name: "Transfer",
		type: "event"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				internalType: "address",
				name: "spender",
				type: "address"
			}
		],
		name: "allowance",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "spender",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256"
			}
		],
		name: "approve",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "account",
				type: "address"
			}
		],
		name: "balanceOf",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "spender",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "subtractedValue",
				type: "uint256"
			}
		],
		name: "decreaseAllowance",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "spender",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "addedValue",
				type: "uint256"
			}
		],
		name: "increaseAllowance",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "name",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "symbol",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "totalSupply",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256"
			}
		],
		name: "transfer",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256"
			}
		],
		name: "transferFrom",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "decimals",
		outputs: [
			{
				internalType: "uint8",
				name: "",
				type: "uint8"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256"
			}
		],
		name: "mint",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256"
			}
		],
		name: "burn",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	}
];
var coinArtifact = {
	contractName: contractName$1,
	abi: abi$1
};

//setting up djed
// export const getDjedContract = (web3, DJED_ADDRESS) => {
//   const djed = new web3.eth.Contract(djedArtifact.abi, DJED_ADDRESS);
//   return djed;
// };
const getDjedContract = (providerOrSigner, DJED_ADDRESS) => {
  return new ethers.Contract(DJED_ADDRESS, djedArtifact.abi, providerOrSigner);
};

// export const getCoinContracts = async (djedContract, web3) => {
//   const [stableCoinAddress, reserveCoinAddress] = await Promise.all([
//     web3Promise(djedContract, "stableCoin"),
//     web3Promise(djedContract, "reserveCoin"),
//   ]);
//   const stableCoin = new web3.eth.Contract(coinArtifact.abi, stableCoinAddress);
//   const reserveCoin = new web3.eth.Contract(
//     coinArtifact.abi,
//     reserveCoinAddress
//   );
//   return { stableCoin, reserveCoin };
// };

const getCoinContracts = async (djedContract, providerOrSigner) => {
  const [stableCoinAddress, reserveCoinAddress] = await Promise.all([
    djedContract.stableCoin(),
    djedContract.reserveCoin(),
  ]);

  const stableCoin = new ethers.Contract(stableCoinAddress, coinArtifact.abi, providerOrSigner);
  const reserveCoin = new ethers.Contract(reserveCoinAddress, coinArtifact.abi, providerOrSigner);

  return { stableCoin, reserveCoin };
};

// export const getDecimals = async (stableCoin, reserveCoin) => {
//   const [scDecimals, rcDecimals] = await Promise.all([
//     convertInt(web3Promise(stableCoin, "decimals")),
//     convertInt(web3Promise(reserveCoin, "decimals")),
//   ]);
//   return { scDecimals, rcDecimals };
// };

const getDecimals = async (stableCoin, reserveCoin) => {
  const [scDecimals, rcDecimals] = await Promise.all([
    convertInt(await stableCoin.decimals()),
    convertInt(await reserveCoin.decimals()),
  ]);
  return { scDecimals, rcDecimals };
};

// export const getCoinDetails = async (
//   stableCoin,
//   reserveCoin,
//   djed,
//   scDecimals,
//   rcDecimals
// ) => {
//   try {
//     const [
//       [scaledNumberSc, unscaledNumberSc],
//       [scaledPriceSc, unscaledPriceSc],
//       [scaledNumberRc, unscaledNumberRc],
//       [scaledReserveBc, unscaledReserveBc],
//       scaledBuyPriceRc,
//       scaledScExchangeRate,
//     ] = await Promise.all([
//       scaledUnscaledPromise(web3Promise(stableCoin, "totalSupply"), scDecimals),
//       scaledUnscaledPromise(web3Promise(djed, "scPrice", 0), BC_DECIMALS),
//       scaledUnscaledPromise(
//         web3Promise(reserveCoin, "totalSupply"),
//         rcDecimals
//       ),
//       scaledUnscaledPromise(web3Promise(djed, "R", 0), BC_DECIMALS),
//       scaledPromise(web3Promise(djed, "rcBuyingPrice", 0), BC_DECIMALS),
//       scaledPromise(web3Promise(djed, "scPrice", 0), BC_DECIMALS),
//     ]);

//     // Define default empty value
//     const emptyValue = decimalScaling("0".toString(10), BC_DECIMALS);
//     let scaledSellPriceRc = emptyValue;
//     let unscaledSellPriceRc = emptyValue;
//     let percentReserveRatio = emptyValue;

//     // Check total reserve coin supply to calculate sell price
//     if (BigInt(unscaledNumberRc) !== 0n) {
//       [scaledSellPriceRc, unscaledSellPriceRc] = await scaledUnscaledPromise(
//         web3Promise(djed, "rcTargetPrice", 0),
//         BC_DECIMALS
//       );
//     }

//     // Check total stable coin supply to calculate reserve ratio
//     if (BigInt(unscaledNumberSc) !== 0n) {
//       percentReserveRatio = await percentScaledPromise(
//         web3Promise(djed, "ratio"),
//         SCALING_DECIMALS
//       );
//     }

//     // Return the results
//     return {
//       scaledNumberSc,
//       unscaledNumberSc,
//       scaledPriceSc,
//       unscaledPriceSc,
//       scaledNumberRc,
//       unscaledNumberRc,
//       scaledReserveBc,
//       unscaledReserveBc,
//       percentReserveRatio,
//       scaledBuyPriceRc,
//       scaledSellPriceRc,
//       unscaledSellPriceRc,
//       scaledScExchangeRate,
//     };
//   } catch (error) {
//     console.error("Error fetching coin details:", error);
//     throw new Error("Failed to fetch coin details");
//   }
// };
const getCoinDetails = async (
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
      scaledUnscaledPromise(
        ethersPromise(stableCoin.totalSupply()),
        scDecimals
      ),
      scaledUnscaledPromise(
        ethersPromise(djed.scPrice(0)),
        BC_DECIMALS
      ),
      scaledUnscaledPromise(
        ethersPromise(reserveCoin.totalSupply()),
        rcDecimals
      ),
      scaledUnscaledPromise(
        ethersPromise(djed.R(0)),
        BC_DECIMALS
      ),
      scaledPromise(
        ethersPromise(djed.rcBuyingPrice(0)),
        BC_DECIMALS
      ),
      scaledPromise(
        ethersPromise(djed.scPrice(0)),
        BC_DECIMALS
      ),
    ]);

    const emptyValue = decimalScaling("0", BC_DECIMALS);
    let scaledSellPriceRc = emptyValue;
    let unscaledSellPriceRc = emptyValue;
    let percentReserveRatio = emptyValue;

    if (BigInt(unscaledNumberRc) !== 0n) {
      [scaledSellPriceRc, unscaledSellPriceRc] = await scaledUnscaledPromise(
        ethersPromise(djed.rcTargetPrice(0)),
        BC_DECIMALS
      );
    }

    if (BigInt(unscaledNumberSc) !== 0n) {
      percentReserveRatio = await percentScaledPromise(
        ethersPromise(djed.ratio()),
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
      scaledScExchangeRate,
    };
  } catch (error) {
    console.error("Error fetching coin details:", error);
    throw new Error("Failed to fetch coin details");
  }
};

// export const getSystemParams = async (djed) => {
//   const [
//     reserveRatioMinUnscaled,
//     reserveRatioMaxUnscaled,
//     feeUnscaled,
//     treasuryFee,
//     thresholdSupplySC,
//   ] = await Promise.all([
//     web3Promise(djed, "reserveRatioMin"),
//     web3Promise(djed, "reserveRatioMax"),
//     web3Promise(djed, "fee"),
//     percentScaledPromise(web3Promise(djed, "treasuryFee"), SCALING_DECIMALS),
//     web3Promise(djed, "thresholdSupplySC"),
//   ]);

//   return {
//     reserveRatioMin: percentageScale(
//       reserveRatioMinUnscaled,
//       SCALING_DECIMALS,
//       true
//     ),
//     reserveRatioMax: percentageScale(
//       reserveRatioMaxUnscaled,
//       SCALING_DECIMALS,
//       true
//     ),
//     reserveRatioMinUnscaled,
//     reserveRatioMaxUnscaled,
//     fee: percentageScale(feeUnscaled, SCALING_DECIMALS, true),
//     feeUnscaled,
//     treasuryFee,
//     thresholdSupplySC,
//   };
// };

const getSystemParams = async (djed) => {
  const [
    reserveRatioMinUnscaled,
    reserveRatioMaxUnscaled,
    feeUnscaled,
    treasuryFee,
    thresholdSupplySC,
  ] = await Promise.all([
    ethersPromise(djed.reserveRatioMin()),
    ethersPromise(djed.reserveRatioMax()),
    ethersPromise(djed.fee()),
    percentScaledPromise(ethersPromise(djed.treasuryFee()), SCALING_DECIMALS),
    ethersPromise(djed.thresholdSupplySC()),
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
  };
};

// export const getAccountDetails = async (
//   web3,
//   account,
//   stableCoin,
//   reserveCoin,
//   scDecimals,
//   rcDecimals
// ) => {
//   const [
//     [scaledBalanceSc, unscaledBalanceSc],
//     [scaledBalanceRc, unscaledBalanceRc],
//     [scaledBalanceBc, unscaledBalanceBc],
//   ] = await Promise.all([
//     scaledUnscaledPromise(
//       web3Promise(stableCoin, "balanceOf", account),
//       scDecimals
//     ),
//     scaledUnscaledPromise(
//       web3Promise(reserveCoin, "balanceOf", account),
//       rcDecimals
//     ),
//     scaledUnscaledPromise(web3.eth.getBalance(account), BC_DECIMALS),
//   ]);

//   return {
//     scaledBalanceSc,
//     unscaledBalanceSc,
//     scaledBalanceRc,
//     unscaledBalanceRc,
//     scaledBalanceBc,
//     unscaledBalanceBc,
//   };
// };
const getAccountDetails = async (
  provider,
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
      ethersPromise(stableCoin.balanceOf(account)),
      scDecimals
    ),
    scaledUnscaledPromise(
      ethersPromise(reserveCoin.balanceOf(account)),
      rcDecimals
    ),
    scaledUnscaledPromise(
      provider.getBalance(account),
      BC_DECIMALS
    ),
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

var contractName = "Oracle";
var abi = [
	{
		inputs: [
			{
				internalType: "address",
				name: "_owner",
				type: "address"
			},
			{
				internalType: "string",
				name: "_description",
				type: "string"
			},
			{
				internalType: "string",
				name: "_termsOfService",
				type: "string"
			}
		],
		stateMutability: "nonpayable",
		type: "constructor"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "uint256",
				name: "data",
				type: "uint256"
			}
		],
		name: "DataWritten",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "a",
				type: "address"
			},
			{
				indexed: false,
				internalType: "address",
				name: "opposer",
				type: "address"
			}
		],
		name: "OppositionAdded",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "a",
				type: "address"
			},
			{
				indexed: false,
				internalType: "address",
				name: "opposer",
				type: "address"
			}
		],
		name: "OppositionRemoved",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "a",
				type: "address"
			}
		],
		name: "OwnerAdded",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "a",
				type: "address"
			}
		],
		name: "OwnerRemoved",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "a",
				type: "address"
			},
			{
				indexed: false,
				internalType: "address",
				name: "supporter",
				type: "address"
			}
		],
		name: "SupportAdded",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "a",
				type: "address"
			},
			{
				indexed: false,
				internalType: "address",
				name: "supporter",
				type: "address"
			}
		],
		name: "SupportRemoved",
		type: "event"
	},
	{
		inputs: [
		],
		name: "acceptTermsOfService",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		name: "acceptedTermsOfService",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "a",
				type: "address"
			}
		],
		name: "add",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "description",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "numOwners",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "a",
				type: "address"
			}
		],
		name: "oppose",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			},
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		name: "opposers",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "opposing",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		name: "oppositionCounter",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		name: "owner",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "readData",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "a",
				type: "address"
			}
		],
		name: "remove",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "a",
				type: "address"
			}
		],
		name: "support",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		name: "supportCounter",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			},
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		name: "supporters",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "supporting",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "termsOfService",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "a",
				type: "address"
			}
		],
		name: "unoppose",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "a",
				type: "address"
			}
		],
		name: "unsupport",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_data",
				type: "uint256"
			}
		],
		name: "writeData",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	}
];
var oracleArtifact = {
	contractName: contractName,
	abi: abi
};

// import { convertInt,web3Promise } from "../helpers";
// import oracleArtifact from "../artifacts/OracleABI.json";


const getOracleAddress = async (djedContract) => {
  return await djedContract.oracle(); // Direct Ethers.js contract call
};

const getOracleContract = (providerOrSigner, oracleAddress) => {
  return new ethers.Contract(oracleAddress, oracleArtifact.abi, providerOrSigner);
};

export { FEE_UI_UNSCALED, appendFees, buyRcTx, buyScTx, calculateBcUsdEquivalent, calculateFutureScPrice, calculateIsRatioAboveMin, calculateIsRatioBelowMax, calculateRcUsdEquivalent, calculateTxFees, convertToBC, deductFees, getAccountDetails, getBcUsdEquivalent, getCoinContracts, getCoinDetails, getDecimals, getDjedContract, getEthers, getFees, getOracleAddress, getOracleContract, getRcUsdEquivalent, getScAdaEquivalent, getSystemParams, isTxLimitReached, promiseTx, scalingFactor, sellRcTx, sellScTx, tradeDataPriceBuyRc, tradeDataPriceBuySc, tradeDataPriceCore, tradeDataPriceSellRc, tradeDataPriceSellSc, verifyTx };
