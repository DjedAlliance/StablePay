import Web3 from 'web3';

const getWeb3 = (BLOCKCHAIN_URI) =>
  new Promise((resolve, reject) => {
    if (window.ethereum) {
      try {
        const web3 = new Web3(BLOCKCHAIN_URI);
        resolve(web3);
      } catch (error) {
        reject(error);
      }
    } else {
      reject("Please install Metamask");
    }
  });

function web3Promise(contract, method, ...args) {
  return contract.methods[method](...args).call();
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
function convertInt(promise) {
  return promise.then((value) => parseInt(value));
}

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

function scaledPromise(promise, scaling) {
  return promise.then((value) => decimalScaling(value.toString(10), scaling));
}

function scaledUnscaledPromise(promise, scaling) {
  return promise.then((value) => [
    decimalScaling(value.toString(10), scaling),
    value,
  ]);
}

function percentageScale(value, scaling, showSymbol = false) {
  const calculatedValue = decimalScaling(value.toString(10), scaling - 2, 2);
  if (showSymbol) {
    return calculatedValue + "%";
  }
  return calculatedValue;
}

function percentScaledPromise(promise, scaling) {
  return promise.then((value) => percentageScale(value, scaling, true));
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
const tradeDataPriceCore = (djed, method, decimals, amountScaled) => {
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

const promiseTx = (isWalletConnected, tx, signer) => {
  if (!isWalletConnected) {
    return Promise.reject(new Error("Metamask not connected!"));
  }
  if (!signer) {
    return Promise.reject(new Error("Couldn't get Signer"));
  }
  return signer.sendTransaction(tx);
};

const verifyTx = (web3, hash) => {
  return new Promise((res) => {
    setTimeout(() => {
      web3.eth
        .getTransactionReceipt(hash)
        .then((receipt) => res(receipt.status));
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
const getFees = async (djed) => {
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

const buyRcTx = (djed, account, value, UI, DJED_ADDRESS) => {
  const data = djed.methods
    .buyReserveCoins(account, FEE_UI_UNSCALED, UI)
    .encodeABI();
  return buildTx(account, DJED_ADDRESS, value, data);
};

const sellRcTx = (djed, account, amount, UI, DJED_ADDRESS) => {
  const data = djed.methods
    .sellReserveCoins(amount, account, FEE_UI_UNSCALED, UI)
    .encodeABI();
  return buildTx(account, DJED_ADDRESS, 0, data);
};

var contractName$2 = "Oracle";
var abi$3 = [
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
	contractName: contractName$2,
	abi: abi$3
};

var contractName$1 = "Coin";
var abi$2 = [
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
	abi: abi$2
};

var contractName = "Djed";
var abi$1 = [
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
	contractName: contractName,
	abi: abi$1
};

const version$2 = '1.2.3';

let BaseError$2 = class BaseError extends Error {
    constructor(shortMessage, args = {}) {
        const details = args.cause instanceof BaseError
            ? args.cause.details
            : args.cause?.message
                ? args.cause.message
                : args.details;
        const docsPath = args.cause instanceof BaseError
            ? args.cause.docsPath || args.docsPath
            : args.docsPath;
        const message = [
            shortMessage || 'An error occurred.',
            '',
            ...(args.metaMessages ? [...args.metaMessages, ''] : []),
            ...(docsPath ? [`Docs: https://abitype.dev${docsPath}`] : []),
            ...(details ? [`Details: ${details}`] : []),
            `Version: abitype@${version$2}`,
        ].join('\n');
        super(message);
        Object.defineProperty(this, "details", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "docsPath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "metaMessages", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "shortMessage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'AbiTypeError'
        });
        if (args.cause)
            this.cause = args.cause;
        this.details = details;
        this.docsPath = docsPath;
        this.metaMessages = args.metaMessages;
        this.shortMessage = shortMessage;
    }
};

// TODO: This looks cool. Need to check the performance of `new RegExp` versus defined inline though.
// https://twitter.com/GabrielVergnaud/status/1622906834343366657
function execTyped(regex, string) {
    const match = regex.exec(string);
    return match?.groups;
}
// `bytes<M>`: binary type of `M` bytes, `0 < M <= 32`
// https://regexr.com/6va55
const bytesRegex$2 = /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/;
// `(u)int<M>`: (un)signed integer type of `M` bits, `0 < M <= 256`, `M % 8 == 0`
// https://regexr.com/6v8hp
const integerRegex$2 = /^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;
const isTupleRegex = /^\(.+?\).*?$/;

// https://regexr.com/7f7rv
const tupleRegex = /^tuple(?<array>(\[(\d*)\])*)$/;
/**
 * Formats {@link AbiParameter} to human-readable ABI parameter.
 *
 * @param abiParameter - ABI parameter
 * @returns Human-readable ABI parameter
 *
 * @example
 * const result = formatAbiParameter({ type: 'address', name: 'from' })
 * //    ^? const result: 'address from'
 */
function formatAbiParameter(abiParameter) {
    let type = abiParameter.type;
    if (tupleRegex.test(abiParameter.type) && 'components' in abiParameter) {
        type = '(';
        const length = abiParameter.components.length;
        for (let i = 0; i < length; i++) {
            const component = abiParameter.components[i];
            type += formatAbiParameter(component);
            if (i < length - 1)
                type += ', ';
        }
        const result = execTyped(tupleRegex, abiParameter.type);
        type += `)${result?.array || ''}`;
        return formatAbiParameter({
            ...abiParameter,
            type,
        });
    }
    // Add `indexed` to type if in `abiParameter`
    if ('indexed' in abiParameter && abiParameter.indexed)
        type = `${type} indexed`;
    // Return human-readable ABI parameter
    if (abiParameter.name)
        return `${type} ${abiParameter.name}`;
    return type;
}

/**
 * Formats {@link AbiParameter}s to human-readable ABI parameters.
 *
 * @param abiParameters - ABI parameters
 * @returns Human-readable ABI parameters
 *
 * @example
 * const result = formatAbiParameters([
 *   //  ^? const result: 'address from, uint256 tokenId'
 *   { type: 'address', name: 'from' },
 *   { type: 'uint256', name: 'tokenId' },
 * ])
 */
function formatAbiParameters(abiParameters) {
    let params = '';
    const length = abiParameters.length;
    for (let i = 0; i < length; i++) {
        const abiParameter = abiParameters[i];
        params += formatAbiParameter(abiParameter);
        if (i !== length - 1)
            params += ', ';
    }
    return params;
}

/**
 * Formats ABI item (e.g. error, event, function) into human-readable ABI item
 *
 * @param abiItem - ABI item
 * @returns Human-readable ABI item
 */
function formatAbiItem$1(abiItem) {
    if (abiItem.type === 'function')
        return `function ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})${abiItem.stateMutability && abiItem.stateMutability !== 'nonpayable'
            ? ` ${abiItem.stateMutability}`
            : ''}${abiItem.outputs?.length
            ? ` returns (${formatAbiParameters(abiItem.outputs)})`
            : ''}`;
    if (abiItem.type === 'event')
        return `event ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})`;
    if (abiItem.type === 'error')
        return `error ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})`;
    if (abiItem.type === 'constructor')
        return `constructor(${formatAbiParameters(abiItem.inputs)})${abiItem.stateMutability === 'payable' ? ' payable' : ''}`;
    if (abiItem.type === 'fallback')
        return `fallback() external${abiItem.stateMutability === 'payable' ? ' payable' : ''}`;
    return 'receive() external payable';
}

// https://regexr.com/7gmok
const errorSignatureRegex = /^error (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
function isErrorSignature(signature) {
    return errorSignatureRegex.test(signature);
}
function execErrorSignature(signature) {
    return execTyped(errorSignatureRegex, signature);
}
// https://regexr.com/7gmoq
const eventSignatureRegex = /^event (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
function isEventSignature(signature) {
    return eventSignatureRegex.test(signature);
}
function execEventSignature(signature) {
    return execTyped(eventSignatureRegex, signature);
}
// https://regexr.com/7gmot
const functionSignatureRegex = /^function (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)(?: (?<scope>external|public{1}))?(?: (?<stateMutability>pure|view|nonpayable|payable{1}))?(?: returns\s?\((?<returns>.*?)\))?$/;
function isFunctionSignature(signature) {
    return functionSignatureRegex.test(signature);
}
function execFunctionSignature(signature) {
    return execTyped(functionSignatureRegex, signature);
}
// https://regexr.com/7gmp3
const structSignatureRegex = /^struct (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*) \{(?<properties>.*?)\}$/;
function isStructSignature(signature) {
    return structSignatureRegex.test(signature);
}
function execStructSignature(signature) {
    return execTyped(structSignatureRegex, signature);
}
// https://regexr.com/78u01
const constructorSignatureRegex = /^constructor\((?<parameters>.*?)\)(?:\s(?<stateMutability>payable{1}))?$/;
function isConstructorSignature(signature) {
    return constructorSignatureRegex.test(signature);
}
function execConstructorSignature(signature) {
    return execTyped(constructorSignatureRegex, signature);
}
// https://regexr.com/7srtn
const fallbackSignatureRegex = /^fallback\(\) external(?:\s(?<stateMutability>payable{1}))?$/;
function isFallbackSignature(signature) {
    return fallbackSignatureRegex.test(signature);
}
function execFallbackSignature(signature) {
    return execTyped(fallbackSignatureRegex, signature);
}
// https://regexr.com/78u1k
const receiveSignatureRegex = /^receive\(\) external payable$/;
function isReceiveSignature(signature) {
    return receiveSignatureRegex.test(signature);
}
const modifiers = new Set([
    'memory',
    'indexed',
    'storage',
    'calldata',
]);
const eventModifiers = new Set(['indexed']);
const functionModifiers = new Set([
    'calldata',
    'memory',
    'storage',
]);

class InvalidAbiItemError extends BaseError$2 {
    constructor({ signature }) {
        super('Failed to parse ABI item.', {
            details: `parseAbiItem(${JSON.stringify(signature, null, 2)})`,
            docsPath: '/api/human#parseabiitem-1',
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidAbiItemError'
        });
    }
}
class UnknownTypeError extends BaseError$2 {
    constructor({ type }) {
        super('Unknown type.', {
            metaMessages: [
                `Type "${type}" is not a valid ABI type. Perhaps you forgot to include a struct signature?`,
            ],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'UnknownTypeError'
        });
    }
}
class UnknownSolidityTypeError extends BaseError$2 {
    constructor({ type }) {
        super('Unknown type.', {
            metaMessages: [`Type "${type}" is not a valid ABI type.`],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'UnknownSolidityTypeError'
        });
    }
}

class InvalidAbiParametersError extends BaseError$2 {
    constructor({ params }) {
        super('Failed to parse ABI parameters.', {
            details: `parseAbiParameters(${JSON.stringify(params, null, 2)})`,
            docsPath: '/api/human#parseabiparameters-1',
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidAbiParametersError'
        });
    }
}
class InvalidParameterError extends BaseError$2 {
    constructor({ param }) {
        super('Invalid ABI parameter.', {
            details: param,
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidParameterError'
        });
    }
}
class SolidityProtectedKeywordError extends BaseError$2 {
    constructor({ param, name }) {
        super('Invalid ABI parameter.', {
            details: param,
            metaMessages: [
                `"${name}" is a protected Solidity keyword. More info: https://docs.soliditylang.org/en/latest/cheatsheet.html`,
            ],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'SolidityProtectedKeywordError'
        });
    }
}
class InvalidModifierError extends BaseError$2 {
    constructor({ param, type, modifier, }) {
        super('Invalid ABI parameter.', {
            details: param,
            metaMessages: [
                `Modifier "${modifier}" not allowed${type ? ` in "${type}" type` : ''}.`,
            ],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidModifierError'
        });
    }
}
class InvalidFunctionModifierError extends BaseError$2 {
    constructor({ param, type, modifier, }) {
        super('Invalid ABI parameter.', {
            details: param,
            metaMessages: [
                `Modifier "${modifier}" not allowed${type ? ` in "${type}" type` : ''}.`,
                `Data location can only be specified for array, struct, or mapping types, but "${modifier}" was given.`,
            ],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidFunctionModifierError'
        });
    }
}
class InvalidAbiTypeParameterError extends BaseError$2 {
    constructor({ abiParameter, }) {
        super('Invalid ABI parameter.', {
            details: JSON.stringify(abiParameter, null, 2),
            metaMessages: ['ABI parameter type is invalid.'],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidAbiTypeParameterError'
        });
    }
}

class InvalidSignatureError extends BaseError$2 {
    constructor({ signature, type, }) {
        super(`Invalid ${type} signature.`, {
            details: signature,
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidSignatureError'
        });
    }
}
class UnknownSignatureError extends BaseError$2 {
    constructor({ signature }) {
        super('Unknown signature.', {
            details: signature,
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'UnknownSignatureError'
        });
    }
}
class InvalidStructSignatureError extends BaseError$2 {
    constructor({ signature }) {
        super('Invalid struct signature.', {
            details: signature,
            metaMessages: ['No properties exist.'],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidStructSignatureError'
        });
    }
}

class CircularReferenceError extends BaseError$2 {
    constructor({ type }) {
        super('Circular reference detected.', {
            metaMessages: [`Struct "${type}" is a circular reference.`],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'CircularReferenceError'
        });
    }
}

class InvalidParenthesisError extends BaseError$2 {
    constructor({ current, depth }) {
        super('Unbalanced parentheses.', {
            metaMessages: [
                `"${current.trim()}" has too many ${depth > 0 ? 'opening' : 'closing'} parentheses.`,
            ],
            details: `Depth "${depth}"`,
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidParenthesisError'
        });
    }
}

/**
 * Gets {@link parameterCache} cache key namespaced by {@link type} and {@link structs}. This prevents parameters from being accessible to types that don't allow them (e.g. `string indexed foo` not allowed outside of `type: 'event'`) and ensures different struct definitions with the same name are cached separately.
 * @param param ABI parameter string
 * @param type ABI parameter type
 * @param structs Struct definitions to include in cache key
 * @returns Cache key for {@link parameterCache}
 */
function getParameterCacheKey(param, type, structs) {
    let structKey = '';
    if (structs)
        for (const struct of Object.entries(structs)) {
            if (!struct)
                continue;
            let propertyKey = '';
            for (const property of struct[1]) {
                propertyKey += `[${property.type}${property.name ? `:${property.name}` : ''}]`;
            }
            structKey += `(${struct[0]}{${propertyKey}})`;
        }
    if (type)
        return `${type}:${param}${structKey}`;
    return `${param}${structKey}`;
}
/**
 * Basic cache seeded with common ABI parameter strings.
 *
 * **Note: When seeding more parameters, make sure you benchmark performance. The current number is the ideal balance between performance and having an already existing cache.**
 */
const parameterCache = new Map([
    // Unnamed
    ['address', { type: 'address' }],
    ['bool', { type: 'bool' }],
    ['bytes', { type: 'bytes' }],
    ['bytes32', { type: 'bytes32' }],
    ['int', { type: 'int256' }],
    ['int256', { type: 'int256' }],
    ['string', { type: 'string' }],
    ['uint', { type: 'uint256' }],
    ['uint8', { type: 'uint8' }],
    ['uint16', { type: 'uint16' }],
    ['uint24', { type: 'uint24' }],
    ['uint32', { type: 'uint32' }],
    ['uint64', { type: 'uint64' }],
    ['uint96', { type: 'uint96' }],
    ['uint112', { type: 'uint112' }],
    ['uint160', { type: 'uint160' }],
    ['uint192', { type: 'uint192' }],
    ['uint256', { type: 'uint256' }],
    // Named
    ['address owner', { type: 'address', name: 'owner' }],
    ['address to', { type: 'address', name: 'to' }],
    ['bool approved', { type: 'bool', name: 'approved' }],
    ['bytes _data', { type: 'bytes', name: '_data' }],
    ['bytes data', { type: 'bytes', name: 'data' }],
    ['bytes signature', { type: 'bytes', name: 'signature' }],
    ['bytes32 hash', { type: 'bytes32', name: 'hash' }],
    ['bytes32 r', { type: 'bytes32', name: 'r' }],
    ['bytes32 root', { type: 'bytes32', name: 'root' }],
    ['bytes32 s', { type: 'bytes32', name: 's' }],
    ['string name', { type: 'string', name: 'name' }],
    ['string symbol', { type: 'string', name: 'symbol' }],
    ['string tokenURI', { type: 'string', name: 'tokenURI' }],
    ['uint tokenId', { type: 'uint256', name: 'tokenId' }],
    ['uint8 v', { type: 'uint8', name: 'v' }],
    ['uint256 balance', { type: 'uint256', name: 'balance' }],
    ['uint256 tokenId', { type: 'uint256', name: 'tokenId' }],
    ['uint256 value', { type: 'uint256', name: 'value' }],
    // Indexed
    [
        'event:address indexed from',
        { type: 'address', name: 'from', indexed: true },
    ],
    ['event:address indexed to', { type: 'address', name: 'to', indexed: true }],
    [
        'event:uint indexed tokenId',
        { type: 'uint256', name: 'tokenId', indexed: true },
    ],
    [
        'event:uint256 indexed tokenId',
        { type: 'uint256', name: 'tokenId', indexed: true },
    ],
]);

function parseSignature(signature, structs = {}) {
    if (isFunctionSignature(signature))
        return parseFunctionSignature(signature, structs);
    if (isEventSignature(signature))
        return parseEventSignature(signature, structs);
    if (isErrorSignature(signature))
        return parseErrorSignature(signature, structs);
    if (isConstructorSignature(signature))
        return parseConstructorSignature(signature, structs);
    if (isFallbackSignature(signature))
        return parseFallbackSignature(signature);
    if (isReceiveSignature(signature))
        return {
            type: 'receive',
            stateMutability: 'payable',
        };
    throw new UnknownSignatureError({ signature });
}
function parseFunctionSignature(signature, structs = {}) {
    const match = execFunctionSignature(signature);
    if (!match)
        throw new InvalidSignatureError({ signature, type: 'function' });
    const inputParams = splitParameters(match.parameters);
    const inputs = [];
    const inputLength = inputParams.length;
    for (let i = 0; i < inputLength; i++) {
        inputs.push(parseAbiParameter(inputParams[i], {
            modifiers: functionModifiers,
            structs,
            type: 'function',
        }));
    }
    const outputs = [];
    if (match.returns) {
        const outputParams = splitParameters(match.returns);
        const outputLength = outputParams.length;
        for (let i = 0; i < outputLength; i++) {
            outputs.push(parseAbiParameter(outputParams[i], {
                modifiers: functionModifiers,
                structs,
                type: 'function',
            }));
        }
    }
    return {
        name: match.name,
        type: 'function',
        stateMutability: match.stateMutability ?? 'nonpayable',
        inputs,
        outputs,
    };
}
function parseEventSignature(signature, structs = {}) {
    const match = execEventSignature(signature);
    if (!match)
        throw new InvalidSignatureError({ signature, type: 'event' });
    const params = splitParameters(match.parameters);
    const abiParameters = [];
    const length = params.length;
    for (let i = 0; i < length; i++)
        abiParameters.push(parseAbiParameter(params[i], {
            modifiers: eventModifiers,
            structs,
            type: 'event',
        }));
    return { name: match.name, type: 'event', inputs: abiParameters };
}
function parseErrorSignature(signature, structs = {}) {
    const match = execErrorSignature(signature);
    if (!match)
        throw new InvalidSignatureError({ signature, type: 'error' });
    const params = splitParameters(match.parameters);
    const abiParameters = [];
    const length = params.length;
    for (let i = 0; i < length; i++)
        abiParameters.push(parseAbiParameter(params[i], { structs, type: 'error' }));
    return { name: match.name, type: 'error', inputs: abiParameters };
}
function parseConstructorSignature(signature, structs = {}) {
    const match = execConstructorSignature(signature);
    if (!match)
        throw new InvalidSignatureError({ signature, type: 'constructor' });
    const params = splitParameters(match.parameters);
    const abiParameters = [];
    const length = params.length;
    for (let i = 0; i < length; i++)
        abiParameters.push(parseAbiParameter(params[i], { structs, type: 'constructor' }));
    return {
        type: 'constructor',
        stateMutability: match.stateMutability ?? 'nonpayable',
        inputs: abiParameters,
    };
}
function parseFallbackSignature(signature) {
    const match = execFallbackSignature(signature);
    if (!match)
        throw new InvalidSignatureError({ signature, type: 'fallback' });
    return {
        type: 'fallback',
        stateMutability: match.stateMutability ?? 'nonpayable',
    };
}
const abiParameterWithoutTupleRegex = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*(?:\spayable)?)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/;
const abiParameterWithTupleRegex = /^\((?<type>.+?)\)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/;
const dynamicIntegerRegex = /^u?int$/;
function parseAbiParameter(param, options) {
    // optional namespace cache by `type`
    const parameterCacheKey = getParameterCacheKey(param, options?.type, options?.structs);
    if (parameterCache.has(parameterCacheKey))
        return parameterCache.get(parameterCacheKey);
    const isTuple = isTupleRegex.test(param);
    const match = execTyped(isTuple ? abiParameterWithTupleRegex : abiParameterWithoutTupleRegex, param);
    if (!match)
        throw new InvalidParameterError({ param });
    if (match.name && isSolidityKeyword(match.name))
        throw new SolidityProtectedKeywordError({ param, name: match.name });
    const name = match.name ? { name: match.name } : {};
    const indexed = match.modifier === 'indexed' ? { indexed: true } : {};
    const structs = options?.structs ?? {};
    let type;
    let components = {};
    if (isTuple) {
        type = 'tuple';
        const params = splitParameters(match.type);
        const components_ = [];
        const length = params.length;
        for (let i = 0; i < length; i++) {
            // remove `modifiers` from `options` to prevent from being added to tuple components
            components_.push(parseAbiParameter(params[i], { structs }));
        }
        components = { components: components_ };
    }
    else if (match.type in structs) {
        type = 'tuple';
        components = { components: structs[match.type] };
    }
    else if (dynamicIntegerRegex.test(match.type)) {
        type = `${match.type}256`;
    }
    else if (match.type === 'address payable') {
        type = 'address';
    }
    else {
        type = match.type;
        if (!(options?.type === 'struct') && !isSolidityType(type))
            throw new UnknownSolidityTypeError({ type });
    }
    if (match.modifier) {
        // Check if modifier exists, but is not allowed (e.g. `indexed` in `functionModifiers`)
        if (!options?.modifiers?.has?.(match.modifier))
            throw new InvalidModifierError({
                param,
                type: options?.type,
                modifier: match.modifier,
            });
        // Check if resolved `type` is valid if there is a function modifier
        if (functionModifiers.has(match.modifier) &&
            !isValidDataLocation(type, !!match.array))
            throw new InvalidFunctionModifierError({
                param,
                type: options?.type,
                modifier: match.modifier,
            });
    }
    const abiParameter = {
        type: `${type}${match.array ?? ''}`,
        ...name,
        ...indexed,
        ...components,
    };
    parameterCache.set(parameterCacheKey, abiParameter);
    return abiParameter;
}
// s/o latika for this
function splitParameters(params, result = [], current = '', depth = 0) {
    const length = params.trim().length;
    // biome-ignore lint/correctness/noUnreachable: recursive
    for (let i = 0; i < length; i++) {
        const char = params[i];
        const tail = params.slice(i + 1);
        switch (char) {
            case ',':
                return depth === 0
                    ? splitParameters(tail, [...result, current.trim()])
                    : splitParameters(tail, result, `${current}${char}`, depth);
            case '(':
                return splitParameters(tail, result, `${current}${char}`, depth + 1);
            case ')':
                return splitParameters(tail, result, `${current}${char}`, depth - 1);
            default:
                return splitParameters(tail, result, `${current}${char}`, depth);
        }
    }
    if (current === '')
        return result;
    if (depth !== 0)
        throw new InvalidParenthesisError({ current, depth });
    result.push(current.trim());
    return result;
}
function isSolidityType(type) {
    return (type === 'address' ||
        type === 'bool' ||
        type === 'function' ||
        type === 'string' ||
        bytesRegex$2.test(type) ||
        integerRegex$2.test(type));
}
const protectedKeywordsRegex = /^(?:after|alias|anonymous|apply|auto|byte|calldata|case|catch|constant|copyof|default|defined|error|event|external|false|final|function|immutable|implements|in|indexed|inline|internal|let|mapping|match|memory|mutable|null|of|override|partial|private|promise|public|pure|reference|relocatable|return|returns|sizeof|static|storage|struct|super|supports|switch|this|true|try|typedef|typeof|var|view|virtual)$/;
/** @internal */
function isSolidityKeyword(name) {
    return (name === 'address' ||
        name === 'bool' ||
        name === 'function' ||
        name === 'string' ||
        name === 'tuple' ||
        bytesRegex$2.test(name) ||
        integerRegex$2.test(name) ||
        protectedKeywordsRegex.test(name));
}
/** @internal */
function isValidDataLocation(type, isArray) {
    return isArray || type === 'bytes' || type === 'string' || type === 'tuple';
}

function parseStructs(signatures) {
    // Create "shallow" version of each struct (and filter out non-structs or invalid structs)
    const shallowStructs = {};
    const signaturesLength = signatures.length;
    for (let i = 0; i < signaturesLength; i++) {
        const signature = signatures[i];
        if (!isStructSignature(signature))
            continue;
        const match = execStructSignature(signature);
        if (!match)
            throw new InvalidSignatureError({ signature, type: 'struct' });
        const properties = match.properties.split(';');
        const components = [];
        const propertiesLength = properties.length;
        for (let k = 0; k < propertiesLength; k++) {
            const property = properties[k];
            const trimmed = property.trim();
            if (!trimmed)
                continue;
            const abiParameter = parseAbiParameter(trimmed, {
                type: 'struct',
            });
            components.push(abiParameter);
        }
        if (!components.length)
            throw new InvalidStructSignatureError({ signature });
        shallowStructs[match.name] = components;
    }
    // Resolve nested structs inside each parameter
    const resolvedStructs = {};
    const entries = Object.entries(shallowStructs);
    const entriesLength = entries.length;
    for (let i = 0; i < entriesLength; i++) {
        const [name, parameters] = entries[i];
        resolvedStructs[name] = resolveStructs(parameters, shallowStructs);
    }
    return resolvedStructs;
}
const typeWithoutTupleRegex = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*)(?<array>(?:\[\d*?\])+?)?$/;
function resolveStructs(abiParameters = [], structs = {}, ancestors = new Set()) {
    const components = [];
    const length = abiParameters.length;
    for (let i = 0; i < length; i++) {
        const abiParameter = abiParameters[i];
        const isTuple = isTupleRegex.test(abiParameter.type);
        if (isTuple)
            components.push(abiParameter);
        else {
            const match = execTyped(typeWithoutTupleRegex, abiParameter.type);
            if (!match?.type)
                throw new InvalidAbiTypeParameterError({ abiParameter });
            const { array, type } = match;
            if (type in structs) {
                if (ancestors.has(type))
                    throw new CircularReferenceError({ type });
                components.push({
                    ...abiParameter,
                    type: `tuple${array ?? ''}`,
                    components: resolveStructs(structs[type], structs, new Set([...ancestors, type])),
                });
            }
            else {
                if (isSolidityType(type))
                    components.push(abiParameter);
                else
                    throw new UnknownTypeError({ type });
            }
        }
    }
    return components;
}

/**
 * Parses human-readable ABI into JSON {@link Abi}
 *
 * @param signatures - Human-Readable ABI
 * @returns Parsed {@link Abi}
 *
 * @example
 * const abi = parseAbi([
 *   //  ^? const abi: readonly [{ name: "balanceOf"; type: "function"; stateMutability:...
 *   'function balanceOf(address owner) view returns (uint256)',
 *   'event Transfer(address indexed from, address indexed to, uint256 amount)',
 * ])
 */
function parseAbi(signatures) {
    const structs = parseStructs(signatures);
    const abi = [];
    const length = signatures.length;
    for (let i = 0; i < length; i++) {
        const signature = signatures[i];
        if (isStructSignature(signature))
            continue;
        abi.push(parseSignature(signature, structs));
    }
    return abi;
}

/**
 * Parses human-readable ABI item (e.g. error, event, function) into {@link Abi} item
 *
 * @param signature - Human-readable ABI item
 * @returns Parsed {@link Abi} item
 *
 * @example
 * const abiItem = parseAbiItem('function balanceOf(address owner) view returns (uint256)')
 * //    ^? const abiItem: { name: "balanceOf"; type: "function"; stateMutability: "view";...
 *
 * @example
 * const abiItem = parseAbiItem([
 *   //  ^? const abiItem: { name: "foo"; type: "function"; stateMutability: "view"; inputs:...
 *   'function foo(Baz bar) view returns (string)',
 *   'struct Baz { string name; }',
 * ])
 */
function parseAbiItem(signature) {
    let abiItem;
    if (typeof signature === 'string')
        abiItem = parseSignature(signature);
    else {
        const structs = parseStructs(signature);
        const length = signature.length;
        for (let i = 0; i < length; i++) {
            const signature_ = signature[i];
            if (isStructSignature(signature_))
                continue;
            abiItem = parseSignature(signature_, structs);
            break;
        }
    }
    if (!abiItem)
        throw new InvalidAbiItemError({ signature });
    return abiItem;
}

/**
 * Parses human-readable ABI parameters into {@link AbiParameter}s
 *
 * @param params - Human-readable ABI parameters
 * @returns Parsed {@link AbiParameter}s
 *
 * @example
 * const abiParameters = parseAbiParameters('address from, address to, uint256 amount')
 * //    ^? const abiParameters: [{ type: "address"; name: "from"; }, { type: "address";...
 *
 * @example
 * const abiParameters = parseAbiParameters([
 *   //  ^? const abiParameters: [{ type: "tuple"; components: [{ type: "string"; name:...
 *   'Baz bar',
 *   'struct Baz { string name; }',
 * ])
 */
function parseAbiParameters(params) {
    const abiParameters = [];
    if (typeof params === 'string') {
        const parameters = splitParameters(params);
        const length = parameters.length;
        for (let i = 0; i < length; i++) {
            abiParameters.push(parseAbiParameter(parameters[i], { modifiers }));
        }
    }
    else {
        const structs = parseStructs(params);
        const length = params.length;
        for (let i = 0; i < length; i++) {
            const signature = params[i];
            if (isStructSignature(signature))
                continue;
            const parameters = splitParameters(signature);
            const length = parameters.length;
            for (let k = 0; k < length; k++) {
                abiParameters.push(parseAbiParameter(parameters[k], { modifiers, structs }));
            }
        }
    }
    if (abiParameters.length === 0)
        throw new InvalidAbiParametersError({ params });
    return abiParameters;
}

/**
 * Retrieves and returns an action from the client (if exists), and falls
 * back to the tree-shakable action.
 *
 * Useful for extracting overridden actions from a client (ie. if a consumer
 * wants to override the `sendTransaction` implementation).
 */
function getAction(client, actionFn, 
// Some minifiers drop `Function.prototype.name`, or replace it with short letters,
// meaning that `actionFn.name` will not always work. For that case, the consumer
// needs to pass the name explicitly.
name) {
    const action_implicit = client[actionFn.name];
    if (typeof action_implicit === 'function')
        return action_implicit;
    const action_explicit = client[name];
    if (typeof action_explicit === 'function')
        return action_explicit;
    return (params) => actionFn(client, params);
}

function formatAbiItem(abiItem, { includeName = false } = {}) {
    if (abiItem.type !== 'function' &&
        abiItem.type !== 'event' &&
        abiItem.type !== 'error')
        throw new InvalidDefinitionTypeError(abiItem.type);
    return `${abiItem.name}(${formatAbiParams(abiItem.inputs, { includeName })})`;
}
function formatAbiParams(params, { includeName = false } = {}) {
    if (!params)
        return '';
    return params
        .map((param) => formatAbiParam(param, { includeName }))
        .join(includeName ? ', ' : ',');
}
function formatAbiParam(param, { includeName }) {
    if (param.type.startsWith('tuple')) {
        return `(${formatAbiParams(param.components, { includeName })})${param.type.slice('tuple'.length)}`;
    }
    return param.type + (includeName && param.name ? ` ${param.name}` : '');
}

function isHex(value, { strict = true } = {}) {
    if (!value)
        return false;
    if (typeof value !== 'string')
        return false;
    return strict ? /^0x[0-9a-fA-F]*$/.test(value) : value.startsWith('0x');
}

/**
 * @description Retrieves the size of the value (in bytes).
 *
 * @param value The value (hex or byte array) to retrieve the size of.
 * @returns The size of the value (in bytes).
 */
function size$3(value) {
    if (isHex(value, { strict: false }))
        return Math.ceil((value.length - 2) / 2);
    return value.length;
}

const version$1 = '2.46.3';

let errorConfig = {
    getDocsUrl: ({ docsBaseUrl, docsPath = '', docsSlug, }) => docsPath
        ? `${docsBaseUrl ?? 'https://viem.sh'}${docsPath}${docsSlug ? `#${docsSlug}` : ''}`
        : undefined,
    version: `viem@${version$1}`,
};
let BaseError$1 = class BaseError extends Error {
    constructor(shortMessage, args = {}) {
        const details = (() => {
            if (args.cause instanceof BaseError)
                return args.cause.details;
            if (args.cause?.message)
                return args.cause.message;
            return args.details;
        })();
        const docsPath = (() => {
            if (args.cause instanceof BaseError)
                return args.cause.docsPath || args.docsPath;
            return args.docsPath;
        })();
        const docsUrl = errorConfig.getDocsUrl?.({ ...args, docsPath });
        const message = [
            shortMessage || 'An error occurred.',
            '',
            ...(args.metaMessages ? [...args.metaMessages, ''] : []),
            ...(docsUrl ? [`Docs: ${docsUrl}`] : []),
            ...(details ? [`Details: ${details}`] : []),
            ...(errorConfig.version ? [`Version: ${errorConfig.version}`] : []),
        ].join('\n');
        super(message, args.cause ? { cause: args.cause } : undefined);
        Object.defineProperty(this, "details", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "docsPath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "metaMessages", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "shortMessage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "version", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'BaseError'
        });
        this.details = details;
        this.docsPath = docsPath;
        this.metaMessages = args.metaMessages;
        this.name = args.name ?? this.name;
        this.shortMessage = shortMessage;
        this.version = version$1;
    }
    walk(fn) {
        return walk$1(this, fn);
    }
};
function walk$1(err, fn) {
    if (fn?.(err))
        return err;
    if (err &&
        typeof err === 'object' &&
        'cause' in err &&
        err.cause !== undefined)
        return walk$1(err.cause, fn);
    return fn ? null : err;
}

class AbiConstructorNotFoundError extends BaseError$1 {
    constructor({ docsPath }) {
        super([
            'A constructor was not found on the ABI.',
            'Make sure you are using the correct ABI and that the constructor exists on it.',
        ].join('\n'), {
            docsPath,
            name: 'AbiConstructorNotFoundError',
        });
    }
}
class AbiConstructorParamsNotFoundError extends BaseError$1 {
    constructor({ docsPath }) {
        super([
            'Constructor arguments were provided (`args`), but a constructor parameters (`inputs`) were not found on the ABI.',
            'Make sure you are using the correct ABI, and that the `inputs` attribute on the constructor exists.',
        ].join('\n'), {
            docsPath,
            name: 'AbiConstructorParamsNotFoundError',
        });
    }
}
class AbiDecodingDataSizeTooSmallError extends BaseError$1 {
    constructor({ data, params, size, }) {
        super([`Data size of ${size} bytes is too small for given parameters.`].join('\n'), {
            metaMessages: [
                `Params: (${formatAbiParams(params, { includeName: true })})`,
                `Data:   ${data} (${size} bytes)`,
            ],
            name: 'AbiDecodingDataSizeTooSmallError',
        });
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "params", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "size", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.data = data;
        this.params = params;
        this.size = size;
    }
}
class AbiDecodingZeroDataError extends BaseError$1 {
    constructor() {
        super('Cannot decode zero data ("0x") with ABI parameters.', {
            name: 'AbiDecodingZeroDataError',
        });
    }
}
class AbiEncodingArrayLengthMismatchError extends BaseError$1 {
    constructor({ expectedLength, givenLength, type, }) {
        super([
            `ABI encoding array length mismatch for type ${type}.`,
            `Expected length: ${expectedLength}`,
            `Given length: ${givenLength}`,
        ].join('\n'), { name: 'AbiEncodingArrayLengthMismatchError' });
    }
}
class AbiEncodingBytesSizeMismatchError extends BaseError$1 {
    constructor({ expectedSize, value }) {
        super(`Size of bytes "${value}" (bytes${size$3(value)}) does not match expected size (bytes${expectedSize}).`, { name: 'AbiEncodingBytesSizeMismatchError' });
    }
}
class AbiEncodingLengthMismatchError extends BaseError$1 {
    constructor({ expectedLength, givenLength, }) {
        super([
            'ABI encoding params/values length mismatch.',
            `Expected length (params): ${expectedLength}`,
            `Given length (values): ${givenLength}`,
        ].join('\n'), { name: 'AbiEncodingLengthMismatchError' });
    }
}
class AbiErrorInputsNotFoundError extends BaseError$1 {
    constructor(errorName, { docsPath }) {
        super([
            `Arguments (\`args\`) were provided to "${errorName}", but "${errorName}" on the ABI does not contain any parameters (\`inputs\`).`,
            'Cannot encode error result without knowing what the parameter types are.',
            'Make sure you are using the correct ABI and that the inputs exist on it.',
        ].join('\n'), {
            docsPath,
            name: 'AbiErrorInputsNotFoundError',
        });
    }
}
class AbiErrorNotFoundError extends BaseError$1 {
    constructor(errorName, { docsPath } = {}) {
        super([
            `Error ${errorName ? `"${errorName}" ` : ''}not found on ABI.`,
            'Make sure you are using the correct ABI and that the error exists on it.',
        ].join('\n'), {
            docsPath,
            name: 'AbiErrorNotFoundError',
        });
    }
}
class AbiErrorSignatureNotFoundError extends BaseError$1 {
    constructor(signature, { docsPath }) {
        super([
            `Encoded error signature "${signature}" not found on ABI.`,
            'Make sure you are using the correct ABI and that the error exists on it.',
            `You can look up the decoded signature here: https://4byte.sourcify.dev/?q=${signature}.`,
        ].join('\n'), {
            docsPath,
            name: 'AbiErrorSignatureNotFoundError',
        });
        Object.defineProperty(this, "signature", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.signature = signature;
    }
}
class AbiEventSignatureEmptyTopicsError extends BaseError$1 {
    constructor({ docsPath }) {
        super('Cannot extract event signature from empty topics.', {
            docsPath,
            name: 'AbiEventSignatureEmptyTopicsError',
        });
    }
}
class AbiEventSignatureNotFoundError extends BaseError$1 {
    constructor(signature, { docsPath }) {
        super([
            `Encoded event signature "${signature}" not found on ABI.`,
            'Make sure you are using the correct ABI and that the event exists on it.',
            `You can look up the signature here: https://4byte.sourcify.dev/?q=${signature}.`,
        ].join('\n'), {
            docsPath,
            name: 'AbiEventSignatureNotFoundError',
        });
    }
}
class AbiEventNotFoundError extends BaseError$1 {
    constructor(eventName, { docsPath } = {}) {
        super([
            `Event ${eventName ? `"${eventName}" ` : ''}not found on ABI.`,
            'Make sure you are using the correct ABI and that the event exists on it.',
        ].join('\n'), {
            docsPath,
            name: 'AbiEventNotFoundError',
        });
    }
}
class AbiFunctionNotFoundError extends BaseError$1 {
    constructor(functionName, { docsPath } = {}) {
        super([
            `Function ${functionName ? `"${functionName}" ` : ''}not found on ABI.`,
            'Make sure you are using the correct ABI and that the function exists on it.',
        ].join('\n'), {
            docsPath,
            name: 'AbiFunctionNotFoundError',
        });
    }
}
class AbiFunctionOutputsNotFoundError extends BaseError$1 {
    constructor(functionName, { docsPath }) {
        super([
            `Function "${functionName}" does not contain any \`outputs\` on ABI.`,
            'Cannot decode function result without knowing what the parameter types are.',
            'Make sure you are using the correct ABI and that the function exists on it.',
        ].join('\n'), {
            docsPath,
            name: 'AbiFunctionOutputsNotFoundError',
        });
    }
}
class AbiFunctionSignatureNotFoundError extends BaseError$1 {
    constructor(signature, { docsPath }) {
        super([
            `Encoded function signature "${signature}" not found on ABI.`,
            'Make sure you are using the correct ABI and that the function exists on it.',
            `You can look up the signature here: https://4byte.sourcify.dev/?q=${signature}.`,
        ].join('\n'), {
            docsPath,
            name: 'AbiFunctionSignatureNotFoundError',
        });
    }
}
class AbiItemAmbiguityError extends BaseError$1 {
    constructor(x, y) {
        super('Found ambiguous types in overloaded ABI items.', {
            metaMessages: [
                `\`${x.type}\` in \`${formatAbiItem(x.abiItem)}\`, and`,
                `\`${y.type}\` in \`${formatAbiItem(y.abiItem)}\``,
                '',
                'These types encode differently and cannot be distinguished at runtime.',
                'Remove one of the ambiguous items in the ABI.',
            ],
            name: 'AbiItemAmbiguityError',
        });
    }
}
let BytesSizeMismatchError$1 = class BytesSizeMismatchError extends BaseError$1 {
    constructor({ expectedSize, givenSize, }) {
        super(`Expected bytes${expectedSize}, got bytes${givenSize}.`, {
            name: 'BytesSizeMismatchError',
        });
    }
};
class DecodeLogDataMismatch extends BaseError$1 {
    constructor({ abiItem, data, params, size, }) {
        super([
            `Data size of ${size} bytes is too small for non-indexed event parameters.`,
        ].join('\n'), {
            metaMessages: [
                `Params: (${formatAbiParams(params, { includeName: true })})`,
                `Data:   ${data} (${size} bytes)`,
            ],
            name: 'DecodeLogDataMismatch',
        });
        Object.defineProperty(this, "abiItem", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "params", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "size", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.abiItem = abiItem;
        this.data = data;
        this.params = params;
        this.size = size;
    }
}
class DecodeLogTopicsMismatch extends BaseError$1 {
    constructor({ abiItem, param, }) {
        super([
            `Expected a topic for indexed event parameter${param.name ? ` "${param.name}"` : ''} on event "${formatAbiItem(abiItem, { includeName: true })}".`,
        ].join('\n'), { name: 'DecodeLogTopicsMismatch' });
        Object.defineProperty(this, "abiItem", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.abiItem = abiItem;
    }
}
class InvalidAbiEncodingTypeError extends BaseError$1 {
    constructor(type, { docsPath }) {
        super([
            `Type "${type}" is not a valid encoding type.`,
            'Please provide a valid ABI type.',
        ].join('\n'), { docsPath, name: 'InvalidAbiEncodingType' });
    }
}
class InvalidAbiDecodingTypeError extends BaseError$1 {
    constructor(type, { docsPath }) {
        super([
            `Type "${type}" is not a valid decoding type.`,
            'Please provide a valid ABI type.',
        ].join('\n'), { docsPath, name: 'InvalidAbiDecodingType' });
    }
}
let InvalidArrayError$1 = class InvalidArrayError extends BaseError$1 {
    constructor(value) {
        super([`Value "${value}" is not a valid array.`].join('\n'), {
            name: 'InvalidArrayError',
        });
    }
};
class InvalidDefinitionTypeError extends BaseError$1 {
    constructor(type) {
        super([
            `"${type}" is not a valid definition type.`,
            'Valid types: "function", "event", "error"',
        ].join('\n'), { name: 'InvalidDefinitionTypeError' });
    }
}

class FilterTypeNotSupportedError extends BaseError$1 {
    constructor(type) {
        super(`Filter type "${type}" is not supported.`, {
            name: 'FilterTypeNotSupportedError',
        });
    }
}

let SliceOffsetOutOfBoundsError$1 = class SliceOffsetOutOfBoundsError extends BaseError$1 {
    constructor({ offset, position, size, }) {
        super(`Slice ${position === 'start' ? 'starting' : 'ending'} at offset "${offset}" is out-of-bounds (size: ${size}).`, { name: 'SliceOffsetOutOfBoundsError' });
    }
};
let SizeExceedsPaddingSizeError$2 = class SizeExceedsPaddingSizeError extends BaseError$1 {
    constructor({ size, targetSize, type, }) {
        super(`${type.charAt(0).toUpperCase()}${type
            .slice(1)
            .toLowerCase()} size (${size}) exceeds padding size (${targetSize}).`, { name: 'SizeExceedsPaddingSizeError' });
    }
};
class InvalidBytesLengthError extends BaseError$1 {
    constructor({ size, targetSize, type, }) {
        super(`${type.charAt(0).toUpperCase()}${type
            .slice(1)
            .toLowerCase()} is expected to be ${targetSize} ${type} long, but is ${size} ${type} long.`, { name: 'InvalidBytesLengthError' });
    }
}

function pad$2(hexOrBytes, { dir, size = 32 } = {}) {
    if (typeof hexOrBytes === 'string')
        return padHex(hexOrBytes, { dir, size });
    return padBytes(hexOrBytes, { dir, size });
}
function padHex(hex_, { dir, size = 32 } = {}) {
    if (size === null)
        return hex_;
    const hex = hex_.replace('0x', '');
    if (hex.length > size * 2)
        throw new SizeExceedsPaddingSizeError$2({
            size: Math.ceil(hex.length / 2),
            targetSize: size,
            type: 'hex',
        });
    return `0x${hex[dir === 'right' ? 'padEnd' : 'padStart'](size * 2, '0')}`;
}
function padBytes(bytes, { dir, size = 32 } = {}) {
    if (size === null)
        return bytes;
    if (bytes.length > size)
        throw new SizeExceedsPaddingSizeError$2({
            size: bytes.length,
            targetSize: size,
            type: 'bytes',
        });
    const paddedBytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
        const padEnd = dir === 'right';
        paddedBytes[padEnd ? i : size - i - 1] =
            bytes[padEnd ? i : bytes.length - i - 1];
    }
    return paddedBytes;
}

let IntegerOutOfRangeError$1 = class IntegerOutOfRangeError extends BaseError$1 {
    constructor({ max, min, signed, size, value, }) {
        super(`Number "${value}" is not in safe ${size ? `${size * 8}-bit ${signed ? 'signed' : 'unsigned'} ` : ''}integer range ${max ? `(${min} to ${max})` : `(above ${min})`}`, { name: 'IntegerOutOfRangeError' });
    }
};
let InvalidBytesBooleanError$1 = class InvalidBytesBooleanError extends BaseError$1 {
    constructor(bytes) {
        super(`Bytes value "${bytes}" is not a valid boolean. The bytes array must contain a single byte of either a 0 or 1 value.`, {
            name: 'InvalidBytesBooleanError',
        });
    }
};
class InvalidHexBooleanError extends BaseError$1 {
    constructor(hex) {
        super(`Hex value "${hex}" is not a valid boolean. The hex value must be "0x0" (false) or "0x1" (true).`, { name: 'InvalidHexBooleanError' });
    }
}
let SizeOverflowError$2 = class SizeOverflowError extends BaseError$1 {
    constructor({ givenSize, maxSize }) {
        super(`Size cannot exceed ${maxSize} bytes. Given size: ${givenSize} bytes.`, { name: 'SizeOverflowError' });
    }
};

function trim$1(hexOrBytes, { dir = 'left' } = {}) {
    let data = typeof hexOrBytes === 'string' ? hexOrBytes.replace('0x', '') : hexOrBytes;
    let sliceLength = 0;
    for (let i = 0; i < data.length - 1; i++) {
        if (data[dir === 'left' ? i : data.length - i - 1].toString() === '0')
            sliceLength++;
        else
            break;
    }
    data =
        dir === 'left'
            ? data.slice(sliceLength)
            : data.slice(0, data.length - sliceLength);
    if (typeof hexOrBytes === 'string') {
        if (data.length === 1 && dir === 'right')
            data = `${data}0`;
        return `0x${data.length % 2 === 1 ? `0${data}` : data}`;
    }
    return data;
}

function assertSize$2(hexOrBytes, { size }) {
    if (size$3(hexOrBytes) > size)
        throw new SizeOverflowError$2({
            givenSize: size$3(hexOrBytes),
            maxSize: size,
        });
}
/**
 * Decodes a hex value into a bigint.
 *
 * - Docs: https://viem.sh/docs/utilities/fromHex#hextobigint
 *
 * @param hex Hex value to decode.
 * @param opts Options.
 * @returns BigInt value.
 *
 * @example
 * import { hexToBigInt } from 'viem'
 * const data = hexToBigInt('0x1a4', { signed: true })
 * // 420n
 *
 * @example
 * import { hexToBigInt } from 'viem'
 * const data = hexToBigInt('0x00000000000000000000000000000000000000000000000000000000000001a4', { size: 32 })
 * // 420n
 */
function hexToBigInt(hex, opts = {}) {
    const { signed } = opts;
    if (opts.size)
        assertSize$2(hex, { size: opts.size });
    const value = BigInt(hex);
    if (!signed)
        return value;
    const size = (hex.length - 2) / 2;
    const max = (1n << (BigInt(size) * 8n - 1n)) - 1n;
    if (value <= max)
        return value;
    return value - BigInt(`0x${'f'.padStart(size * 2, 'f')}`) - 1n;
}
/**
 * Decodes a hex value into a boolean.
 *
 * - Docs: https://viem.sh/docs/utilities/fromHex#hextobool
 *
 * @param hex Hex value to decode.
 * @param opts Options.
 * @returns Boolean value.
 *
 * @example
 * import { hexToBool } from 'viem'
 * const data = hexToBool('0x01')
 * // true
 *
 * @example
 * import { hexToBool } from 'viem'
 * const data = hexToBool('0x0000000000000000000000000000000000000000000000000000000000000001', { size: 32 })
 * // true
 */
function hexToBool(hex_, opts = {}) {
    let hex = hex_;
    if (opts.size) {
        assertSize$2(hex, { size: opts.size });
        hex = trim$1(hex);
    }
    if (trim$1(hex) === '0x00')
        return false;
    if (trim$1(hex) === '0x01')
        return true;
    throw new InvalidHexBooleanError(hex);
}
/**
 * Decodes a hex string into a number.
 *
 * - Docs: https://viem.sh/docs/utilities/fromHex#hextonumber
 *
 * @param hex Hex value to decode.
 * @param opts Options.
 * @returns Number value.
 *
 * @example
 * import { hexToNumber } from 'viem'
 * const data = hexToNumber('0x1a4')
 * // 420
 *
 * @example
 * import { hexToNumber } from 'viem'
 * const data = hexToBigInt('0x00000000000000000000000000000000000000000000000000000000000001a4', { size: 32 })
 * // 420
 */
function hexToNumber$1(hex, opts = {}) {
    const value = hexToBigInt(hex, opts);
    const number = Number(value);
    if (!Number.isSafeInteger(number))
        throw new IntegerOutOfRangeError$1({
            max: `${Number.MAX_SAFE_INTEGER}`,
            min: `${Number.MIN_SAFE_INTEGER}`,
            signed: opts.signed,
            size: opts.size,
            value: `${value}n`,
        });
    return number;
}

const hexes$2 = /*#__PURE__*/ Array.from({ length: 256 }, (_v, i) => i.toString(16).padStart(2, '0'));
/**
 * Encodes a string, number, bigint, or ByteArray into a hex string
 *
 * - Docs: https://viem.sh/docs/utilities/toHex
 * - Example: https://viem.sh/docs/utilities/toHex#usage
 *
 * @param value Value to encode.
 * @param opts Options.
 * @returns Hex value.
 *
 * @example
 * import { toHex } from 'viem'
 * const data = toHex('Hello world')
 * // '0x48656c6c6f20776f726c6421'
 *
 * @example
 * import { toHex } from 'viem'
 * const data = toHex(420)
 * // '0x1a4'
 *
 * @example
 * import { toHex } from 'viem'
 * const data = toHex('Hello world', { size: 32 })
 * // '0x48656c6c6f20776f726c64210000000000000000000000000000000000000000'
 */
function toHex(value, opts = {}) {
    if (typeof value === 'number' || typeof value === 'bigint')
        return numberToHex(value, opts);
    if (typeof value === 'string') {
        return stringToHex(value, opts);
    }
    if (typeof value === 'boolean')
        return boolToHex(value, opts);
    return bytesToHex$1(value, opts);
}
/**
 * Encodes a boolean into a hex string
 *
 * - Docs: https://viem.sh/docs/utilities/toHex#booltohex
 *
 * @param value Value to encode.
 * @param opts Options.
 * @returns Hex value.
 *
 * @example
 * import { boolToHex } from 'viem'
 * const data = boolToHex(true)
 * // '0x1'
 *
 * @example
 * import { boolToHex } from 'viem'
 * const data = boolToHex(false)
 * // '0x0'
 *
 * @example
 * import { boolToHex } from 'viem'
 * const data = boolToHex(true, { size: 32 })
 * // '0x0000000000000000000000000000000000000000000000000000000000000001'
 */
function boolToHex(value, opts = {}) {
    const hex = `0x${Number(value)}`;
    if (typeof opts.size === 'number') {
        assertSize$2(hex, { size: opts.size });
        return pad$2(hex, { size: opts.size });
    }
    return hex;
}
/**
 * Encodes a bytes array into a hex string
 *
 * - Docs: https://viem.sh/docs/utilities/toHex#bytestohex
 *
 * @param value Value to encode.
 * @param opts Options.
 * @returns Hex value.
 *
 * @example
 * import { bytesToHex } from 'viem'
 * const data = bytesToHex(Uint8Array.from([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])
 * // '0x48656c6c6f20576f726c6421'
 *
 * @example
 * import { bytesToHex } from 'viem'
 * const data = bytesToHex(Uint8Array.from([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]), { size: 32 })
 * // '0x48656c6c6f20576f726c64210000000000000000000000000000000000000000'
 */
function bytesToHex$1(value, opts = {}) {
    let string = '';
    for (let i = 0; i < value.length; i++) {
        string += hexes$2[value[i]];
    }
    const hex = `0x${string}`;
    if (typeof opts.size === 'number') {
        assertSize$2(hex, { size: opts.size });
        return pad$2(hex, { dir: 'right', size: opts.size });
    }
    return hex;
}
/**
 * Encodes a number or bigint into a hex string
 *
 * - Docs: https://viem.sh/docs/utilities/toHex#numbertohex
 *
 * @param value Value to encode.
 * @param opts Options.
 * @returns Hex value.
 *
 * @example
 * import { numberToHex } from 'viem'
 * const data = numberToHex(420)
 * // '0x1a4'
 *
 * @example
 * import { numberToHex } from 'viem'
 * const data = numberToHex(420, { size: 32 })
 * // '0x00000000000000000000000000000000000000000000000000000000000001a4'
 */
function numberToHex(value_, opts = {}) {
    const { signed, size } = opts;
    const value = BigInt(value_);
    let maxValue;
    if (size) {
        if (signed)
            maxValue = (1n << (BigInt(size) * 8n - 1n)) - 1n;
        else
            maxValue = 2n ** (BigInt(size) * 8n) - 1n;
    }
    else if (typeof value_ === 'number') {
        maxValue = BigInt(Number.MAX_SAFE_INTEGER);
    }
    const minValue = typeof maxValue === 'bigint' && signed ? -maxValue - 1n : 0;
    if ((maxValue && value > maxValue) || value < minValue) {
        const suffix = typeof value_ === 'bigint' ? 'n' : '';
        throw new IntegerOutOfRangeError$1({
            max: maxValue ? `${maxValue}${suffix}` : undefined,
            min: `${minValue}${suffix}`,
            signed,
            size,
            value: `${value_}${suffix}`,
        });
    }
    const hex = `0x${(signed && value < 0 ? (1n << BigInt(size * 8)) + BigInt(value) : value).toString(16)}`;
    if (size)
        return pad$2(hex, { size });
    return hex;
}
const encoder$3 = /*#__PURE__*/ new TextEncoder();
/**
 * Encodes a UTF-8 string into a hex string
 *
 * - Docs: https://viem.sh/docs/utilities/toHex#stringtohex
 *
 * @param value Value to encode.
 * @param opts Options.
 * @returns Hex value.
 *
 * @example
 * import { stringToHex } from 'viem'
 * const data = stringToHex('Hello World!')
 * // '0x48656c6c6f20576f726c6421'
 *
 * @example
 * import { stringToHex } from 'viem'
 * const data = stringToHex('Hello World!', { size: 32 })
 * // '0x48656c6c6f20576f726c64210000000000000000000000000000000000000000'
 */
function stringToHex(value_, opts = {}) {
    const value = encoder$3.encode(value_);
    return bytesToHex$1(value, opts);
}

const encoder$2 = /*#__PURE__*/ new TextEncoder();
/**
 * Encodes a UTF-8 string, hex value, bigint, number or boolean to a byte array.
 *
 * - Docs: https://viem.sh/docs/utilities/toBytes
 * - Example: https://viem.sh/docs/utilities/toBytes#usage
 *
 * @param value Value to encode.
 * @param opts Options.
 * @returns Byte array value.
 *
 * @example
 * import { toBytes } from 'viem'
 * const data = toBytes('Hello world')
 * // Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])
 *
 * @example
 * import { toBytes } from 'viem'
 * const data = toBytes(420)
 * // Uint8Array([1, 164])
 *
 * @example
 * import { toBytes } from 'viem'
 * const data = toBytes(420, { size: 4 })
 * // Uint8Array([0, 0, 1, 164])
 */
function toBytes$2(value, opts = {}) {
    if (typeof value === 'number' || typeof value === 'bigint')
        return numberToBytes(value, opts);
    if (typeof value === 'boolean')
        return boolToBytes(value, opts);
    if (isHex(value))
        return hexToBytes$1(value, opts);
    return stringToBytes(value, opts);
}
/**
 * Encodes a boolean into a byte array.
 *
 * - Docs: https://viem.sh/docs/utilities/toBytes#booltobytes
 *
 * @param value Boolean value to encode.
 * @param opts Options.
 * @returns Byte array value.
 *
 * @example
 * import { boolToBytes } from 'viem'
 * const data = boolToBytes(true)
 * // Uint8Array([1])
 *
 * @example
 * import { boolToBytes } from 'viem'
 * const data = boolToBytes(true, { size: 32 })
 * // Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
 */
function boolToBytes(value, opts = {}) {
    const bytes = new Uint8Array(1);
    bytes[0] = Number(value);
    if (typeof opts.size === 'number') {
        assertSize$2(bytes, { size: opts.size });
        return pad$2(bytes, { size: opts.size });
    }
    return bytes;
}
// We use very optimized technique to convert hex string to byte array
const charCodeMap$1 = {
    zero: 48,
    nine: 57,
    A: 65,
    F: 70,
    a: 97,
    f: 102,
};
function charCodeToBase16$1(char) {
    if (char >= charCodeMap$1.zero && char <= charCodeMap$1.nine)
        return char - charCodeMap$1.zero;
    if (char >= charCodeMap$1.A && char <= charCodeMap$1.F)
        return char - (charCodeMap$1.A - 10);
    if (char >= charCodeMap$1.a && char <= charCodeMap$1.f)
        return char - (charCodeMap$1.a - 10);
    return undefined;
}
/**
 * Encodes a hex string into a byte array.
 *
 * - Docs: https://viem.sh/docs/utilities/toBytes#hextobytes
 *
 * @param hex Hex string to encode.
 * @param opts Options.
 * @returns Byte array value.
 *
 * @example
 * import { hexToBytes } from 'viem'
 * const data = hexToBytes('0x48656c6c6f20776f726c6421')
 * // Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])
 *
 * @example
 * import { hexToBytes } from 'viem'
 * const data = hexToBytes('0x48656c6c6f20776f726c6421', { size: 32 })
 * // Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
 */
function hexToBytes$1(hex_, opts = {}) {
    let hex = hex_;
    if (opts.size) {
        assertSize$2(hex, { size: opts.size });
        hex = pad$2(hex, { dir: 'right', size: opts.size });
    }
    let hexString = hex.slice(2);
    if (hexString.length % 2)
        hexString = `0${hexString}`;
    const length = hexString.length / 2;
    const bytes = new Uint8Array(length);
    for (let index = 0, j = 0; index < length; index++) {
        const nibbleLeft = charCodeToBase16$1(hexString.charCodeAt(j++));
        const nibbleRight = charCodeToBase16$1(hexString.charCodeAt(j++));
        if (nibbleLeft === undefined || nibbleRight === undefined) {
            throw new BaseError$1(`Invalid byte sequence ("${hexString[j - 2]}${hexString[j - 1]}" in "${hexString}").`);
        }
        bytes[index] = nibbleLeft * 16 + nibbleRight;
    }
    return bytes;
}
/**
 * Encodes a number into a byte array.
 *
 * - Docs: https://viem.sh/docs/utilities/toBytes#numbertobytes
 *
 * @param value Number to encode.
 * @param opts Options.
 * @returns Byte array value.
 *
 * @example
 * import { numberToBytes } from 'viem'
 * const data = numberToBytes(420)
 * // Uint8Array([1, 164])
 *
 * @example
 * import { numberToBytes } from 'viem'
 * const data = numberToBytes(420, { size: 4 })
 * // Uint8Array([0, 0, 1, 164])
 */
function numberToBytes(value, opts) {
    const hex = numberToHex(value, opts);
    return hexToBytes$1(hex);
}
/**
 * Encodes a UTF-8 string into a byte array.
 *
 * - Docs: https://viem.sh/docs/utilities/toBytes#stringtobytes
 *
 * @param value String to encode.
 * @param opts Options.
 * @returns Byte array value.
 *
 * @example
 * import { stringToBytes } from 'viem'
 * const data = stringToBytes('Hello world!')
 * // Uint8Array([72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 33])
 *
 * @example
 * import { stringToBytes } from 'viem'
 * const data = stringToBytes('Hello world!', { size: 32 })
 * // Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
 */
function stringToBytes(value, opts = {}) {
    const bytes = encoder$2.encode(value);
    if (typeof opts.size === 'number') {
        assertSize$2(bytes, { size: opts.size });
        return pad$2(bytes, { dir: 'right', size: opts.size });
    }
    return bytes;
}

/**
 * Internal helpers for u64. BigUint64Array is too slow as per 2025, so we implement it using Uint32Array.
 * @todo re-check https://issues.chromium.org/issues/42212588
 * @module
 */
const U32_MASK64$1 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
const _32n$1 = /* @__PURE__ */ BigInt(32);
function fromBig$1(n, le = false) {
    if (le)
        return { h: Number(n & U32_MASK64$1), l: Number((n >> _32n$1) & U32_MASK64$1) };
    return { h: Number((n >> _32n$1) & U32_MASK64$1) | 0, l: Number(n & U32_MASK64$1) | 0 };
}
function split$1(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i = 0; i < len; i++) {
        const { h, l } = fromBig$1(lst[i], le);
        [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
}
// Left rotate for Shift in [1, 32)
const rotlSH$1 = (h, l, s) => (h << s) | (l >>> (32 - s));
const rotlSL$1 = (h, l, s) => (l << s) | (h >>> (32 - s));
// Left rotate for Shift in (32, 64), NOTE: 32 is special case.
const rotlBH$1 = (h, l, s) => (l << (s - 32)) | (h >>> (64 - s));
const rotlBL$1 = (h, l, s) => (h << (s - 32)) | (l >>> (64 - s));

const crypto = typeof globalThis === 'object' && 'crypto' in globalThis ? globalThis.crypto : undefined;

/**
 * Utilities for hex, bytes, CSPRNG.
 * @module
 */
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
// node.js versions earlier than v19 don't declare it in global scope.
// For node.js, package.json#exports field mapping rewrites import
// from `crypto` to `cryptoNode`, which imports native module.
// Makes the utils un-importable in browsers without a bundler.
// Once node.js 18 is deprecated (2025-04-30), we can just drop the import.
/** Checks if something is Uint8Array. Be careful: nodejs Buffer will return true. */
function isBytes$2(a) {
    return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
}
/** Asserts something is positive integer. */
function anumber$1(n) {
    if (!Number.isSafeInteger(n) || n < 0)
        throw new Error('positive integer expected, got ' + n);
}
/** Asserts something is Uint8Array. */
function abytes$2(b, ...lengths) {
    if (!isBytes$2(b))
        throw new Error('Uint8Array expected');
    if (lengths.length > 0 && !lengths.includes(b.length))
        throw new Error('Uint8Array expected of length ' + lengths + ', got length=' + b.length);
}
/** Asserts something is hash */
function ahash(h) {
    if (typeof h !== 'function' || typeof h.create !== 'function')
        throw new Error('Hash should be wrapped by utils.createHasher');
    anumber$1(h.outputLen);
    anumber$1(h.blockLen);
}
/** Asserts a hash instance has not been destroyed / finished */
function aexists$1(instance, checkFinished = true) {
    if (instance.destroyed)
        throw new Error('Hash instance has been destroyed');
    if (checkFinished && instance.finished)
        throw new Error('Hash#digest() has already been called');
}
/** Asserts output is properly-sized byte array */
function aoutput$1(out, instance) {
    abytes$2(out);
    const min = instance.outputLen;
    if (out.length < min) {
        throw new Error('digestInto() expects output buffer of length at least ' + min);
    }
}
/** Cast u8 / u16 / u32 to u32. */
function u32$1(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
/** Zeroize a byte array. Warning: JS provides no guarantees. */
function clean$1(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
        arrays[i].fill(0);
    }
}
/** Create DataView of an array for easy byte-level manipulation. */
function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
/** The rotate right (circular right shift) operation for uint32 */
function rotr(word, shift) {
    return (word << (32 - shift)) | (word >>> shift);
}
/** Is current platform little-endian? Most are. Big-Endian platform: IBM */
const isLE$1 = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();
/** The byte swap operation for uint32 */
function byteSwap$1(word) {
    return (((word << 24) & 0xff000000) |
        ((word << 8) & 0xff0000) |
        ((word >>> 8) & 0xff00) |
        ((word >>> 24) & 0xff));
}
/** In place byte swap for Uint32Array */
function byteSwap32$1(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = byteSwap$1(arr[i]);
    }
    return arr;
}
const swap32IfBE$1 = isLE$1
    ? (u) => u
    : byteSwap32$1;
/**
 * Converts string to bytes using UTF8 encoding.
 * @example utf8ToBytes('abc') // Uint8Array.from([97, 98, 99])
 */
function utf8ToBytes$1(str) {
    if (typeof str !== 'string')
        throw new Error('string expected');
    return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
}
/**
 * Normalizes (non-hex) string or Uint8Array to Uint8Array.
 * Warning: when Uint8Array is passed, it would NOT get copied.
 * Keep in mind for future mutable operations.
 */
function toBytes$1(data) {
    if (typeof data === 'string')
        data = utf8ToBytes$1(data);
    abytes$2(data);
    return data;
}
/** Copies several Uint8Arrays into one. */
function concatBytes$2(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
        const a = arrays[i];
        abytes$2(a);
        sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const a = arrays[i];
        res.set(a, pad);
        pad += a.length;
    }
    return res;
}
/** For runtime check if class implements interface */
let Hash$1 = class Hash {
};
/** Wraps hash function, creating an interface on top of it */
function createHasher$1(hashCons) {
    const hashC = (msg) => hashCons().update(toBytes$1(msg)).digest();
    const tmp = hashCons();
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = () => hashCons();
    return hashC;
}
/** Cryptographically secure PRNG. Uses internal OS-level `crypto.getRandomValues`. */
function randomBytes(bytesLength = 32) {
    if (crypto && typeof crypto.getRandomValues === 'function') {
        return crypto.getRandomValues(new Uint8Array(bytesLength));
    }
    // Legacy Node.js compatibility
    if (crypto && typeof crypto.randomBytes === 'function') {
        return Uint8Array.from(crypto.randomBytes(bytesLength));
    }
    throw new Error('crypto.getRandomValues must be defined');
}

/**
 * SHA3 (keccak) hash function, based on a new "Sponge function" design.
 * Different from older hashes, the internal state is bigger than output size.
 *
 * Check out [FIPS-202](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf),
 * [Website](https://keccak.team/keccak.html),
 * [the differences between SHA-3 and Keccak](https://crypto.stackexchange.com/questions/15727/what-are-the-key-differences-between-the-draft-sha-3-standard-and-the-keccak-sub).
 *
 * Check out `sha3-addons` module for cSHAKE, k12, and others.
 * @module
 */
// No __PURE__ annotations in sha3 header:
// EVERYTHING is in fact used on every export.
// Various per round constants calculations
const _0n$6 = BigInt(0);
const _1n$6 = BigInt(1);
const _2n$3 = BigInt(2);
const _7n$1 = BigInt(7);
const _256n$1 = BigInt(256);
const _0x71n$1 = BigInt(0x71);
const SHA3_PI$1 = [];
const SHA3_ROTL$1 = [];
const _SHA3_IOTA$1 = [];
for (let round = 0, R = _1n$6, x = 1, y = 0; round < 24; round++) {
    // Pi
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI$1.push(2 * (5 * y + x));
    // Rotational
    SHA3_ROTL$1.push((((round + 1) * (round + 2)) / 2) % 64);
    // Iota
    let t = _0n$6;
    for (let j = 0; j < 7; j++) {
        R = ((R << _1n$6) ^ ((R >> _7n$1) * _0x71n$1)) % _256n$1;
        if (R & _2n$3)
            t ^= _1n$6 << ((_1n$6 << /* @__PURE__ */ BigInt(j)) - _1n$6);
    }
    _SHA3_IOTA$1.push(t);
}
const IOTAS$1 = split$1(_SHA3_IOTA$1, true);
const SHA3_IOTA_H$1 = IOTAS$1[0];
const SHA3_IOTA_L$1 = IOTAS$1[1];
// Left rotation (without 0, 32, 64)
const rotlH$1 = (h, l, s) => (s > 32 ? rotlBH$1(h, l, s) : rotlSH$1(h, l, s));
const rotlL$1 = (h, l, s) => (s > 32 ? rotlBL$1(h, l, s) : rotlSL$1(h, l, s));
/** `keccakf1600` internal function, additionally allows to adjust round count. */
function keccakP$1(s, rounds = 24) {
    const B = new Uint32Array(5 * 2);
    // NOTE: all indices are x2 since we store state as u32 instead of u64 (bigints to slow in js)
    for (let round = 24 - rounds; round < 24; round++) {
        // Theta θ
        for (let x = 0; x < 10; x++)
            B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
        for (let x = 0; x < 10; x += 2) {
            const idx1 = (x + 8) % 10;
            const idx0 = (x + 2) % 10;
            const B0 = B[idx0];
            const B1 = B[idx0 + 1];
            const Th = rotlH$1(B0, B1, 1) ^ B[idx1];
            const Tl = rotlL$1(B0, B1, 1) ^ B[idx1 + 1];
            for (let y = 0; y < 50; y += 10) {
                s[x + y] ^= Th;
                s[x + y + 1] ^= Tl;
            }
        }
        // Rho (ρ) and Pi (π)
        let curH = s[2];
        let curL = s[3];
        for (let t = 0; t < 24; t++) {
            const shift = SHA3_ROTL$1[t];
            const Th = rotlH$1(curH, curL, shift);
            const Tl = rotlL$1(curH, curL, shift);
            const PI = SHA3_PI$1[t];
            curH = s[PI];
            curL = s[PI + 1];
            s[PI] = Th;
            s[PI + 1] = Tl;
        }
        // Chi (χ)
        for (let y = 0; y < 50; y += 10) {
            for (let x = 0; x < 10; x++)
                B[x] = s[y + x];
            for (let x = 0; x < 10; x++)
                s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
        }
        // Iota (ι)
        s[0] ^= SHA3_IOTA_H$1[round];
        s[1] ^= SHA3_IOTA_L$1[round];
    }
    clean$1(B);
}
/** Keccak sponge function. */
let Keccak$1 = class Keccak extends Hash$1 {
    // NOTE: we accept arguments in bytes instead of bits here.
    constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        super();
        this.pos = 0;
        this.posOut = 0;
        this.finished = false;
        this.destroyed = false;
        this.enableXOF = false;
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.rounds = rounds;
        // Can be passed from user as dkLen
        anumber$1(outputLen);
        // 1600 = 5x5 matrix of 64bit.  1600 bits === 200 bytes
        // 0 < blockLen < 200
        if (!(0 < blockLen && blockLen < 200))
            throw new Error('only keccak-f1600 function is supported');
        this.state = new Uint8Array(200);
        this.state32 = u32$1(this.state);
    }
    clone() {
        return this._cloneInto();
    }
    keccak() {
        swap32IfBE$1(this.state32);
        keccakP$1(this.state32, this.rounds);
        swap32IfBE$1(this.state32);
        this.posOut = 0;
        this.pos = 0;
    }
    update(data) {
        aexists$1(this);
        data = toBytes$1(data);
        abytes$2(data);
        const { blockLen, state } = this;
        const len = data.length;
        for (let pos = 0; pos < len;) {
            const take = Math.min(blockLen - this.pos, len - pos);
            for (let i = 0; i < take; i++)
                state[this.pos++] ^= data[pos++];
            if (this.pos === blockLen)
                this.keccak();
        }
        return this;
    }
    finish() {
        if (this.finished)
            return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        // Do the padding
        state[pos] ^= suffix;
        if ((suffix & 0x80) !== 0 && pos === blockLen - 1)
            this.keccak();
        state[blockLen - 1] ^= 0x80;
        this.keccak();
    }
    writeInto(out) {
        aexists$1(this, false);
        abytes$2(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len;) {
            if (this.posOut >= blockLen)
                this.keccak();
            const take = Math.min(blockLen - this.posOut, len - pos);
            out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
            this.posOut += take;
            pos += take;
        }
        return out;
    }
    xofInto(out) {
        // Sha3/Keccak usage with XOF is probably mistake, only SHAKE instances can do XOF
        if (!this.enableXOF)
            throw new Error('XOF is not possible for this instance');
        return this.writeInto(out);
    }
    xof(bytes) {
        anumber$1(bytes);
        return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
        aoutput$1(out, this);
        if (this.finished)
            throw new Error('digest() was already called');
        this.writeInto(out);
        this.destroy();
        return out;
    }
    digest() {
        return this.digestInto(new Uint8Array(this.outputLen));
    }
    destroy() {
        this.destroyed = true;
        clean$1(this.state);
    }
    _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to || (to = new Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        // Suffix can change in cSHAKE
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        to.destroyed = this.destroyed;
        return to;
    }
};
const gen$1 = (suffix, blockLen, outputLen) => createHasher$1(() => new Keccak$1(blockLen, suffix, outputLen));
/** keccak-256 hash function. Different from SHA3-256. */
const keccak_256$1 = /* @__PURE__ */ (() => gen$1(0x01, 136, 256 / 8))();

function keccak256$1(value, to_) {
    const to = to_ || 'hex';
    const bytes = keccak_256$1(isHex(value, { strict: false }) ? toBytes$2(value) : value);
    if (to === 'bytes')
        return bytes;
    return toHex(bytes);
}

const hash = (value) => keccak256$1(toBytes$2(value));
function hashSignature(sig) {
    return hash(sig);
}

function normalizeSignature$1(signature) {
    let active = true;
    let current = '';
    let level = 0;
    let result = '';
    let valid = false;
    for (let i = 0; i < signature.length; i++) {
        const char = signature[i];
        // If the character is a separator, we want to reactivate.
        if (['(', ')', ','].includes(char))
            active = true;
        // If the character is a "level" token, we want to increment/decrement.
        if (char === '(')
            level++;
        if (char === ')')
            level--;
        // If we aren't active, we don't want to mutate the result.
        if (!active)
            continue;
        // If level === 0, we are at the definition level.
        if (level === 0) {
            if (char === ' ' && ['event', 'function', ''].includes(result))
                result = '';
            else {
                result += char;
                // If we are at the end of the definition, we must be finished.
                if (char === ')') {
                    valid = true;
                    break;
                }
            }
            continue;
        }
        // Ignore spaces
        if (char === ' ') {
            // If the previous character is a separator, and the current section isn't empty, we want to deactivate.
            if (signature[i - 1] !== ',' && current !== ',' && current !== ',(') {
                current = '';
                active = false;
            }
            continue;
        }
        result += char;
        current += char;
    }
    if (!valid)
        throw new BaseError$1('Unable to normalize signature.');
    return result;
}

/**
 * Returns the signature for a given function or event definition.
 *
 * @example
 * const signature = toSignature('function ownerOf(uint256 tokenId)')
 * // 'ownerOf(uint256)'
 *
 * @example
 * const signature_3 = toSignature({
 *   name: 'ownerOf',
 *   type: 'function',
 *   inputs: [{ name: 'tokenId', type: 'uint256' }],
 *   outputs: [],
 *   stateMutability: 'view',
 * })
 * // 'ownerOf(uint256)'
 */
const toSignature = (def) => {
    const def_ = (() => {
        if (typeof def === 'string')
            return def;
        return formatAbiItem$1(def);
    })();
    return normalizeSignature$1(def_);
};

/**
 * Returns the hash (of the function/event signature) for a given event or function definition.
 */
function toSignatureHash(fn) {
    return hashSignature(toSignature(fn));
}

/**
 * Returns the event selector for a given event definition.
 *
 * @example
 * const selector = toEventSelector('Transfer(address indexed from, address indexed to, uint256 amount)')
 * // 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
 */
const toEventSelector = toSignatureHash;

let InvalidAddressError$1 = class InvalidAddressError extends BaseError$1 {
    constructor({ address }) {
        super(`Address "${address}" is invalid.`, {
            metaMessages: [
                '- Address must be a hex value of 20 bytes (40 hex characters).',
                '- Address must match its checksum counterpart.',
            ],
            name: 'InvalidAddressError',
        });
    }
};

/**
 * Map with a LRU (Least recently used) policy.
 *
 * @link https://en.wikipedia.org/wiki/Cache_replacement_policies#LRU
 */
let LruMap$1 = class LruMap extends Map {
    constructor(size) {
        super();
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.maxSize = size;
    }
    get(key) {
        const value = super.get(key);
        if (super.has(key) && value !== undefined) {
            this.delete(key);
            super.set(key, value);
        }
        return value;
    }
    set(key, value) {
        super.set(key, value);
        if (this.maxSize && this.size > this.maxSize) {
            const firstKey = this.keys().next().value;
            if (firstKey)
                this.delete(firstKey);
        }
        return this;
    }
};

const checksumAddressCache = /*#__PURE__*/ new LruMap$1(8192);
function checksumAddress(address_, 
/**
 * Warning: EIP-1191 checksum addresses are generally not backwards compatible with the
 * wider Ethereum ecosystem, meaning it will break when validated against an application/tool
 * that relies on EIP-55 checksum encoding (checksum without chainId).
 *
 * It is highly recommended to not use this feature unless you
 * know what you are doing.
 *
 * See more: https://github.com/ethereum/EIPs/issues/1121
 */
chainId) {
    if (checksumAddressCache.has(`${address_}.${chainId}`))
        return checksumAddressCache.get(`${address_}.${chainId}`);
    const hexAddress = address_.substring(2).toLowerCase();
    const hash = keccak256$1(stringToBytes(hexAddress), 'bytes');
    const address = (hexAddress).split('');
    for (let i = 0; i < 40; i += 2) {
        if (hash[i >> 1] >> 4 >= 8 && address[i]) {
            address[i] = address[i].toUpperCase();
        }
        if ((hash[i >> 1] & 0x0f) >= 8 && address[i + 1]) {
            address[i + 1] = address[i + 1].toUpperCase();
        }
    }
    const result = `0x${address.join('')}`;
    checksumAddressCache.set(`${address_}.${chainId}`, result);
    return result;
}
function getAddress(address, 
/**
 * Warning: EIP-1191 checksum addresses are generally not backwards compatible with the
 * wider Ethereum ecosystem, meaning it will break when validated against an application/tool
 * that relies on EIP-55 checksum encoding (checksum without chainId).
 *
 * It is highly recommended to not use this feature unless you
 * know what you are doing.
 *
 * See more: https://github.com/ethereum/EIPs/issues/1121
 */
chainId) {
    if (!isAddress(address, { strict: false }))
        throw new InvalidAddressError$1({ address });
    return checksumAddress(address, chainId);
}

const addressRegex$1 = /^0x[a-fA-F0-9]{40}$/;
/** @internal */
const isAddressCache = /*#__PURE__*/ new LruMap$1(8192);
function isAddress(address, options) {
    const { strict = true } = options ?? {};
    const cacheKey = `${address}.${strict}`;
    if (isAddressCache.has(cacheKey))
        return isAddressCache.get(cacheKey);
    const result = (() => {
        if (!addressRegex$1.test(address))
            return false;
        if (address.toLowerCase() === address)
            return true;
        if (strict)
            return checksumAddress(address) === address;
        return true;
    })();
    isAddressCache.set(cacheKey, result);
    return result;
}

function concat$1(values) {
    if (typeof values[0] === 'string')
        return concatHex(values);
    return concatBytes$1(values);
}
function concatBytes$1(values) {
    let length = 0;
    for (const arr of values) {
        length += arr.length;
    }
    const result = new Uint8Array(length);
    let offset = 0;
    for (const arr of values) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}
function concatHex(values) {
    return `0x${values.reduce((acc, x) => acc + x.replace('0x', ''), '')}`;
}

/**
 * @description Returns a section of the hex or byte array given a start/end bytes offset.
 *
 * @param value The hex or byte array to slice.
 * @param start The start offset (in bytes).
 * @param end The end offset (in bytes).
 */
function slice$2(value, start, end, { strict } = {}) {
    if (isHex(value, { strict: false }))
        return sliceHex(value, start, end, {
            strict,
        });
    return sliceBytes(value, start, end, {
        strict,
    });
}
function assertStartOffset$1(value, start) {
    if (typeof start === 'number' && start > 0 && start > size$3(value) - 1)
        throw new SliceOffsetOutOfBoundsError$1({
            offset: start,
            position: 'start',
            size: size$3(value),
        });
}
function assertEndOffset$1(value, start, end) {
    if (typeof start === 'number' &&
        typeof end === 'number' &&
        size$3(value) !== end - start) {
        throw new SliceOffsetOutOfBoundsError$1({
            offset: end,
            position: 'end',
            size: size$3(value),
        });
    }
}
/**
 * @description Returns a section of the byte array given a start/end bytes offset.
 *
 * @param value The byte array to slice.
 * @param start The start offset (in bytes).
 * @param end The end offset (in bytes).
 */
function sliceBytes(value_, start, end, { strict } = {}) {
    assertStartOffset$1(value_, start);
    const value = value_.slice(start, end);
    if (strict)
        assertEndOffset$1(value, start, end);
    return value;
}
/**
 * @description Returns a section of the hex value given a start/end bytes offset.
 *
 * @param value The hex value to slice.
 * @param start The start offset (in bytes).
 * @param end The end offset (in bytes).
 */
function sliceHex(value_, start, end, { strict } = {}) {
    assertStartOffset$1(value_, start);
    const value = `0x${value_
        .replace('0x', '')
        .slice((start ?? 0) * 2, (end ?? value_.length) * 2)}`;
    if (strict)
        assertEndOffset$1(value, start, end);
    return value;
}

// `bytes<M>`: binary type of `M` bytes, `0 < M <= 32`
// https://regexr.com/6va55
const bytesRegex$1 = /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/;
// `(u)int<M>`: (un)signed integer type of `M` bits, `0 < M <= 256`, `M % 8 == 0`
// https://regexr.com/6v8hp
const integerRegex$1 = /^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;

/**
 * @description Encodes a list of primitive values into an ABI-encoded hex value.
 *
 * - Docs: https://viem.sh/docs/abi/encodeAbiParameters#encodeabiparameters
 *
 *   Generates ABI encoded data using the [ABI specification](https://docs.soliditylang.org/en/latest/abi-spec), given a set of ABI parameters (inputs/outputs) and their corresponding values.
 *
 * @param params - a set of ABI Parameters (params), that can be in the shape of the inputs or outputs attribute of an ABI Item.
 * @param values - a set of values (values) that correspond to the given params.
 * @example
 * ```typescript
 * import { encodeAbiParameters } from 'viem'
 *
 * const encodedData = encodeAbiParameters(
 *   [
 *     { name: 'x', type: 'string' },
 *     { name: 'y', type: 'uint' },
 *     { name: 'z', type: 'bool' }
 *   ],
 *   ['wagmi', 420n, true]
 * )
 * ```
 *
 * You can also pass in Human Readable parameters with the parseAbiParameters utility.
 *
 * @example
 * ```typescript
 * import { encodeAbiParameters, parseAbiParameters } from 'viem'
 *
 * const encodedData = encodeAbiParameters(
 *   parseAbiParameters('string x, uint y, bool z'),
 *   ['wagmi', 420n, true]
 * )
 * ```
 */
function encodeAbiParameters(params, values) {
    if (params.length !== values.length)
        throw new AbiEncodingLengthMismatchError({
            expectedLength: params.length,
            givenLength: values.length,
        });
    // Prepare the parameters to determine dynamic types to encode.
    const preparedParams = prepareParams({
        params: params,
        values: values,
    });
    const data = encodeParams(preparedParams);
    if (data.length === 0)
        return '0x';
    return data;
}
function prepareParams({ params, values, }) {
    const preparedParams = [];
    for (let i = 0; i < params.length; i++) {
        preparedParams.push(prepareParam({ param: params[i], value: values[i] }));
    }
    return preparedParams;
}
function prepareParam({ param, value, }) {
    const arrayComponents = getArrayComponents$1(param.type);
    if (arrayComponents) {
        const [length, type] = arrayComponents;
        return encodeArray$1(value, { length, param: { ...param, type } });
    }
    if (param.type === 'tuple') {
        return encodeTuple$1(value, {
            param: param,
        });
    }
    if (param.type === 'address') {
        return encodeAddress$1(value);
    }
    if (param.type === 'bool') {
        return encodeBool(value);
    }
    if (param.type.startsWith('uint') || param.type.startsWith('int')) {
        const signed = param.type.startsWith('int');
        const [, , size = '256'] = integerRegex$1.exec(param.type) ?? [];
        return encodeNumber$1(value, {
            signed,
            size: Number(size),
        });
    }
    if (param.type.startsWith('bytes')) {
        return encodeBytes$1(value, { param });
    }
    if (param.type === 'string') {
        return encodeString$1(value);
    }
    throw new InvalidAbiEncodingTypeError(param.type, {
        docsPath: '/docs/contract/encodeAbiParameters',
    });
}
function encodeParams(preparedParams) {
    // 1. Compute the size of the static part of the parameters.
    let staticSize = 0;
    for (let i = 0; i < preparedParams.length; i++) {
        const { dynamic, encoded } = preparedParams[i];
        if (dynamic)
            staticSize += 32;
        else
            staticSize += size$3(encoded);
    }
    // 2. Split the parameters into static and dynamic parts.
    const staticParams = [];
    const dynamicParams = [];
    let dynamicSize = 0;
    for (let i = 0; i < preparedParams.length; i++) {
        const { dynamic, encoded } = preparedParams[i];
        if (dynamic) {
            staticParams.push(numberToHex(staticSize + dynamicSize, { size: 32 }));
            dynamicParams.push(encoded);
            dynamicSize += size$3(encoded);
        }
        else {
            staticParams.push(encoded);
        }
    }
    // 3. Concatenate static and dynamic parts.
    return concat$1([...staticParams, ...dynamicParams]);
}
function encodeAddress$1(value) {
    if (!isAddress(value))
        throw new InvalidAddressError$1({ address: value });
    return { dynamic: false, encoded: padHex(value.toLowerCase()) };
}
function encodeArray$1(value, { length, param, }) {
    const dynamic = length === null;
    if (!Array.isArray(value))
        throw new InvalidArrayError$1(value);
    if (!dynamic && value.length !== length)
        throw new AbiEncodingArrayLengthMismatchError({
            expectedLength: length,
            givenLength: value.length,
            type: `${param.type}[${length}]`,
        });
    let dynamicChild = false;
    const preparedParams = [];
    for (let i = 0; i < value.length; i++) {
        const preparedParam = prepareParam({ param, value: value[i] });
        if (preparedParam.dynamic)
            dynamicChild = true;
        preparedParams.push(preparedParam);
    }
    if (dynamic || dynamicChild) {
        const data = encodeParams(preparedParams);
        if (dynamic) {
            const length = numberToHex(preparedParams.length, { size: 32 });
            return {
                dynamic: true,
                encoded: preparedParams.length > 0 ? concat$1([length, data]) : length,
            };
        }
        if (dynamicChild)
            return { dynamic: true, encoded: data };
    }
    return {
        dynamic: false,
        encoded: concat$1(preparedParams.map(({ encoded }) => encoded)),
    };
}
function encodeBytes$1(value, { param }) {
    const [, paramSize] = param.type.split('bytes');
    const bytesSize = size$3(value);
    if (!paramSize) {
        let value_ = value;
        // If the size is not divisible by 32 bytes, pad the end
        // with empty bytes to the ceiling 32 bytes.
        if (bytesSize % 32 !== 0)
            value_ = padHex(value_, {
                dir: 'right',
                size: Math.ceil((value.length - 2) / 2 / 32) * 32,
            });
        return {
            dynamic: true,
            encoded: concat$1([padHex(numberToHex(bytesSize, { size: 32 })), value_]),
        };
    }
    if (bytesSize !== Number.parseInt(paramSize, 10))
        throw new AbiEncodingBytesSizeMismatchError({
            expectedSize: Number.parseInt(paramSize, 10),
            value,
        });
    return { dynamic: false, encoded: padHex(value, { dir: 'right' }) };
}
function encodeBool(value) {
    if (typeof value !== 'boolean')
        throw new BaseError$1(`Invalid boolean value: "${value}" (type: ${typeof value}). Expected: \`true\` or \`false\`.`);
    return { dynamic: false, encoded: padHex(boolToHex(value)) };
}
function encodeNumber$1(value, { signed, size = 256 }) {
    if (typeof size === 'number') {
        const max = 2n ** (BigInt(size) - (signed ? 1n : 0n)) - 1n;
        const min = signed ? -max - 1n : 0n;
        if (value > max || value < min)
            throw new IntegerOutOfRangeError$1({
                max: max.toString(),
                min: min.toString(),
                signed,
                size: size / 8,
                value: value.toString(),
            });
    }
    return {
        dynamic: false,
        encoded: numberToHex(value, {
            size: 32,
            signed,
        }),
    };
}
function encodeString$1(value) {
    const hexValue = stringToHex(value);
    const partsLength = Math.ceil(size$3(hexValue) / 32);
    const parts = [];
    for (let i = 0; i < partsLength; i++) {
        parts.push(padHex(slice$2(hexValue, i * 32, (i + 1) * 32), {
            dir: 'right',
        }));
    }
    return {
        dynamic: true,
        encoded: concat$1([
            padHex(numberToHex(size$3(hexValue), { size: 32 })),
            ...parts,
        ]),
    };
}
function encodeTuple$1(value, { param }) {
    let dynamic = false;
    const preparedParams = [];
    for (let i = 0; i < param.components.length; i++) {
        const param_ = param.components[i];
        const index = Array.isArray(value) ? i : param_.name;
        const preparedParam = prepareParam({
            param: param_,
            value: value[index],
        });
        preparedParams.push(preparedParam);
        if (preparedParam.dynamic)
            dynamic = true;
    }
    return {
        dynamic,
        encoded: dynamic
            ? encodeParams(preparedParams)
            : concat$1(preparedParams.map(({ encoded }) => encoded)),
    };
}
function getArrayComponents$1(type) {
    const matches = type.match(/^(.*)\[(\d+)?\]$/);
    return matches
        ? // Return `null` if the array is dynamic.
            [matches[2] ? Number(matches[2]) : null, matches[1]]
        : undefined;
}

/**
 * Returns the function selector for a given function definition.
 *
 * @example
 * const selector = toFunctionSelector('function ownerOf(uint256 tokenId)')
 * // 0x6352211e
 */
const toFunctionSelector = (fn) => slice$2(toSignatureHash(fn), 0, 4);

function getAbiItem(parameters) {
    const { abi, args = [], name } = parameters;
    const isSelector = isHex(name, { strict: false });
    const abiItems = abi.filter((abiItem) => {
        if (isSelector) {
            if (abiItem.type === 'function')
                return toFunctionSelector(abiItem) === name;
            if (abiItem.type === 'event')
                return toEventSelector(abiItem) === name;
            return false;
        }
        return 'name' in abiItem && abiItem.name === name;
    });
    if (abiItems.length === 0)
        return undefined;
    if (abiItems.length === 1)
        return abiItems[0];
    let matchedAbiItem;
    for (const abiItem of abiItems) {
        if (!('inputs' in abiItem))
            continue;
        if (!args || args.length === 0) {
            if (!abiItem.inputs || abiItem.inputs.length === 0)
                return abiItem;
            continue;
        }
        if (!abiItem.inputs)
            continue;
        if (abiItem.inputs.length === 0)
            continue;
        if (abiItem.inputs.length !== args.length)
            continue;
        const matched = args.every((arg, index) => {
            const abiParameter = 'inputs' in abiItem && abiItem.inputs[index];
            if (!abiParameter)
                return false;
            return isArgOfType$1(arg, abiParameter);
        });
        if (matched) {
            // Check for ambiguity against already matched parameters (e.g. `address` vs `bytes20`).
            if (matchedAbiItem &&
                'inputs' in matchedAbiItem &&
                matchedAbiItem.inputs) {
                const ambiguousTypes = getAmbiguousTypes$1(abiItem.inputs, matchedAbiItem.inputs, args);
                if (ambiguousTypes)
                    throw new AbiItemAmbiguityError({
                        abiItem,
                        type: ambiguousTypes[0],
                    }, {
                        abiItem: matchedAbiItem,
                        type: ambiguousTypes[1],
                    });
            }
            matchedAbiItem = abiItem;
        }
    }
    if (matchedAbiItem)
        return matchedAbiItem;
    return abiItems[0];
}
/** @internal */
function isArgOfType$1(arg, abiParameter) {
    const argType = typeof arg;
    const abiParameterType = abiParameter.type;
    switch (abiParameterType) {
        case 'address':
            return isAddress(arg, { strict: false });
        case 'bool':
            return argType === 'boolean';
        case 'function':
            return argType === 'string';
        case 'string':
            return argType === 'string';
        default: {
            if (abiParameterType === 'tuple' && 'components' in abiParameter)
                return Object.values(abiParameter.components).every((component, index) => {
                    return (argType === 'object' &&
                        isArgOfType$1(Object.values(arg)[index], component));
                });
            // `(u)int<M>`: (un)signed integer type of `M` bits, `0 < M <= 256`, `M % 8 == 0`
            // https://regexr.com/6v8hp
            if (/^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/.test(abiParameterType))
                return argType === 'number' || argType === 'bigint';
            // `bytes<M>`: binary type of `M` bytes, `0 < M <= 32`
            // https://regexr.com/6va55
            if (/^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/.test(abiParameterType))
                return argType === 'string' || arg instanceof Uint8Array;
            // fixed-length (`<type>[M]`) and dynamic (`<type>[]`) arrays
            // https://regexr.com/6va6i
            if (/[a-z]+[1-9]{0,3}(\[[0-9]{0,}\])+$/.test(abiParameterType)) {
                return (Array.isArray(arg) &&
                    arg.every((x) => isArgOfType$1(x, {
                        ...abiParameter,
                        // Pop off `[]` or `[M]` from end of type
                        type: abiParameterType.replace(/(\[[0-9]{0,}\])$/, ''),
                    })));
            }
            return false;
        }
    }
}
/** @internal */
function getAmbiguousTypes$1(sourceParameters, targetParameters, args) {
    for (const parameterIndex in sourceParameters) {
        const sourceParameter = sourceParameters[parameterIndex];
        const targetParameter = targetParameters[parameterIndex];
        if (sourceParameter.type === 'tuple' &&
            targetParameter.type === 'tuple' &&
            'components' in sourceParameter &&
            'components' in targetParameter)
            return getAmbiguousTypes$1(sourceParameter.components, targetParameter.components, args[parameterIndex]);
        const types = [sourceParameter.type, targetParameter.type];
        const ambiguous = (() => {
            if (types.includes('address') && types.includes('bytes20'))
                return true;
            if (types.includes('address') && types.includes('string'))
                return isAddress(args[parameterIndex], { strict: false });
            if (types.includes('address') && types.includes('bytes'))
                return isAddress(args[parameterIndex], { strict: false });
            return false;
        })();
        if (ambiguous)
            return types;
    }
    return;
}

const docsPath$6 = '/docs/contract/encodeEventTopics';
function encodeEventTopics(parameters) {
    const { abi, eventName, args } = parameters;
    let abiItem = abi[0];
    if (eventName) {
        const item = getAbiItem({ abi, name: eventName });
        if (!item)
            throw new AbiEventNotFoundError(eventName, { docsPath: docsPath$6 });
        abiItem = item;
    }
    if (abiItem.type !== 'event')
        throw new AbiEventNotFoundError(undefined, { docsPath: docsPath$6 });
    const definition = formatAbiItem(abiItem);
    const signature = toEventSelector(definition);
    let topics = [];
    if (args && 'inputs' in abiItem) {
        const indexedInputs = abiItem.inputs?.filter((param) => 'indexed' in param && param.indexed);
        const args_ = Array.isArray(args)
            ? args
            : Object.values(args).length > 0
                ? (indexedInputs?.map((x) => args[x.name]) ?? [])
                : [];
        if (args_.length > 0) {
            topics =
                indexedInputs?.map((param, i) => {
                    if (Array.isArray(args_[i]))
                        return args_[i].map((_, j) => encodeArg({ param, value: args_[i][j] }));
                    return typeof args_[i] !== 'undefined' && args_[i] !== null
                        ? encodeArg({ param, value: args_[i] })
                        : null;
                }) ?? [];
        }
    }
    return [signature, ...topics];
}
function encodeArg({ param, value, }) {
    if (param.type === 'string' || param.type === 'bytes')
        return keccak256$1(toBytes$2(value));
    if (param.type === 'tuple' || param.type.match(/^(.*)\[(\d+)?\]$/))
        throw new FilterTypeNotSupportedError(param.type);
    return encodeAbiParameters([param], [value]);
}

/**
 * Scopes `request` to the filter ID. If the client is a fallback, it will
 * listen for responses and scope the child transport `request` function
 * to the successful filter ID.
 */
function createFilterRequestScope(client, { method }) {
    const requestMap = {};
    if (client.transport.type === 'fallback')
        client.transport.onResponse?.(({ method: method_, response: id, status, transport, }) => {
            if (status === 'success' && method === method_)
                requestMap[id] = transport.request;
        });
    return ((id) => requestMap[id] || client.request);
}

/**
 * Creates a Filter to retrieve event logs that can be used with [`getFilterChanges`](https://viem.sh/docs/actions/public/getFilterChanges) or [`getFilterLogs`](https://viem.sh/docs/actions/public/getFilterLogs).
 *
 * - Docs: https://viem.sh/docs/contract/createContractEventFilter
 *
 * @param client - Client to use
 * @param parameters - {@link CreateContractEventFilterParameters}
 * @returns [`Filter`](https://viem.sh/docs/glossary/types#filter). {@link CreateContractEventFilterReturnType}
 *
 * @example
 * import { createPublicClient, http, parseAbi } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createContractEventFilter } from 'viem/contract'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const filter = await createContractEventFilter(client, {
 *   abi: parseAbi(['event Transfer(address indexed, address indexed, uint256)']),
 * })
 */
async function createContractEventFilter(client, parameters) {
    const { address, abi, args, eventName, fromBlock, strict, toBlock } = parameters;
    const getRequest = createFilterRequestScope(client, {
        method: 'eth_newFilter',
    });
    const topics = eventName
        ? encodeEventTopics({
            abi,
            args,
            eventName,
        })
        : undefined;
    const id = await client.request({
        method: 'eth_newFilter',
        params: [
            {
                address,
                fromBlock: typeof fromBlock === 'bigint' ? numberToHex(fromBlock) : fromBlock,
                toBlock: typeof toBlock === 'bigint' ? numberToHex(toBlock) : toBlock,
                topics,
            },
        ],
    });
    return {
        abi,
        args,
        eventName,
        id,
        request: getRequest(id),
        strict: Boolean(strict),
        type: 'event',
    };
}

function parseAccount(account) {
    if (typeof account === 'string')
        return { address: account, type: 'json-rpc' };
    return account;
}

const docsPath$5 = '/docs/contract/encodeFunctionData';
function prepareEncodeFunctionData(parameters) {
    const { abi, args, functionName } = parameters;
    let abiItem = abi[0];
    if (functionName) {
        const item = getAbiItem({
            abi,
            args,
            name: functionName,
        });
        if (!item)
            throw new AbiFunctionNotFoundError(functionName, { docsPath: docsPath$5 });
        abiItem = item;
    }
    if (abiItem.type !== 'function')
        throw new AbiFunctionNotFoundError(undefined, { docsPath: docsPath$5 });
    return {
        abi: [abiItem],
        functionName: toFunctionSelector(formatAbiItem(abiItem)),
    };
}

function encodeFunctionData(parameters) {
    const { args } = parameters;
    const { abi, functionName } = (() => {
        if (parameters.abi.length === 1 &&
            parameters.functionName?.startsWith('0x'))
            return parameters;
        return prepareEncodeFunctionData(parameters);
    })();
    const abiItem = abi[0];
    const signature = functionName;
    const data = 'inputs' in abiItem && abiItem.inputs
        ? encodeAbiParameters(abiItem.inputs, args ?? [])
        : undefined;
    return concatHex([signature, data ?? '0x']);
}

// https://docs.soliditylang.org/en/v0.8.16/control-structures.html#panic-via-assert-and-error-via-require
const panicReasons = {
    1: 'An `assert` condition failed.',
    17: 'Arithmetic operation resulted in underflow or overflow.',
    18: 'Division or modulo by zero (e.g. `5 / 0` or `23 % 0`).',
    33: 'Attempted to convert to an invalid type.',
    34: 'Attempted to access a storage byte array that is incorrectly encoded.',
    49: 'Performed `.pop()` on an empty array',
    50: 'Array index is out of bounds.',
    65: 'Allocated too much memory or created an array which is too large.',
    81: 'Attempted to call a zero-initialized variable of internal function type.',
};
const solidityError = {
    inputs: [
        {
            name: 'message',
            type: 'string',
        },
    ],
    name: 'Error',
    type: 'error',
};
const solidityPanic = {
    inputs: [
        {
            name: 'reason',
            type: 'uint256',
        },
    ],
    name: 'Panic',
    type: 'error',
};

let NegativeOffsetError$1 = class NegativeOffsetError extends BaseError$1 {
    constructor({ offset }) {
        super(`Offset \`${offset}\` cannot be negative.`, {
            name: 'NegativeOffsetError',
        });
    }
};
let PositionOutOfBoundsError$1 = class PositionOutOfBoundsError extends BaseError$1 {
    constructor({ length, position }) {
        super(`Position \`${position}\` is out of bounds (\`0 < position < ${length}\`).`, { name: 'PositionOutOfBoundsError' });
    }
};
let RecursiveReadLimitExceededError$1 = class RecursiveReadLimitExceededError extends BaseError$1 {
    constructor({ count, limit }) {
        super(`Recursive read limit of \`${limit}\` exceeded (recursive read count: \`${count}\`).`, { name: 'RecursiveReadLimitExceededError' });
    }
};

const staticCursor$1 = {
    bytes: new Uint8Array(),
    dataView: new DataView(new ArrayBuffer(0)),
    position: 0,
    positionReadCount: new Map(),
    recursiveReadCount: 0,
    recursiveReadLimit: Number.POSITIVE_INFINITY,
    assertReadLimit() {
        if (this.recursiveReadCount >= this.recursiveReadLimit)
            throw new RecursiveReadLimitExceededError$1({
                count: this.recursiveReadCount + 1,
                limit: this.recursiveReadLimit,
            });
    },
    assertPosition(position) {
        if (position < 0 || position > this.bytes.length - 1)
            throw new PositionOutOfBoundsError$1({
                length: this.bytes.length,
                position,
            });
    },
    decrementPosition(offset) {
        if (offset < 0)
            throw new NegativeOffsetError$1({ offset });
        const position = this.position - offset;
        this.assertPosition(position);
        this.position = position;
    },
    getReadCount(position) {
        return this.positionReadCount.get(position || this.position) || 0;
    },
    incrementPosition(offset) {
        if (offset < 0)
            throw new NegativeOffsetError$1({ offset });
        const position = this.position + offset;
        this.assertPosition(position);
        this.position = position;
    },
    inspectByte(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position);
        return this.bytes[position];
    },
    inspectBytes(length, position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + length - 1);
        return this.bytes.subarray(position, position + length);
    },
    inspectUint8(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position);
        return this.bytes[position];
    },
    inspectUint16(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + 1);
        return this.dataView.getUint16(position);
    },
    inspectUint24(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + 2);
        return ((this.dataView.getUint16(position) << 8) +
            this.dataView.getUint8(position + 2));
    },
    inspectUint32(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + 3);
        return this.dataView.getUint32(position);
    },
    pushByte(byte) {
        this.assertPosition(this.position);
        this.bytes[this.position] = byte;
        this.position++;
    },
    pushBytes(bytes) {
        this.assertPosition(this.position + bytes.length - 1);
        this.bytes.set(bytes, this.position);
        this.position += bytes.length;
    },
    pushUint8(value) {
        this.assertPosition(this.position);
        this.bytes[this.position] = value;
        this.position++;
    },
    pushUint16(value) {
        this.assertPosition(this.position + 1);
        this.dataView.setUint16(this.position, value);
        this.position += 2;
    },
    pushUint24(value) {
        this.assertPosition(this.position + 2);
        this.dataView.setUint16(this.position, value >> 8);
        this.dataView.setUint8(this.position + 2, value & ~4294967040);
        this.position += 3;
    },
    pushUint32(value) {
        this.assertPosition(this.position + 3);
        this.dataView.setUint32(this.position, value);
        this.position += 4;
    },
    readByte() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectByte();
        this.position++;
        return value;
    },
    readBytes(length, size) {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectBytes(length);
        this.position += size ?? length;
        return value;
    },
    readUint8() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint8();
        this.position += 1;
        return value;
    },
    readUint16() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint16();
        this.position += 2;
        return value;
    },
    readUint24() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint24();
        this.position += 3;
        return value;
    },
    readUint32() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint32();
        this.position += 4;
        return value;
    },
    get remaining() {
        return this.bytes.length - this.position;
    },
    setPosition(position) {
        const oldPosition = this.position;
        this.assertPosition(position);
        this.position = position;
        return () => (this.position = oldPosition);
    },
    _touch() {
        if (this.recursiveReadLimit === Number.POSITIVE_INFINITY)
            return;
        const count = this.getReadCount();
        this.positionReadCount.set(this.position, count + 1);
        if (count > 0)
            this.recursiveReadCount++;
    },
};
function createCursor(bytes, { recursiveReadLimit = 8_192 } = {}) {
    const cursor = Object.create(staticCursor$1);
    cursor.bytes = bytes;
    cursor.dataView = new DataView(bytes.buffer ?? bytes, bytes.byteOffset, bytes.byteLength);
    cursor.positionReadCount = new Map();
    cursor.recursiveReadLimit = recursiveReadLimit;
    return cursor;
}

/**
 * Decodes a byte array into a bigint.
 *
 * - Docs: https://viem.sh/docs/utilities/fromBytes#bytestobigint
 *
 * @param bytes Byte array to decode.
 * @param opts Options.
 * @returns BigInt value.
 *
 * @example
 * import { bytesToBigInt } from 'viem'
 * const data = bytesToBigInt(new Uint8Array([1, 164]))
 * // 420n
 */
function bytesToBigInt(bytes, opts = {}) {
    if (typeof opts.size !== 'undefined')
        assertSize$2(bytes, { size: opts.size });
    const hex = bytesToHex$1(bytes, opts);
    return hexToBigInt(hex, opts);
}
/**
 * Decodes a byte array into a boolean.
 *
 * - Docs: https://viem.sh/docs/utilities/fromBytes#bytestobool
 *
 * @param bytes Byte array to decode.
 * @param opts Options.
 * @returns Boolean value.
 *
 * @example
 * import { bytesToBool } from 'viem'
 * const data = bytesToBool(new Uint8Array([1]))
 * // true
 */
function bytesToBool(bytes_, opts = {}) {
    let bytes = bytes_;
    if (typeof opts.size !== 'undefined') {
        assertSize$2(bytes, { size: opts.size });
        bytes = trim$1(bytes);
    }
    if (bytes.length > 1 || bytes[0] > 1)
        throw new InvalidBytesBooleanError$1(bytes);
    return Boolean(bytes[0]);
}
/**
 * Decodes a byte array into a number.
 *
 * - Docs: https://viem.sh/docs/utilities/fromBytes#bytestonumber
 *
 * @param bytes Byte array to decode.
 * @param opts Options.
 * @returns Number value.
 *
 * @example
 * import { bytesToNumber } from 'viem'
 * const data = bytesToNumber(new Uint8Array([1, 164]))
 * // 420
 */
function bytesToNumber(bytes, opts = {}) {
    if (typeof opts.size !== 'undefined')
        assertSize$2(bytes, { size: opts.size });
    const hex = bytesToHex$1(bytes, opts);
    return hexToNumber$1(hex, opts);
}
/**
 * Decodes a byte array into a UTF-8 string.
 *
 * - Docs: https://viem.sh/docs/utilities/fromBytes#bytestostring
 *
 * @param bytes Byte array to decode.
 * @param opts Options.
 * @returns String value.
 *
 * @example
 * import { bytesToString } from 'viem'
 * const data = bytesToString(new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]))
 * // 'Hello world'
 */
function bytesToString(bytes_, opts = {}) {
    let bytes = bytes_;
    if (typeof opts.size !== 'undefined') {
        assertSize$2(bytes, { size: opts.size });
        bytes = trim$1(bytes, { dir: 'right' });
    }
    return new TextDecoder().decode(bytes);
}

function decodeAbiParameters(params, data) {
    const bytes = typeof data === 'string' ? hexToBytes$1(data) : data;
    const cursor = createCursor(bytes);
    if (size$3(bytes) === 0 && params.length > 0)
        throw new AbiDecodingZeroDataError();
    if (size$3(data) && size$3(data) < 32)
        throw new AbiDecodingDataSizeTooSmallError({
            data: typeof data === 'string' ? data : bytesToHex$1(data),
            params: params,
            size: size$3(data),
        });
    let consumed = 0;
    const values = [];
    for (let i = 0; i < params.length; ++i) {
        const param = params[i];
        cursor.setPosition(consumed);
        const [data, consumed_] = decodeParameter$1(cursor, param, {
            staticPosition: 0,
        });
        consumed += consumed_;
        values.push(data);
    }
    return values;
}
function decodeParameter$1(cursor, param, { staticPosition }) {
    const arrayComponents = getArrayComponents$1(param.type);
    if (arrayComponents) {
        const [length, type] = arrayComponents;
        return decodeArray$1(cursor, { ...param, type }, { length, staticPosition });
    }
    if (param.type === 'tuple')
        return decodeTuple$1(cursor, param, { staticPosition });
    if (param.type === 'address')
        return decodeAddress$1(cursor);
    if (param.type === 'bool')
        return decodeBool$1(cursor);
    if (param.type.startsWith('bytes'))
        return decodeBytes$1(cursor, param, { staticPosition });
    if (param.type.startsWith('uint') || param.type.startsWith('int'))
        return decodeNumber$1(cursor, param);
    if (param.type === 'string')
        return decodeString$1(cursor, { staticPosition });
    throw new InvalidAbiDecodingTypeError(param.type, {
        docsPath: '/docs/contract/decodeAbiParameters',
    });
}
////////////////////////////////////////////////////////////////////
// Type Decoders
const sizeOfLength$1 = 32;
const sizeOfOffset$1 = 32;
function decodeAddress$1(cursor) {
    const value = cursor.readBytes(32);
    return [checksumAddress(bytesToHex$1(sliceBytes(value, -20))), 32];
}
function decodeArray$1(cursor, param, { length, staticPosition }) {
    // If the length of the array is not known in advance (dynamic array),
    // this means we will need to wonder off to the pointer and decode.
    if (!length) {
        // Dealing with a dynamic type, so get the offset of the array data.
        const offset = bytesToNumber(cursor.readBytes(sizeOfOffset$1));
        // Start is the static position of current slot + offset.
        const start = staticPosition + offset;
        const startOfData = start + sizeOfLength$1;
        // Get the length of the array from the offset.
        cursor.setPosition(start);
        const length = bytesToNumber(cursor.readBytes(sizeOfLength$1));
        // Check if the array has any dynamic children.
        const dynamicChild = hasDynamicChild$1(param);
        let consumed = 0;
        const value = [];
        for (let i = 0; i < length; ++i) {
            // If any of the children is dynamic, then all elements will be offset pointer, thus size of one slot (32 bytes).
            // Otherwise, elements will be the size of their encoding (consumed bytes).
            cursor.setPosition(startOfData + (dynamicChild ? i * 32 : consumed));
            const [data, consumed_] = decodeParameter$1(cursor, param, {
                staticPosition: startOfData,
            });
            consumed += consumed_;
            value.push(data);
        }
        // As we have gone wondering, restore to the original position + next slot.
        cursor.setPosition(staticPosition + 32);
        return [value, 32];
    }
    // If the length of the array is known in advance,
    // and the length of an element deeply nested in the array is not known,
    // we need to decode the offset of the array data.
    if (hasDynamicChild$1(param)) {
        // Dealing with dynamic types, so get the offset of the array data.
        const offset = bytesToNumber(cursor.readBytes(sizeOfOffset$1));
        // Start is the static position of current slot + offset.
        const start = staticPosition + offset;
        const value = [];
        for (let i = 0; i < length; ++i) {
            // Move cursor along to the next slot (next offset pointer).
            cursor.setPosition(start + i * 32);
            const [data] = decodeParameter$1(cursor, param, {
                staticPosition: start,
            });
            value.push(data);
        }
        // As we have gone wondering, restore to the original position + next slot.
        cursor.setPosition(staticPosition + 32);
        return [value, 32];
    }
    // If the length of the array is known in advance and the array is deeply static,
    // then we can just decode each element in sequence.
    let consumed = 0;
    const value = [];
    for (let i = 0; i < length; ++i) {
        const [data, consumed_] = decodeParameter$1(cursor, param, {
            staticPosition: staticPosition + consumed,
        });
        consumed += consumed_;
        value.push(data);
    }
    return [value, consumed];
}
function decodeBool$1(cursor) {
    return [bytesToBool(cursor.readBytes(32), { size: 32 }), 32];
}
function decodeBytes$1(cursor, param, { staticPosition }) {
    const [_, size] = param.type.split('bytes');
    if (!size) {
        // Dealing with dynamic types, so get the offset of the bytes data.
        const offset = bytesToNumber(cursor.readBytes(32));
        // Set position of the cursor to start of bytes data.
        cursor.setPosition(staticPosition + offset);
        const length = bytesToNumber(cursor.readBytes(32));
        // If there is no length, we have zero data.
        if (length === 0) {
            // As we have gone wondering, restore to the original position + next slot.
            cursor.setPosition(staticPosition + 32);
            return ['0x', 32];
        }
        const data = cursor.readBytes(length);
        // As we have gone wondering, restore to the original position + next slot.
        cursor.setPosition(staticPosition + 32);
        return [bytesToHex$1(data), 32];
    }
    const value = bytesToHex$1(cursor.readBytes(Number.parseInt(size, 10), 32));
    return [value, 32];
}
function decodeNumber$1(cursor, param) {
    const signed = param.type.startsWith('int');
    const size = Number.parseInt(param.type.split('int')[1] || '256', 10);
    const value = cursor.readBytes(32);
    return [
        size > 48
            ? bytesToBigInt(value, { signed })
            : bytesToNumber(value, { signed }),
        32,
    ];
}
function decodeTuple$1(cursor, param, { staticPosition }) {
    // Tuples can have unnamed components (i.e. they are arrays), so we must
    // determine whether the tuple is named or unnamed. In the case of a named
    // tuple, the value will be an object where each property is the name of the
    // component. In the case of an unnamed tuple, the value will be an array.
    const hasUnnamedChild = param.components.length === 0 || param.components.some(({ name }) => !name);
    // Initialize the value to an object or an array, depending on whether the
    // tuple is named or unnamed.
    const value = hasUnnamedChild ? [] : {};
    let consumed = 0;
    // If the tuple has a dynamic child, we must first decode the offset to the
    // tuple data.
    if (hasDynamicChild$1(param)) {
        // Dealing with dynamic types, so get the offset of the tuple data.
        const offset = bytesToNumber(cursor.readBytes(sizeOfOffset$1));
        // Start is the static position of referencing slot + offset.
        const start = staticPosition + offset;
        for (let i = 0; i < param.components.length; ++i) {
            const component = param.components[i];
            cursor.setPosition(start + consumed);
            const [data, consumed_] = decodeParameter$1(cursor, component, {
                staticPosition: start,
            });
            consumed += consumed_;
            value[hasUnnamedChild ? i : component?.name] = data;
        }
        // As we have gone wondering, restore to the original position + next slot.
        cursor.setPosition(staticPosition + 32);
        return [value, 32];
    }
    // If the tuple has static children, we can just decode each component
    // in sequence.
    for (let i = 0; i < param.components.length; ++i) {
        const component = param.components[i];
        const [data, consumed_] = decodeParameter$1(cursor, component, {
            staticPosition,
        });
        value[hasUnnamedChild ? i : component?.name] = data;
        consumed += consumed_;
    }
    return [value, consumed];
}
function decodeString$1(cursor, { staticPosition }) {
    // Get offset to start of string data.
    const offset = bytesToNumber(cursor.readBytes(32));
    // Start is the static position of current slot + offset.
    const start = staticPosition + offset;
    cursor.setPosition(start);
    const length = bytesToNumber(cursor.readBytes(32));
    // If there is no length, we have zero data (empty string).
    if (length === 0) {
        cursor.setPosition(staticPosition + 32);
        return ['', 32];
    }
    const data = cursor.readBytes(length, 32);
    const value = bytesToString(trim$1(data));
    // As we have gone wondering, restore to the original position + next slot.
    cursor.setPosition(staticPosition + 32);
    return [value, 32];
}
function hasDynamicChild$1(param) {
    const { type } = param;
    if (type === 'string')
        return true;
    if (type === 'bytes')
        return true;
    if (type.endsWith('[]'))
        return true;
    if (type === 'tuple')
        return param.components?.some(hasDynamicChild$1);
    const arrayComponents = getArrayComponents$1(param.type);
    if (arrayComponents &&
        hasDynamicChild$1({ ...param, type: arrayComponents[1] }))
        return true;
    return false;
}

function decodeErrorResult(parameters) {
    const { abi, data } = parameters;
    const signature = slice$2(data, 0, 4);
    if (signature === '0x')
        throw new AbiDecodingZeroDataError();
    const abi_ = [...(abi || []), solidityError, solidityPanic];
    const abiItem = abi_.find((x) => x.type === 'error' && signature === toFunctionSelector(formatAbiItem(x)));
    if (!abiItem)
        throw new AbiErrorSignatureNotFoundError(signature, {
            docsPath: '/docs/contract/decodeErrorResult',
        });
    return {
        abiItem,
        args: 'inputs' in abiItem && abiItem.inputs && abiItem.inputs.length > 0
            ? decodeAbiParameters(abiItem.inputs, slice$2(data, 4))
            : undefined,
        errorName: abiItem.name,
    };
}

const stringify$1 = (value, replacer, space) => JSON.stringify(value, (key, value_) => {
    const value = typeof value_ === 'bigint' ? value_.toString() : value_;
    return value;
}, space);

function formatAbiItemWithArgs({ abiItem, args, includeFunctionName = true, includeName = false, }) {
    if (!('name' in abiItem))
        return;
    if (!('inputs' in abiItem))
        return;
    if (!abiItem.inputs)
        return;
    return `${includeFunctionName ? abiItem.name : ''}(${abiItem.inputs
        .map((input, i) => `${includeName && input.name ? `${input.name}: ` : ''}${typeof args[i] === 'object' ? stringify$1(args[i]) : args[i]}`)
        .join(', ')})`;
}

const etherUnits = {
    gwei: 9,
    wei: 18,
};
const gweiUnits = {
    ether: -9,
    wei: 9,
};

/**
 *  Divides a number by a given exponent of base 10 (10exponent), and formats it into a string representation of the number..
 *
 * - Docs: https://viem.sh/docs/utilities/formatUnits
 *
 * @example
 * import { formatUnits } from 'viem'
 *
 * formatUnits(420000000000n, 9)
 * // '420'
 */
function formatUnits(value, decimals) {
    let display = value.toString();
    const negative = display.startsWith('-');
    if (negative)
        display = display.slice(1);
    display = display.padStart(decimals, '0');
    let [integer, fraction] = [
        display.slice(0, display.length - decimals),
        display.slice(display.length - decimals),
    ];
    fraction = fraction.replace(/(0+)$/, '');
    return `${negative ? '-' : ''}${integer || '0'}${fraction ? `.${fraction}` : ''}`;
}

/**
 * Converts numerical wei to a string representation of ether.
 *
 * - Docs: https://viem.sh/docs/utilities/formatEther
 *
 * @example
 * import { formatEther } from 'viem'
 *
 * formatEther(1000000000000000000n)
 * // '1'
 */
function formatEther(wei, unit = 'wei') {
    return formatUnits(wei, etherUnits[unit]);
}

/**
 * Converts numerical wei to a string representation of gwei.
 *
 * - Docs: https://viem.sh/docs/utilities/formatGwei
 *
 * @example
 * import { formatGwei } from 'viem'
 *
 * formatGwei(1000000000n)
 * // '1'
 */
function formatGwei(wei, unit = 'wei') {
    return formatUnits(wei, gweiUnits[unit]);
}

class AccountStateConflictError extends BaseError$1 {
    constructor({ address }) {
        super(`State for account "${address}" is set multiple times.`, {
            name: 'AccountStateConflictError',
        });
    }
}
class StateAssignmentConflictError extends BaseError$1 {
    constructor() {
        super('state and stateDiff are set on the same account.', {
            name: 'StateAssignmentConflictError',
        });
    }
}
/** @internal */
function prettyStateMapping(stateMapping) {
    return stateMapping.reduce((pretty, { slot, value }) => {
        return `${pretty}        ${slot}: ${value}\n`;
    }, '');
}
function prettyStateOverride(stateOverride) {
    return stateOverride
        .reduce((pretty, { address, ...state }) => {
        let val = `${pretty}    ${address}:\n`;
        if (state.nonce)
            val += `      nonce: ${state.nonce}\n`;
        if (state.balance)
            val += `      balance: ${state.balance}\n`;
        if (state.code)
            val += `      code: ${state.code}\n`;
        if (state.state) {
            val += '      state:\n';
            val += prettyStateMapping(state.state);
        }
        if (state.stateDiff) {
            val += '      stateDiff:\n';
            val += prettyStateMapping(state.stateDiff);
        }
        return val;
    }, '  State Override:\n')
        .slice(0, -1);
}

function prettyPrint(args) {
    const entries = Object.entries(args)
        .map(([key, value]) => {
        if (value === undefined || value === false)
            return null;
        return [key, value];
    })
        .filter(Boolean);
    const maxLength = entries.reduce((acc, [key]) => Math.max(acc, key.length), 0);
    return entries
        .map(([key, value]) => `  ${`${key}:`.padEnd(maxLength + 1)}  ${value}`)
        .join('\n');
}
class InvalidSerializableTransactionError extends BaseError$1 {
    constructor({ transaction }) {
        super('Cannot infer a transaction type from provided transaction.', {
            metaMessages: [
                'Provided Transaction:',
                '{',
                prettyPrint(transaction),
                '}',
                '',
                'To infer the type, either provide:',
                '- a `type` to the Transaction, or',
                '- an EIP-1559 Transaction with `maxFeePerGas`, or',
                '- an EIP-2930 Transaction with `gasPrice` & `accessList`, or',
                '- an EIP-4844 Transaction with `blobs`, `blobVersionedHashes`, `sidecars`, or',
                '- an EIP-7702 Transaction with `authorizationList`, or',
                '- a Legacy Transaction with `gasPrice`',
            ],
            name: 'InvalidSerializableTransactionError',
        });
    }
}
class TransactionExecutionError extends BaseError$1 {
    constructor(cause, { account, docsPath, chain, data, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, nonce, to, value, }) {
        const prettyArgs = prettyPrint({
            chain: chain && `${chain?.name} (id: ${chain?.id})`,
            from: account?.address,
            to,
            value: typeof value !== 'undefined' &&
                `${formatEther(value)} ${chain?.nativeCurrency?.symbol || 'ETH'}`,
            data,
            gas,
            gasPrice: typeof gasPrice !== 'undefined' && `${formatGwei(gasPrice)} gwei`,
            maxFeePerGas: typeof maxFeePerGas !== 'undefined' &&
                `${formatGwei(maxFeePerGas)} gwei`,
            maxPriorityFeePerGas: typeof maxPriorityFeePerGas !== 'undefined' &&
                `${formatGwei(maxPriorityFeePerGas)} gwei`,
            nonce,
        });
        super(cause.shortMessage, {
            cause,
            docsPath,
            metaMessages: [
                ...(cause.metaMessages ? [...cause.metaMessages, ' '] : []),
                'Request Arguments:',
                prettyArgs,
            ].filter(Boolean),
            name: 'TransactionExecutionError',
        });
        Object.defineProperty(this, "cause", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.cause = cause;
    }
}
class TransactionNotFoundError extends BaseError$1 {
    constructor({ blockHash, blockNumber, blockTag, hash, index, }) {
        let identifier = 'Transaction';
        if (blockTag && index !== undefined)
            identifier = `Transaction at block time "${blockTag}" at index "${index}"`;
        if (blockHash && index !== undefined)
            identifier = `Transaction at block hash "${blockHash}" at index "${index}"`;
        if (blockNumber && index !== undefined)
            identifier = `Transaction at block number "${blockNumber}" at index "${index}"`;
        if (hash)
            identifier = `Transaction with hash "${hash}"`;
        super(`${identifier} could not be found.`, {
            name: 'TransactionNotFoundError',
        });
    }
}
class TransactionReceiptNotFoundError extends BaseError$1 {
    constructor({ hash }) {
        super(`Transaction receipt with hash "${hash}" could not be found. The Transaction may not be processed on a block yet.`, {
            name: 'TransactionReceiptNotFoundError',
        });
    }
}
class TransactionReceiptRevertedError extends BaseError$1 {
    constructor({ receipt }) {
        super(`Transaction with hash "${receipt.transactionHash}" reverted.`, {
            metaMessages: [
                'The receipt marked the transaction as "reverted". This could mean that the function on the contract you are trying to call threw an error.',
                ' ',
                'You can attempt to extract the revert reason by:',
                '- calling the `simulateContract` or `simulateCalls` Action with the `abi` and `functionName` of the contract',
                '- using the `call` Action with raw `data`',
            ],
            name: 'TransactionReceiptRevertedError',
        });
        Object.defineProperty(this, "receipt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.receipt = receipt;
    }
}
class WaitForTransactionReceiptTimeoutError extends BaseError$1 {
    constructor({ hash }) {
        super(`Timed out while waiting for transaction with hash "${hash}" to be confirmed.`, { name: 'WaitForTransactionReceiptTimeoutError' });
    }
}

const getContractAddress = (address) => address;
const getUrl = (url) => url;

class CallExecutionError extends BaseError$1 {
    constructor(cause, { account: account_, docsPath, chain, data, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, nonce, to, value, stateOverride, }) {
        const account = account_ ? parseAccount(account_) : undefined;
        let prettyArgs = prettyPrint({
            from: account?.address,
            to,
            value: typeof value !== 'undefined' &&
                `${formatEther(value)} ${chain?.nativeCurrency?.symbol || 'ETH'}`,
            data,
            gas,
            gasPrice: typeof gasPrice !== 'undefined' && `${formatGwei(gasPrice)} gwei`,
            maxFeePerGas: typeof maxFeePerGas !== 'undefined' &&
                `${formatGwei(maxFeePerGas)} gwei`,
            maxPriorityFeePerGas: typeof maxPriorityFeePerGas !== 'undefined' &&
                `${formatGwei(maxPriorityFeePerGas)} gwei`,
            nonce,
        });
        if (stateOverride) {
            prettyArgs += `\n${prettyStateOverride(stateOverride)}`;
        }
        super(cause.shortMessage, {
            cause,
            docsPath,
            metaMessages: [
                ...(cause.metaMessages ? [...cause.metaMessages, ' '] : []),
                'Raw Call Arguments:',
                prettyArgs,
            ].filter(Boolean),
            name: 'CallExecutionError',
        });
        Object.defineProperty(this, "cause", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.cause = cause;
    }
}
class ContractFunctionExecutionError extends BaseError$1 {
    constructor(cause, { abi, args, contractAddress, docsPath, functionName, sender, }) {
        const abiItem = getAbiItem({ abi, args, name: functionName });
        const formattedArgs = abiItem
            ? formatAbiItemWithArgs({
                abiItem,
                args,
                includeFunctionName: false,
                includeName: false,
            })
            : undefined;
        const functionWithParams = abiItem
            ? formatAbiItem(abiItem, { includeName: true })
            : undefined;
        const prettyArgs = prettyPrint({
            address: contractAddress && getContractAddress(contractAddress),
            function: functionWithParams,
            args: formattedArgs &&
                formattedArgs !== '()' &&
                `${[...Array(functionName?.length ?? 0).keys()]
                    .map(() => ' ')
                    .join('')}${formattedArgs}`,
            sender,
        });
        super(cause.shortMessage ||
            `An unknown error occurred while executing the contract function "${functionName}".`, {
            cause,
            docsPath,
            metaMessages: [
                ...(cause.metaMessages ? [...cause.metaMessages, ' '] : []),
                prettyArgs && 'Contract Call:',
                prettyArgs,
            ].filter(Boolean),
            name: 'ContractFunctionExecutionError',
        });
        Object.defineProperty(this, "abi", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "args", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cause", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "contractAddress", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "formattedArgs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "functionName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sender", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.abi = abi;
        this.args = args;
        this.cause = cause;
        this.contractAddress = contractAddress;
        this.functionName = functionName;
        this.sender = sender;
    }
}
class ContractFunctionRevertedError extends BaseError$1 {
    constructor({ abi, data, functionName, message, }) {
        let cause;
        let decodedData;
        let metaMessages;
        let reason;
        if (data && data !== '0x') {
            try {
                decodedData = decodeErrorResult({ abi, data });
                const { abiItem, errorName, args: errorArgs } = decodedData;
                if (errorName === 'Error') {
                    reason = errorArgs[0];
                }
                else if (errorName === 'Panic') {
                    const [firstArg] = errorArgs;
                    reason = panicReasons[firstArg];
                }
                else {
                    const errorWithParams = abiItem
                        ? formatAbiItem(abiItem, { includeName: true })
                        : undefined;
                    const formattedArgs = abiItem && errorArgs
                        ? formatAbiItemWithArgs({
                            abiItem,
                            args: errorArgs,
                            includeFunctionName: false,
                            includeName: false,
                        })
                        : undefined;
                    metaMessages = [
                        errorWithParams ? `Error: ${errorWithParams}` : '',
                        formattedArgs && formattedArgs !== '()'
                            ? `       ${[...Array(errorName?.length ?? 0).keys()]
                                .map(() => ' ')
                                .join('')}${formattedArgs}`
                            : '',
                    ];
                }
            }
            catch (err) {
                cause = err;
            }
        }
        else if (message)
            reason = message;
        let signature;
        if (cause instanceof AbiErrorSignatureNotFoundError) {
            signature = cause.signature;
            metaMessages = [
                `Unable to decode signature "${signature}" as it was not found on the provided ABI.`,
                'Make sure you are using the correct ABI and that the error exists on it.',
                `You can look up the decoded signature here: https://4byte.sourcify.dev/?q=${signature}.`,
            ];
        }
        super((reason && reason !== 'execution reverted') || signature
            ? [
                `The contract function "${functionName}" reverted with the following ${signature ? 'signature' : 'reason'}:`,
                reason || signature,
            ].join('\n')
            : `The contract function "${functionName}" reverted.`, {
            cause,
            metaMessages,
            name: 'ContractFunctionRevertedError',
        });
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "raw", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "reason", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "signature", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.data = decodedData;
        this.raw = data;
        this.reason = reason;
        this.signature = signature;
    }
}
class ContractFunctionZeroDataError extends BaseError$1 {
    constructor({ functionName }) {
        super(`The contract function "${functionName}" returned no data ("0x").`, {
            metaMessages: [
                'This could be due to any of the following:',
                `  - The contract does not have the function "${functionName}",`,
                '  - The parameters passed to the contract function may be invalid, or',
                '  - The address is not a contract.',
            ],
            name: 'ContractFunctionZeroDataError',
        });
    }
}
class CounterfactualDeploymentFailedError extends BaseError$1 {
    constructor({ factory }) {
        super(`Deployment for counterfactual contract call failed${factory ? ` for factory "${factory}".` : ''}`, {
            metaMessages: [
                'Please ensure:',
                '- The `factory` is a valid contract deployment factory (ie. Create2 Factory, ERC-4337 Factory, etc).',
                '- The `factoryData` is a valid encoded function call for contract deployment function on the factory.',
            ],
            name: 'CounterfactualDeploymentFailedError',
        });
    }
}
class RawContractError extends BaseError$1 {
    constructor({ data, message, }) {
        super(message || '', { name: 'RawContractError' });
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 3
        });
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.data = data;
    }
}

class HttpRequestError extends BaseError$1 {
    constructor({ body, cause, details, headers, status, url, }) {
        super('HTTP request failed.', {
            cause,
            details,
            metaMessages: [
                status && `Status: ${status}`,
                `URL: ${getUrl(url)}`,
                body && `Request body: ${stringify$1(body)}`,
            ].filter(Boolean),
            name: 'HttpRequestError',
        });
        Object.defineProperty(this, "body", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "headers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "url", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.body = body;
        this.headers = headers;
        this.status = status;
        this.url = url;
    }
}
class RpcRequestError extends BaseError$1 {
    constructor({ body, error, url, }) {
        super('RPC Request failed.', {
            cause: error,
            details: error.message,
            metaMessages: [`URL: ${getUrl(url)}`, `Request body: ${stringify$1(body)}`],
            name: 'RpcRequestError',
        });
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "url", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.code = error.code;
        this.data = error.data;
        this.url = url;
    }
}
class TimeoutError extends BaseError$1 {
    constructor({ body, url, }) {
        super('The request took too long to respond.', {
            details: 'The request timed out.',
            metaMessages: [`URL: ${getUrl(url)}`, `Request body: ${stringify$1(body)}`],
            name: 'TimeoutError',
        });
        Object.defineProperty(this, "url", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.url = url;
    }
}

const unknownErrorCode = -1;
class RpcError extends BaseError$1 {
    constructor(cause, { code, docsPath, metaMessages, name, shortMessage, }) {
        super(shortMessage, {
            cause,
            docsPath,
            metaMessages: metaMessages || cause?.metaMessages,
            name: name || 'RpcError',
        });
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = name || cause.name;
        this.code = (cause instanceof RpcRequestError ? cause.code : (code ?? unknownErrorCode));
    }
}
class ProviderRpcError extends RpcError {
    constructor(cause, options) {
        super(cause, options);
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.data = options.data;
    }
}
class ParseRpcError extends RpcError {
    constructor(cause) {
        super(cause, {
            code: ParseRpcError.code,
            name: 'ParseRpcError',
            shortMessage: 'Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text.',
        });
    }
}
Object.defineProperty(ParseRpcError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32700
});
class InvalidRequestRpcError extends RpcError {
    constructor(cause) {
        super(cause, {
            code: InvalidRequestRpcError.code,
            name: 'InvalidRequestRpcError',
            shortMessage: 'JSON is not a valid request object.',
        });
    }
}
Object.defineProperty(InvalidRequestRpcError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32600
});
class MethodNotFoundRpcError extends RpcError {
    constructor(cause, { method } = {}) {
        super(cause, {
            code: MethodNotFoundRpcError.code,
            name: 'MethodNotFoundRpcError',
            shortMessage: `The method${method ? ` "${method}"` : ''} does not exist / is not available.`,
        });
    }
}
Object.defineProperty(MethodNotFoundRpcError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32601
});
class InvalidParamsRpcError extends RpcError {
    constructor(cause) {
        super(cause, {
            code: InvalidParamsRpcError.code,
            name: 'InvalidParamsRpcError',
            shortMessage: [
                'Invalid parameters were provided to the RPC method.',
                'Double check you have provided the correct parameters.',
            ].join('\n'),
        });
    }
}
Object.defineProperty(InvalidParamsRpcError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32602
});
class InternalRpcError extends RpcError {
    constructor(cause) {
        super(cause, {
            code: InternalRpcError.code,
            name: 'InternalRpcError',
            shortMessage: 'An internal error was received.',
        });
    }
}
Object.defineProperty(InternalRpcError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32603
});
class InvalidInputRpcError extends RpcError {
    constructor(cause) {
        super(cause, {
            code: InvalidInputRpcError.code,
            name: 'InvalidInputRpcError',
            shortMessage: [
                'Missing or invalid parameters.',
                'Double check you have provided the correct parameters.',
            ].join('\n'),
        });
    }
}
Object.defineProperty(InvalidInputRpcError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32000
});
class ResourceNotFoundRpcError extends RpcError {
    constructor(cause) {
        super(cause, {
            code: ResourceNotFoundRpcError.code,
            name: 'ResourceNotFoundRpcError',
            shortMessage: 'Requested resource not found.',
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ResourceNotFoundRpcError'
        });
    }
}
Object.defineProperty(ResourceNotFoundRpcError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32001
});
class ResourceUnavailableRpcError extends RpcError {
    constructor(cause) {
        super(cause, {
            code: ResourceUnavailableRpcError.code,
            name: 'ResourceUnavailableRpcError',
            shortMessage: 'Requested resource not available.',
        });
    }
}
Object.defineProperty(ResourceUnavailableRpcError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32002
});
class TransactionRejectedRpcError extends RpcError {
    constructor(cause) {
        super(cause, {
            code: TransactionRejectedRpcError.code,
            name: 'TransactionRejectedRpcError',
            shortMessage: 'Transaction creation failed.',
        });
    }
}
Object.defineProperty(TransactionRejectedRpcError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32003
});
class MethodNotSupportedRpcError extends RpcError {
    constructor(cause, { method } = {}) {
        super(cause, {
            code: MethodNotSupportedRpcError.code,
            name: 'MethodNotSupportedRpcError',
            shortMessage: `Method${method ? ` "${method}"` : ''} is not supported.`,
        });
    }
}
Object.defineProperty(MethodNotSupportedRpcError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32004
});
class LimitExceededRpcError extends RpcError {
    constructor(cause) {
        super(cause, {
            code: LimitExceededRpcError.code,
            name: 'LimitExceededRpcError',
            shortMessage: 'Request exceeds defined limit.',
        });
    }
}
Object.defineProperty(LimitExceededRpcError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32005
});
class JsonRpcVersionUnsupportedError extends RpcError {
    constructor(cause) {
        super(cause, {
            code: JsonRpcVersionUnsupportedError.code,
            name: 'JsonRpcVersionUnsupportedError',
            shortMessage: 'Version of JSON-RPC protocol is not supported.',
        });
    }
}
Object.defineProperty(JsonRpcVersionUnsupportedError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: -32006
});
class UserRejectedRequestError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: UserRejectedRequestError.code,
            name: 'UserRejectedRequestError',
            shortMessage: 'User rejected the request.',
        });
    }
}
Object.defineProperty(UserRejectedRequestError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 4001
});
class UnauthorizedProviderError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: UnauthorizedProviderError.code,
            name: 'UnauthorizedProviderError',
            shortMessage: 'The requested method and/or account has not been authorized by the user.',
        });
    }
}
Object.defineProperty(UnauthorizedProviderError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 4100
});
class UnsupportedProviderMethodError extends ProviderRpcError {
    constructor(cause, { method } = {}) {
        super(cause, {
            code: UnsupportedProviderMethodError.code,
            name: 'UnsupportedProviderMethodError',
            shortMessage: `The Provider does not support the requested method${method ? ` " ${method}"` : ''}.`,
        });
    }
}
Object.defineProperty(UnsupportedProviderMethodError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 4200
});
class ProviderDisconnectedError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: ProviderDisconnectedError.code,
            name: 'ProviderDisconnectedError',
            shortMessage: 'The Provider is disconnected from all chains.',
        });
    }
}
Object.defineProperty(ProviderDisconnectedError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 4900
});
class ChainDisconnectedError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: ChainDisconnectedError.code,
            name: 'ChainDisconnectedError',
            shortMessage: 'The Provider is not connected to the requested chain.',
        });
    }
}
Object.defineProperty(ChainDisconnectedError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 4901
});
class SwitchChainError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: SwitchChainError.code,
            name: 'SwitchChainError',
            shortMessage: 'An error occurred when attempting to switch chain.',
        });
    }
}
Object.defineProperty(SwitchChainError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 4902
});
class UnsupportedNonOptionalCapabilityError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: UnsupportedNonOptionalCapabilityError.code,
            name: 'UnsupportedNonOptionalCapabilityError',
            shortMessage: 'This Wallet does not support a capability that was not marked as optional.',
        });
    }
}
Object.defineProperty(UnsupportedNonOptionalCapabilityError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 5700
});
class UnsupportedChainIdError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: UnsupportedChainIdError.code,
            name: 'UnsupportedChainIdError',
            shortMessage: 'This Wallet does not support the requested chain ID.',
        });
    }
}
Object.defineProperty(UnsupportedChainIdError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 5710
});
class DuplicateIdError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: DuplicateIdError.code,
            name: 'DuplicateIdError',
            shortMessage: 'There is already a bundle submitted with this ID.',
        });
    }
}
Object.defineProperty(DuplicateIdError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 5720
});
class UnknownBundleIdError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: UnknownBundleIdError.code,
            name: 'UnknownBundleIdError',
            shortMessage: 'This bundle id is unknown / has not been submitted',
        });
    }
}
Object.defineProperty(UnknownBundleIdError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 5730
});
class BundleTooLargeError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: BundleTooLargeError.code,
            name: 'BundleTooLargeError',
            shortMessage: 'The call bundle is too large for the Wallet to process.',
        });
    }
}
Object.defineProperty(BundleTooLargeError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 5740
});
class AtomicReadyWalletRejectedUpgradeError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: AtomicReadyWalletRejectedUpgradeError.code,
            name: 'AtomicReadyWalletRejectedUpgradeError',
            shortMessage: 'The Wallet can support atomicity after an upgrade, but the user rejected the upgrade.',
        });
    }
}
Object.defineProperty(AtomicReadyWalletRejectedUpgradeError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 5750
});
class AtomicityNotSupportedError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: AtomicityNotSupportedError.code,
            name: 'AtomicityNotSupportedError',
            shortMessage: 'The wallet does not support atomic execution but the request requires it.',
        });
    }
}
Object.defineProperty(AtomicityNotSupportedError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 5760
});
class WalletConnectSessionSettlementError extends ProviderRpcError {
    constructor(cause) {
        super(cause, {
            code: WalletConnectSessionSettlementError.code,
            name: 'WalletConnectSessionSettlementError',
            shortMessage: 'WalletConnect session settlement failed.',
        });
    }
}
Object.defineProperty(WalletConnectSessionSettlementError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 7000
});
class UnknownRpcError extends RpcError {
    constructor(cause) {
        super(cause, {
            name: 'UnknownRpcError',
            shortMessage: 'An unknown RPC error occurred.',
        });
    }
}

const EXECUTION_REVERTED_ERROR_CODE = 3;
function getContractError(err, { abi, address, args, docsPath, functionName, sender, }) {
    const error = (err instanceof RawContractError
        ? err
        : err instanceof BaseError$1
            ? err.walk((err) => 'data' in err) || err.walk()
            : {});
    const { code, data, details, message, shortMessage } = error;
    const cause = (() => {
        if (err instanceof AbiDecodingZeroDataError)
            return new ContractFunctionZeroDataError({ functionName });
        if (([EXECUTION_REVERTED_ERROR_CODE, InternalRpcError.code].includes(code) &&
            (data || details || message || shortMessage)) ||
            (code === InvalidInputRpcError.code &&
                details === 'execution reverted' &&
                data)) {
            return new ContractFunctionRevertedError({
                abi,
                data: typeof data === 'object' ? data.data : data,
                functionName,
                message: error instanceof RpcRequestError
                    ? details
                    : (shortMessage ?? message),
            });
        }
        return err;
    })();
    return new ContractFunctionExecutionError(cause, {
        abi,
        args,
        contractAddress: address,
        docsPath,
        functionName,
        sender,
    });
}

/**
 * @description Converts an ECDSA public key to an address.
 *
 * @param publicKey The public key to convert.
 *
 * @returns The address.
 */
function publicKeyToAddress(publicKey) {
    const address = keccak256$1(`0x${publicKey.substring(4)}`).substring(26);
    return checksumAddress(`0x${address}`);
}

async function recoverPublicKey({ hash, signature, }) {
    const hashHex = isHex(hash) ? hash : toHex(hash);
    const { secp256k1 } = await Promise.resolve().then(function () { return secp256k1$1; });
    const signature_ = (() => {
        // typeof signature: `Signature`
        if (typeof signature === 'object' && 'r' in signature && 's' in signature) {
            const { r, s, v, yParity } = signature;
            const yParityOrV = Number(yParity ?? v);
            const recoveryBit = toRecoveryBit(yParityOrV);
            return new secp256k1.Signature(hexToBigInt(r), hexToBigInt(s)).addRecoveryBit(recoveryBit);
        }
        // typeof signature: `Hex | ByteArray`
        const signatureHex = isHex(signature) ? signature : toHex(signature);
        if (size$3(signatureHex) !== 65)
            throw new Error('invalid signature length');
        const yParityOrV = hexToNumber$1(`0x${signatureHex.slice(130)}`);
        const recoveryBit = toRecoveryBit(yParityOrV);
        return secp256k1.Signature.fromCompact(signatureHex.substring(2, 130)).addRecoveryBit(recoveryBit);
    })();
    const publicKey = signature_
        .recoverPublicKey(hashHex.substring(2))
        .toHex(false);
    return `0x${publicKey}`;
}
function toRecoveryBit(yParityOrV) {
    if (yParityOrV === 0 || yParityOrV === 1)
        return yParityOrV;
    if (yParityOrV === 27)
        return 0;
    if (yParityOrV === 28)
        return 1;
    throw new Error('Invalid yParityOrV value');
}

async function recoverAddress({ hash, signature, }) {
    return publicKeyToAddress(await recoverPublicKey({ hash, signature }));
}

function toRlp(bytes, to = 'hex') {
    const encodable = getEncodable(bytes);
    const cursor = createCursor(new Uint8Array(encodable.length));
    encodable.encode(cursor);
    if (to === 'hex')
        return bytesToHex$1(cursor.bytes);
    return cursor.bytes;
}
function getEncodable(bytes) {
    if (Array.isArray(bytes))
        return getEncodableList(bytes.map((x) => getEncodable(x)));
    return getEncodableBytes(bytes);
}
function getEncodableList(list) {
    const bodyLength = list.reduce((acc, x) => acc + x.length, 0);
    const sizeOfBodyLength = getSizeOfLength(bodyLength);
    const length = (() => {
        if (bodyLength <= 55)
            return 1 + bodyLength;
        return 1 + sizeOfBodyLength + bodyLength;
    })();
    return {
        length,
        encode(cursor) {
            if (bodyLength <= 55) {
                cursor.pushByte(0xc0 + bodyLength);
            }
            else {
                cursor.pushByte(0xc0 + 55 + sizeOfBodyLength);
                if (sizeOfBodyLength === 1)
                    cursor.pushUint8(bodyLength);
                else if (sizeOfBodyLength === 2)
                    cursor.pushUint16(bodyLength);
                else if (sizeOfBodyLength === 3)
                    cursor.pushUint24(bodyLength);
                else
                    cursor.pushUint32(bodyLength);
            }
            for (const { encode } of list) {
                encode(cursor);
            }
        },
    };
}
function getEncodableBytes(bytesOrHex) {
    const bytes = typeof bytesOrHex === 'string' ? hexToBytes$1(bytesOrHex) : bytesOrHex;
    const sizeOfBytesLength = getSizeOfLength(bytes.length);
    const length = (() => {
        if (bytes.length === 1 && bytes[0] < 0x80)
            return 1;
        if (bytes.length <= 55)
            return 1 + bytes.length;
        return 1 + sizeOfBytesLength + bytes.length;
    })();
    return {
        length,
        encode(cursor) {
            if (bytes.length === 1 && bytes[0] < 0x80) {
                cursor.pushBytes(bytes);
            }
            else if (bytes.length <= 55) {
                cursor.pushByte(0x80 + bytes.length);
                cursor.pushBytes(bytes);
            }
            else {
                cursor.pushByte(0x80 + 55 + sizeOfBytesLength);
                if (sizeOfBytesLength === 1)
                    cursor.pushUint8(bytes.length);
                else if (sizeOfBytesLength === 2)
                    cursor.pushUint16(bytes.length);
                else if (sizeOfBytesLength === 3)
                    cursor.pushUint24(bytes.length);
                else
                    cursor.pushUint32(bytes.length);
                cursor.pushBytes(bytes);
            }
        },
    };
}
function getSizeOfLength(length) {
    if (length < 2 ** 8)
        return 1;
    if (length < 2 ** 16)
        return 2;
    if (length < 2 ** 24)
        return 3;
    if (length < 2 ** 32)
        return 4;
    throw new BaseError$1('Length is too large.');
}

/**
 * Computes an Authorization hash in [EIP-7702 format](https://eips.ethereum.org/EIPS/eip-7702): `keccak256('0x05' || rlp([chain_id, address, nonce]))`.
 */
function hashAuthorization(parameters) {
    const { chainId, nonce, to } = parameters;
    const address = parameters.contractAddress ?? parameters.address;
    const hash = keccak256$1(concatHex([
        '0x05',
        toRlp([
            chainId ? numberToHex(chainId) : '0x',
            address,
            nonce ? numberToHex(nonce) : '0x',
        ]),
    ]));
    if (to === 'bytes')
        return hexToBytes$1(hash);
    return hash;
}

async function recoverAuthorizationAddress(parameters) {
    const { authorization, signature } = parameters;
    return recoverAddress({
        hash: hashAuthorization(authorization),
        signature: (signature ?? authorization),
    });
}

class EstimateGasExecutionError extends BaseError$1 {
    constructor(cause, { account, docsPath, chain, data, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, nonce, to, value, }) {
        const prettyArgs = prettyPrint({
            from: account?.address,
            to,
            value: typeof value !== 'undefined' &&
                `${formatEther(value)} ${chain?.nativeCurrency?.symbol || 'ETH'}`,
            data,
            gas,
            gasPrice: typeof gasPrice !== 'undefined' && `${formatGwei(gasPrice)} gwei`,
            maxFeePerGas: typeof maxFeePerGas !== 'undefined' &&
                `${formatGwei(maxFeePerGas)} gwei`,
            maxPriorityFeePerGas: typeof maxPriorityFeePerGas !== 'undefined' &&
                `${formatGwei(maxPriorityFeePerGas)} gwei`,
            nonce,
        });
        super(cause.shortMessage, {
            cause,
            docsPath,
            metaMessages: [
                ...(cause.metaMessages ? [...cause.metaMessages, ' '] : []),
                'Estimate Gas Arguments:',
                prettyArgs,
            ].filter(Boolean),
            name: 'EstimateGasExecutionError',
        });
        Object.defineProperty(this, "cause", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.cause = cause;
    }
}

class ExecutionRevertedError extends BaseError$1 {
    constructor({ cause, message, } = {}) {
        const reason = message
            ?.replace('execution reverted: ', '')
            ?.replace('execution reverted', '');
        super(`Execution reverted ${reason ? `with reason: ${reason}` : 'for an unknown reason'}.`, {
            cause,
            name: 'ExecutionRevertedError',
        });
    }
}
Object.defineProperty(ExecutionRevertedError, "code", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 3
});
Object.defineProperty(ExecutionRevertedError, "nodeMessage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: /execution reverted|gas required exceeds allowance/
});
class FeeCapTooHighError extends BaseError$1 {
    constructor({ cause, maxFeePerGas, } = {}) {
        super(`The fee cap (\`maxFeePerGas\`${maxFeePerGas ? ` = ${formatGwei(maxFeePerGas)} gwei` : ''}) cannot be higher than the maximum allowed value (2^256-1).`, {
            cause,
            name: 'FeeCapTooHighError',
        });
    }
}
Object.defineProperty(FeeCapTooHighError, "nodeMessage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: /max fee per gas higher than 2\^256-1|fee cap higher than 2\^256-1/
});
class FeeCapTooLowError extends BaseError$1 {
    constructor({ cause, maxFeePerGas, } = {}) {
        super(`The fee cap (\`maxFeePerGas\`${maxFeePerGas ? ` = ${formatGwei(maxFeePerGas)}` : ''} gwei) cannot be lower than the block base fee.`, {
            cause,
            name: 'FeeCapTooLowError',
        });
    }
}
Object.defineProperty(FeeCapTooLowError, "nodeMessage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: /max fee per gas less than block base fee|fee cap less than block base fee|transaction is outdated/
});
class NonceTooHighError extends BaseError$1 {
    constructor({ cause, nonce, } = {}) {
        super(`Nonce provided for the transaction ${nonce ? `(${nonce}) ` : ''}is higher than the next one expected.`, { cause, name: 'NonceTooHighError' });
    }
}
Object.defineProperty(NonceTooHighError, "nodeMessage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: /nonce too high/
});
class NonceTooLowError extends BaseError$1 {
    constructor({ cause, nonce, } = {}) {
        super([
            `Nonce provided for the transaction ${nonce ? `(${nonce}) ` : ''}is lower than the current nonce of the account.`,
            'Try increasing the nonce or find the latest nonce with `getTransactionCount`.',
        ].join('\n'), { cause, name: 'NonceTooLowError' });
    }
}
Object.defineProperty(NonceTooLowError, "nodeMessage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: /nonce too low|transaction already imported|already known/
});
class NonceMaxValueError extends BaseError$1 {
    constructor({ cause, nonce, } = {}) {
        super(`Nonce provided for the transaction ${nonce ? `(${nonce}) ` : ''}exceeds the maximum allowed nonce.`, { cause, name: 'NonceMaxValueError' });
    }
}
Object.defineProperty(NonceMaxValueError, "nodeMessage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: /nonce has max value/
});
class InsufficientFundsError extends BaseError$1 {
    constructor({ cause } = {}) {
        super([
            'The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account.',
        ].join('\n'), {
            cause,
            metaMessages: [
                'This error could arise when the account does not have enough funds to:',
                ' - pay for the total gas fee,',
                ' - pay for the value to send.',
                ' ',
                'The cost of the transaction is calculated as `gas * gas fee + value`, where:',
                ' - `gas` is the amount of gas needed for transaction to execute,',
                ' - `gas fee` is the gas fee,',
                ' - `value` is the amount of ether to send to the recipient.',
            ],
            name: 'InsufficientFundsError',
        });
    }
}
Object.defineProperty(InsufficientFundsError, "nodeMessage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: /insufficient funds|exceeds transaction sender account balance/
});
class IntrinsicGasTooHighError extends BaseError$1 {
    constructor({ cause, gas, } = {}) {
        super(`The amount of gas ${gas ? `(${gas}) ` : ''}provided for the transaction exceeds the limit allowed for the block.`, {
            cause,
            name: 'IntrinsicGasTooHighError',
        });
    }
}
Object.defineProperty(IntrinsicGasTooHighError, "nodeMessage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: /intrinsic gas too high|gas limit reached/
});
class IntrinsicGasTooLowError extends BaseError$1 {
    constructor({ cause, gas, } = {}) {
        super(`The amount of gas ${gas ? `(${gas}) ` : ''}provided for the transaction is too low.`, {
            cause,
            name: 'IntrinsicGasTooLowError',
        });
    }
}
Object.defineProperty(IntrinsicGasTooLowError, "nodeMessage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: /intrinsic gas too low/
});
class TransactionTypeNotSupportedError extends BaseError$1 {
    constructor({ cause }) {
        super('The transaction type is not supported for this chain.', {
            cause,
            name: 'TransactionTypeNotSupportedError',
        });
    }
}
Object.defineProperty(TransactionTypeNotSupportedError, "nodeMessage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: /transaction type not valid/
});
class TipAboveFeeCapError extends BaseError$1 {
    constructor({ cause, maxPriorityFeePerGas, maxFeePerGas, } = {}) {
        super([
            `The provided tip (\`maxPriorityFeePerGas\`${maxPriorityFeePerGas
                ? ` = ${formatGwei(maxPriorityFeePerGas)} gwei`
                : ''}) cannot be higher than the fee cap (\`maxFeePerGas\`${maxFeePerGas ? ` = ${formatGwei(maxFeePerGas)} gwei` : ''}).`,
        ].join('\n'), {
            cause,
            name: 'TipAboveFeeCapError',
        });
    }
}
Object.defineProperty(TipAboveFeeCapError, "nodeMessage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: /max priority fee per gas higher than max fee per gas|tip higher than fee cap/
});
class UnknownNodeError extends BaseError$1 {
    constructor({ cause }) {
        super(`An error occurred while executing: ${cause?.shortMessage}`, {
            cause,
            name: 'UnknownNodeError',
        });
    }
}

function getNodeError(err, args) {
    const message = (err.details || '').toLowerCase();
    const executionRevertedError = err instanceof BaseError$1
        ? err.walk((e) => e?.code ===
            ExecutionRevertedError.code)
        : err;
    if (executionRevertedError instanceof BaseError$1)
        return new ExecutionRevertedError({
            cause: err,
            message: executionRevertedError.details,
        });
    if (ExecutionRevertedError.nodeMessage.test(message))
        return new ExecutionRevertedError({
            cause: err,
            message: err.details,
        });
    if (FeeCapTooHighError.nodeMessage.test(message))
        return new FeeCapTooHighError({
            cause: err,
            maxFeePerGas: args?.maxFeePerGas,
        });
    if (FeeCapTooLowError.nodeMessage.test(message))
        return new FeeCapTooLowError({
            cause: err,
            maxFeePerGas: args?.maxFeePerGas,
        });
    if (NonceTooHighError.nodeMessage.test(message))
        return new NonceTooHighError({ cause: err, nonce: args?.nonce });
    if (NonceTooLowError.nodeMessage.test(message))
        return new NonceTooLowError({ cause: err, nonce: args?.nonce });
    if (NonceMaxValueError.nodeMessage.test(message))
        return new NonceMaxValueError({ cause: err, nonce: args?.nonce });
    if (InsufficientFundsError.nodeMessage.test(message))
        return new InsufficientFundsError({ cause: err });
    if (IntrinsicGasTooHighError.nodeMessage.test(message))
        return new IntrinsicGasTooHighError({ cause: err, gas: args?.gas });
    if (IntrinsicGasTooLowError.nodeMessage.test(message))
        return new IntrinsicGasTooLowError({ cause: err, gas: args?.gas });
    if (TransactionTypeNotSupportedError.nodeMessage.test(message))
        return new TransactionTypeNotSupportedError({ cause: err });
    if (TipAboveFeeCapError.nodeMessage.test(message))
        return new TipAboveFeeCapError({
            cause: err,
            maxFeePerGas: args?.maxFeePerGas,
            maxPriorityFeePerGas: args?.maxPriorityFeePerGas,
        });
    return new UnknownNodeError({
        cause: err,
    });
}

function getEstimateGasError(err, { docsPath, ...args }) {
    const cause = (() => {
        const cause = getNodeError(err, args);
        if (cause instanceof UnknownNodeError)
            return err;
        return cause;
    })();
    return new EstimateGasExecutionError(cause, {
        docsPath,
        ...args,
    });
}

/**
 * @description Picks out the keys from `value` that exist in the formatter..
 */
function extract$1(value_, { format }) {
    if (!format)
        return {};
    const value = {};
    function extract_(formatted) {
        const keys = Object.keys(formatted);
        for (const key of keys) {
            if (key in value_)
                value[key] = value_[key];
            if (formatted[key] &&
                typeof formatted[key] === 'object' &&
                !Array.isArray(formatted[key]))
                extract_(formatted[key]);
        }
    }
    const formatted = format(value_ || {});
    extract_(formatted);
    return value;
}

const rpcTransactionType = {
    legacy: '0x0',
    eip2930: '0x1',
    eip1559: '0x2',
    eip4844: '0x3',
    eip7702: '0x4',
};
function formatTransactionRequest(request, _) {
    const rpcRequest = {};
    if (typeof request.authorizationList !== 'undefined')
        rpcRequest.authorizationList = formatAuthorizationList$1(request.authorizationList);
    if (typeof request.accessList !== 'undefined')
        rpcRequest.accessList = request.accessList;
    if (typeof request.blobVersionedHashes !== 'undefined')
        rpcRequest.blobVersionedHashes = request.blobVersionedHashes;
    if (typeof request.blobs !== 'undefined') {
        if (typeof request.blobs[0] !== 'string')
            rpcRequest.blobs = request.blobs.map((x) => bytesToHex$1(x));
        else
            rpcRequest.blobs = request.blobs;
    }
    if (typeof request.data !== 'undefined')
        rpcRequest.data = request.data;
    if (request.account)
        rpcRequest.from = request.account.address;
    if (typeof request.from !== 'undefined')
        rpcRequest.from = request.from;
    if (typeof request.gas !== 'undefined')
        rpcRequest.gas = numberToHex(request.gas);
    if (typeof request.gasPrice !== 'undefined')
        rpcRequest.gasPrice = numberToHex(request.gasPrice);
    if (typeof request.maxFeePerBlobGas !== 'undefined')
        rpcRequest.maxFeePerBlobGas = numberToHex(request.maxFeePerBlobGas);
    if (typeof request.maxFeePerGas !== 'undefined')
        rpcRequest.maxFeePerGas = numberToHex(request.maxFeePerGas);
    if (typeof request.maxPriorityFeePerGas !== 'undefined')
        rpcRequest.maxPriorityFeePerGas = numberToHex(request.maxPriorityFeePerGas);
    if (typeof request.nonce !== 'undefined')
        rpcRequest.nonce = numberToHex(request.nonce);
    if (typeof request.to !== 'undefined')
        rpcRequest.to = request.to;
    if (typeof request.type !== 'undefined')
        rpcRequest.type = rpcTransactionType[request.type];
    if (typeof request.value !== 'undefined')
        rpcRequest.value = numberToHex(request.value);
    return rpcRequest;
}
//////////////////////////////////////////////////////////////////////////////
function formatAuthorizationList$1(authorizationList) {
    return authorizationList.map((authorization) => ({
        address: authorization.address,
        r: authorization.r
            ? numberToHex(BigInt(authorization.r))
            : authorization.r,
        s: authorization.s
            ? numberToHex(BigInt(authorization.s))
            : authorization.s,
        chainId: numberToHex(authorization.chainId),
        nonce: numberToHex(authorization.nonce),
        ...(typeof authorization.yParity !== 'undefined'
            ? { yParity: numberToHex(authorization.yParity) }
            : {}),
        ...(typeof authorization.v !== 'undefined' &&
            typeof authorization.yParity === 'undefined'
            ? { v: numberToHex(authorization.v) }
            : {}),
    }));
}

/** @internal */
function serializeStateMapping(stateMapping) {
    if (!stateMapping || stateMapping.length === 0)
        return undefined;
    return stateMapping.reduce((acc, { slot, value }) => {
        if (slot.length !== 66)
            throw new InvalidBytesLengthError({
                size: slot.length,
                targetSize: 66,
                type: 'hex',
            });
        if (value.length !== 66)
            throw new InvalidBytesLengthError({
                size: value.length,
                targetSize: 66,
                type: 'hex',
            });
        acc[slot] = value;
        return acc;
    }, {});
}
/** @internal */
function serializeAccountStateOverride(parameters) {
    const { balance, nonce, state, stateDiff, code } = parameters;
    const rpcAccountStateOverride = {};
    if (code !== undefined)
        rpcAccountStateOverride.code = code;
    if (balance !== undefined)
        rpcAccountStateOverride.balance = numberToHex(balance);
    if (nonce !== undefined)
        rpcAccountStateOverride.nonce = numberToHex(nonce);
    if (state !== undefined)
        rpcAccountStateOverride.state = serializeStateMapping(state);
    if (stateDiff !== undefined) {
        if (rpcAccountStateOverride.state)
            throw new StateAssignmentConflictError();
        rpcAccountStateOverride.stateDiff = serializeStateMapping(stateDiff);
    }
    return rpcAccountStateOverride;
}
/** @internal */
function serializeStateOverride(parameters) {
    if (!parameters)
        return undefined;
    const rpcStateOverride = {};
    for (const { address, ...accountState } of parameters) {
        if (!isAddress(address, { strict: false }))
            throw new InvalidAddressError$1({ address });
        if (rpcStateOverride[address])
            throw new AccountStateConflictError({ address: address });
        rpcStateOverride[address] = serializeAccountStateOverride(accountState);
    }
    return rpcStateOverride;
}

const maxUint256$1 = 2n ** 256n - 1n;

function assertRequest(args) {
    const { account: account_, maxFeePerGas, maxPriorityFeePerGas, to } = args;
    const account = account_ ? parseAccount(account_) : undefined;
    if (account && !isAddress(account.address))
        throw new InvalidAddressError$1({ address: account.address });
    if (to && !isAddress(to))
        throw new InvalidAddressError$1({ address: to });
    if (maxFeePerGas && maxFeePerGas > maxUint256$1)
        throw new FeeCapTooHighError({ maxFeePerGas });
    if (maxPriorityFeePerGas &&
        maxFeePerGas &&
        maxPriorityFeePerGas > maxFeePerGas)
        throw new TipAboveFeeCapError({ maxFeePerGas, maxPriorityFeePerGas });
}

class BaseFeeScalarError extends BaseError$1 {
    constructor() {
        super('`baseFeeMultiplier` must be greater than 1.', {
            name: 'BaseFeeScalarError',
        });
    }
}
class Eip1559FeesNotSupportedError extends BaseError$1 {
    constructor() {
        super('Chain does not support EIP-1559 fees.', {
            name: 'Eip1559FeesNotSupportedError',
        });
    }
}
class MaxFeePerGasTooLowError extends BaseError$1 {
    constructor({ maxPriorityFeePerGas }) {
        super(`\`maxFeePerGas\` cannot be less than the \`maxPriorityFeePerGas\` (${formatGwei(maxPriorityFeePerGas)} gwei).`, { name: 'MaxFeePerGasTooLowError' });
    }
}

class BlockNotFoundError extends BaseError$1 {
    constructor({ blockHash, blockNumber, }) {
        let identifier = 'Block';
        if (blockHash)
            identifier = `Block at hash "${blockHash}"`;
        if (blockNumber)
            identifier = `Block at number "${blockNumber}"`;
        super(`${identifier} could not be found.`, { name: 'BlockNotFoundError' });
    }
}

const transactionType = {
    '0x0': 'legacy',
    '0x1': 'eip2930',
    '0x2': 'eip1559',
    '0x3': 'eip4844',
    '0x4': 'eip7702',
};
function formatTransaction(transaction, _) {
    const transaction_ = {
        ...transaction,
        blockHash: transaction.blockHash ? transaction.blockHash : null,
        blockNumber: transaction.blockNumber
            ? BigInt(transaction.blockNumber)
            : null,
        chainId: transaction.chainId ? hexToNumber$1(transaction.chainId) : undefined,
        gas: transaction.gas ? BigInt(transaction.gas) : undefined,
        gasPrice: transaction.gasPrice ? BigInt(transaction.gasPrice) : undefined,
        maxFeePerBlobGas: transaction.maxFeePerBlobGas
            ? BigInt(transaction.maxFeePerBlobGas)
            : undefined,
        maxFeePerGas: transaction.maxFeePerGas
            ? BigInt(transaction.maxFeePerGas)
            : undefined,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas
            ? BigInt(transaction.maxPriorityFeePerGas)
            : undefined,
        nonce: transaction.nonce ? hexToNumber$1(transaction.nonce) : undefined,
        to: transaction.to ? transaction.to : null,
        transactionIndex: transaction.transactionIndex
            ? Number(transaction.transactionIndex)
            : null,
        type: transaction.type
            ? transactionType[transaction.type]
            : undefined,
        typeHex: transaction.type ? transaction.type : undefined,
        value: transaction.value ? BigInt(transaction.value) : undefined,
        v: transaction.v ? BigInt(transaction.v) : undefined,
    };
    if (transaction.authorizationList)
        transaction_.authorizationList = formatAuthorizationList(transaction.authorizationList);
    transaction_.yParity = (() => {
        // If `yParity` is provided, we will use it.
        if (transaction.yParity)
            return Number(transaction.yParity);
        // If no `yParity` provided, try derive from `v`.
        if (typeof transaction_.v === 'bigint') {
            if (transaction_.v === 0n || transaction_.v === 27n)
                return 0;
            if (transaction_.v === 1n || transaction_.v === 28n)
                return 1;
            if (transaction_.v >= 35n)
                return transaction_.v % 2n === 0n ? 1 : 0;
        }
        return undefined;
    })();
    if (transaction_.type === 'legacy') {
        delete transaction_.accessList;
        delete transaction_.maxFeePerBlobGas;
        delete transaction_.maxFeePerGas;
        delete transaction_.maxPriorityFeePerGas;
        delete transaction_.yParity;
    }
    if (transaction_.type === 'eip2930') {
        delete transaction_.maxFeePerBlobGas;
        delete transaction_.maxFeePerGas;
        delete transaction_.maxPriorityFeePerGas;
    }
    if (transaction_.type === 'eip1559')
        delete transaction_.maxFeePerBlobGas;
    return transaction_;
}
//////////////////////////////////////////////////////////////////////////////
function formatAuthorizationList(authorizationList) {
    return authorizationList.map((authorization) => ({
        address: authorization.address,
        chainId: Number(authorization.chainId),
        nonce: Number(authorization.nonce),
        r: authorization.r,
        s: authorization.s,
        yParity: Number(authorization.yParity),
    }));
}

function formatBlock(block, _) {
    const transactions = (block.transactions ?? []).map((transaction) => {
        if (typeof transaction === 'string')
            return transaction;
        return formatTransaction(transaction);
    });
    return {
        ...block,
        baseFeePerGas: block.baseFeePerGas ? BigInt(block.baseFeePerGas) : null,
        blobGasUsed: block.blobGasUsed ? BigInt(block.blobGasUsed) : undefined,
        difficulty: block.difficulty ? BigInt(block.difficulty) : undefined,
        excessBlobGas: block.excessBlobGas
            ? BigInt(block.excessBlobGas)
            : undefined,
        gasLimit: block.gasLimit ? BigInt(block.gasLimit) : undefined,
        gasUsed: block.gasUsed ? BigInt(block.gasUsed) : undefined,
        hash: block.hash ? block.hash : null,
        logsBloom: block.logsBloom ? block.logsBloom : null,
        nonce: block.nonce ? block.nonce : null,
        number: block.number ? BigInt(block.number) : null,
        size: block.size ? BigInt(block.size) : undefined,
        timestamp: block.timestamp ? BigInt(block.timestamp) : undefined,
        transactions,
        totalDifficulty: block.totalDifficulty
            ? BigInt(block.totalDifficulty)
            : null,
    };
}

/**
 * Returns information about a block at a block number, hash, or tag.
 *
 * - Docs: https://viem.sh/docs/actions/public/getBlock
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_fetching-blocks
 * - JSON-RPC Methods:
 *   - Calls [`eth_getBlockByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbynumber) for `blockNumber` & `blockTag`.
 *   - Calls [`eth_getBlockByHash`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbyhash) for `blockHash`.
 *
 * @param client - Client to use
 * @param parameters - {@link GetBlockParameters}
 * @returns Information about the block. {@link GetBlockReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getBlock } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const block = await getBlock(client)
 */
async function getBlock(client, { blockHash, blockNumber, blockTag = client.experimental_blockTag ?? 'latest', includeTransactions: includeTransactions_, } = {}) {
    const includeTransactions = includeTransactions_ ?? false;
    const blockNumberHex = blockNumber !== undefined ? numberToHex(blockNumber) : undefined;
    let block = null;
    if (blockHash) {
        block = await client.request({
            method: 'eth_getBlockByHash',
            params: [blockHash, includeTransactions],
        }, { dedupe: true });
    }
    else {
        block = await client.request({
            method: 'eth_getBlockByNumber',
            params: [blockNumberHex || blockTag, includeTransactions],
        }, { dedupe: Boolean(blockNumberHex) });
    }
    if (!block)
        throw new BlockNotFoundError({ blockHash, blockNumber });
    const format = client.chain?.formatters?.block?.format || formatBlock;
    return format(block, 'getBlock');
}

/**
 * Returns the current price of gas (in wei).
 *
 * - Docs: https://viem.sh/docs/actions/public/getGasPrice
 * - JSON-RPC Methods: [`eth_gasPrice`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gasprice)
 *
 * @param client - Client to use
 * @returns The gas price (in wei). {@link GetGasPriceReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getGasPrice } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const gasPrice = await getGasPrice(client)
 */
async function getGasPrice(client) {
    const gasPrice = await client.request({
        method: 'eth_gasPrice',
    });
    return BigInt(gasPrice);
}

/**
 * Returns an estimate for the max priority fee per gas (in wei) for a
 * transaction to be likely included in the next block.
 * Defaults to [`chain.fees.defaultPriorityFee`](/docs/clients/chains#fees-defaultpriorityfee) if set.
 *
 * - Docs: https://viem.sh/docs/actions/public/estimateMaxPriorityFeePerGas
 *
 * @param client - Client to use
 * @returns An estimate (in wei) for the max priority fee per gas. {@link EstimateMaxPriorityFeePerGasReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { estimateMaxPriorityFeePerGas } from 'viem/actions'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const maxPriorityFeePerGas = await estimateMaxPriorityFeePerGas(client)
 * // 10000000n
 */
async function estimateMaxPriorityFeePerGas(client, args) {
    return internal_estimateMaxPriorityFeePerGas(client, args);
}
async function internal_estimateMaxPriorityFeePerGas(client, args) {
    const { block: block_, chain = client.chain, request } = args || {};
    try {
        const maxPriorityFeePerGas = chain?.fees?.maxPriorityFeePerGas ?? chain?.fees?.defaultPriorityFee;
        if (typeof maxPriorityFeePerGas === 'function') {
            const block = block_ || (await getAction(client, getBlock, 'getBlock')({}));
            const maxPriorityFeePerGas_ = await maxPriorityFeePerGas({
                block,
                client,
                request,
            });
            if (maxPriorityFeePerGas_ === null)
                throw new Error();
            return maxPriorityFeePerGas_;
        }
        if (typeof maxPriorityFeePerGas !== 'undefined')
            return maxPriorityFeePerGas;
        const maxPriorityFeePerGasHex = await client.request({
            method: 'eth_maxPriorityFeePerGas',
        });
        return hexToBigInt(maxPriorityFeePerGasHex);
    }
    catch {
        // If the RPC Provider does not support `eth_maxPriorityFeePerGas`
        // fall back to calculating it manually via `gasPrice - baseFeePerGas`.
        // See: https://github.com/ethereum/pm/issues/328#:~:text=eth_maxPriorityFeePerGas%20after%20London%20will%20effectively%20return%20eth_gasPrice%20%2D%20baseFee
        const [block, gasPrice] = await Promise.all([
            block_
                ? Promise.resolve(block_)
                : getAction(client, getBlock, 'getBlock')({}),
            getAction(client, getGasPrice, 'getGasPrice')({}),
        ]);
        if (typeof block.baseFeePerGas !== 'bigint')
            throw new Eip1559FeesNotSupportedError();
        const maxPriorityFeePerGas = gasPrice - block.baseFeePerGas;
        if (maxPriorityFeePerGas < 0n)
            return 0n;
        return maxPriorityFeePerGas;
    }
}

/**
 * Returns an estimate for the fees per gas (in wei) for a
 * transaction to be likely included in the next block.
 * Defaults to [`chain.fees.estimateFeesPerGas`](/docs/clients/chains#fees-estimatefeespergas) if set.
 *
 * - Docs: https://viem.sh/docs/actions/public/estimateFeesPerGas
 *
 * @param client - Client to use
 * @param parameters - {@link EstimateFeesPerGasParameters}
 * @returns An estimate (in wei) for the fees per gas. {@link EstimateFeesPerGasReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { estimateFeesPerGas } from 'viem/actions'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const maxPriorityFeePerGas = await estimateFeesPerGas(client)
 * // { maxFeePerGas: ..., maxPriorityFeePerGas: ... }
 */
async function estimateFeesPerGas(client, args) {
    return internal_estimateFeesPerGas(client, args);
}
async function internal_estimateFeesPerGas(client, args) {
    const { block: block_, chain = client.chain, request, type = 'eip1559', } = args || {};
    const baseFeeMultiplier = await (async () => {
        if (typeof chain?.fees?.baseFeeMultiplier === 'function')
            return chain.fees.baseFeeMultiplier({
                block: block_,
                client,
                request,
            });
        return chain?.fees?.baseFeeMultiplier ?? 1.2;
    })();
    if (baseFeeMultiplier < 1)
        throw new BaseFeeScalarError();
    const decimals = baseFeeMultiplier.toString().split('.')[1]?.length ?? 0;
    const denominator = 10 ** decimals;
    const multiply = (base) => (base * BigInt(Math.ceil(baseFeeMultiplier * denominator))) /
        BigInt(denominator);
    const block = block_
        ? block_
        : await getAction(client, getBlock, 'getBlock')({});
    if (typeof chain?.fees?.estimateFeesPerGas === 'function') {
        const fees = (await chain.fees.estimateFeesPerGas({
            block: block_,
            client,
            multiply,
            request,
            type,
        }));
        if (fees !== null)
            return fees;
    }
    if (type === 'eip1559') {
        if (typeof block.baseFeePerGas !== 'bigint')
            throw new Eip1559FeesNotSupportedError();
        const maxPriorityFeePerGas = typeof request?.maxPriorityFeePerGas === 'bigint'
            ? request.maxPriorityFeePerGas
            : await internal_estimateMaxPriorityFeePerGas(client, {
                block: block,
                chain,
                request,
            });
        const baseFeePerGas = multiply(block.baseFeePerGas);
        const maxFeePerGas = request?.maxFeePerGas ?? baseFeePerGas + maxPriorityFeePerGas;
        return {
            maxFeePerGas,
            maxPriorityFeePerGas,
        };
    }
    const gasPrice = request?.gasPrice ??
        multiply(await getAction(client, getGasPrice, 'getGasPrice')({}));
    return {
        gasPrice,
    };
}

/**
 * Returns the number of [Transactions](https://viem.sh/docs/glossary/terms#transaction) an Account has sent.
 *
 * - Docs: https://viem.sh/docs/actions/public/getTransactionCount
 * - JSON-RPC Methods: [`eth_getTransactionCount`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactioncount)
 *
 * @param client - Client to use
 * @param parameters - {@link GetTransactionCountParameters}
 * @returns The number of transactions an account has sent. {@link GetTransactionCountReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getTransactionCount } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const transactionCount = await getTransactionCount(client, {
 *   address: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 * })
 */
async function getTransactionCount(client, { address, blockTag = 'latest', blockNumber }) {
    const count = await client.request({
        method: 'eth_getTransactionCount',
        params: [
            address,
            typeof blockNumber === 'bigint' ? numberToHex(blockNumber) : blockTag,
        ],
    }, {
        dedupe: Boolean(blockNumber),
    });
    return hexToNumber$1(count);
}

/**
 * Compute commitments from a list of blobs.
 *
 * @example
 * ```ts
 * import { blobsToCommitments, toBlobs } from 'viem'
 * import { kzg } from './kzg'
 *
 * const blobs = toBlobs({ data: '0x1234' })
 * const commitments = blobsToCommitments({ blobs, kzg })
 * ```
 */
function blobsToCommitments(parameters) {
    const { kzg } = parameters;
    const to = parameters.to ?? (typeof parameters.blobs[0] === 'string' ? 'hex' : 'bytes');
    const blobs = (typeof parameters.blobs[0] === 'string'
        ? parameters.blobs.map((x) => hexToBytes$1(x))
        : parameters.blobs);
    const commitments = [];
    for (const blob of blobs)
        commitments.push(Uint8Array.from(kzg.blobToKzgCommitment(blob)));
    return (to === 'bytes'
        ? commitments
        : commitments.map((x) => bytesToHex$1(x)));
}

/**
 * Compute the proofs for a list of blobs and their commitments.
 *
 * @example
 * ```ts
 * import {
 *   blobsToCommitments,
 *   toBlobs
 * } from 'viem'
 * import { kzg } from './kzg'
 *
 * const blobs = toBlobs({ data: '0x1234' })
 * const commitments = blobsToCommitments({ blobs, kzg })
 * const proofs = blobsToProofs({ blobs, commitments, kzg })
 * ```
 */
function blobsToProofs(parameters) {
    const { kzg } = parameters;
    const to = parameters.to ?? (typeof parameters.blobs[0] === 'string' ? 'hex' : 'bytes');
    const blobs = (typeof parameters.blobs[0] === 'string'
        ? parameters.blobs.map((x) => hexToBytes$1(x))
        : parameters.blobs);
    const commitments = (typeof parameters.commitments[0] === 'string'
        ? parameters.commitments.map((x) => hexToBytes$1(x))
        : parameters.commitments);
    const proofs = [];
    for (let i = 0; i < blobs.length; i++) {
        const blob = blobs[i];
        const commitment = commitments[i];
        proofs.push(Uint8Array.from(kzg.computeBlobKzgProof(blob, commitment)));
    }
    return (to === 'bytes'
        ? proofs
        : proofs.map((x) => bytesToHex$1(x)));
}

/**
 * Internal Merkle-Damgard hash utils.
 * @module
 */
/** Polyfill for Safari 14. https://caniuse.com/mdn-javascript_builtins_dataview_setbiguint64 */
function setBigUint64(view, byteOffset, value, isLE) {
    if (typeof view.setBigUint64 === 'function')
        return view.setBigUint64(byteOffset, value, isLE);
    const _32n = BigInt(32);
    const _u32_max = BigInt(0xffffffff);
    const wh = Number((value >> _32n) & _u32_max);
    const wl = Number(value & _u32_max);
    const h = isLE ? 4 : 0;
    const l = isLE ? 0 : 4;
    view.setUint32(byteOffset + h, wh, isLE);
    view.setUint32(byteOffset + l, wl, isLE);
}
/** Choice: a ? b : c */
function Chi(a, b, c) {
    return (a & b) ^ (~a & c);
}
/** Majority function, true if any two inputs is true. */
function Maj(a, b, c) {
    return (a & b) ^ (a & c) ^ (b & c);
}
/**
 * Merkle-Damgard hash construction base class.
 * Could be used to create MD5, RIPEMD, SHA1, SHA2.
 */
class HashMD extends Hash$1 {
    constructor(blockLen, outputLen, padOffset, isLE) {
        super();
        this.finished = false;
        this.length = 0;
        this.pos = 0;
        this.destroyed = false;
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE;
        this.buffer = new Uint8Array(blockLen);
        this.view = createView(this.buffer);
    }
    update(data) {
        aexists$1(this);
        data = toBytes$1(data);
        abytes$2(data);
        const { view, buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len;) {
            const take = Math.min(blockLen - this.pos, len - pos);
            // Fast path: we have at least one block in input, cast it to view and process
            if (take === blockLen) {
                const dataView = createView(data);
                for (; blockLen <= len - pos; pos += blockLen)
                    this.process(dataView, pos);
                continue;
            }
            buffer.set(data.subarray(pos, pos + take), this.pos);
            this.pos += take;
            pos += take;
            if (this.pos === blockLen) {
                this.process(view, 0);
                this.pos = 0;
            }
        }
        this.length += data.length;
        this.roundClean();
        return this;
    }
    digestInto(out) {
        aexists$1(this);
        aoutput$1(out, this);
        this.finished = true;
        // Padding
        // We can avoid allocation of buffer for padding completely if it
        // was previously not allocated here. But it won't change performance.
        const { buffer, view, blockLen, isLE } = this;
        let { pos } = this;
        // append the bit '1' to the message
        buffer[pos++] = 0b10000000;
        clean$1(this.buffer.subarray(pos));
        // we have less than padOffset left in buffer, so we cannot put length in
        // current block, need process it and pad again
        if (this.padOffset > blockLen - pos) {
            this.process(view, 0);
            pos = 0;
        }
        // Pad until full block byte with zeros
        for (let i = pos; i < blockLen; i++)
            buffer[i] = 0;
        // Note: sha512 requires length to be 128bit integer, but length in JS will overflow before that
        // You need to write around 2 exabytes (u64_max / 8 / (1024**6)) for this to happen.
        // So we just write lowest 64 bits of that value.
        setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
        this.process(view, 0);
        const oview = createView(out);
        const len = this.outputLen;
        // NOTE: we do division by 4 later, which should be fused in single op with modulo by JIT
        if (len % 4)
            throw new Error('_sha2: outputLen should be aligned to 32bit');
        const outLen = len / 4;
        const state = this.get();
        if (outLen > state.length)
            throw new Error('_sha2: outputLen bigger than state');
        for (let i = 0; i < outLen; i++)
            oview.setUint32(4 * i, state[i], isLE);
    }
    digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
    }
    _cloneInto(to) {
        to || (to = new this.constructor());
        to.set(...this.get());
        const { blockLen, buffer, length, finished, destroyed, pos } = this;
        to.destroyed = destroyed;
        to.finished = finished;
        to.length = length;
        to.pos = pos;
        if (length % blockLen)
            to.buffer.set(buffer);
        return to;
    }
    clone() {
        return this._cloneInto();
    }
}
/**
 * Initial SHA-2 state: fractional parts of square roots of first 16 primes 2..53.
 * Check out `test/misc/sha2-gen-iv.js` for recomputation guide.
 */
/** Initial SHA256 state. Bits 0..32 of frac part of sqrt of primes 2..19 */
const SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/**
 * SHA2 hash function. A.k.a. sha256, sha384, sha512, sha512_224, sha512_256.
 * SHA256 is the fastest hash implementable in JS, even faster than Blake3.
 * Check out [RFC 4634](https://datatracker.ietf.org/doc/html/rfc4634) and
 * [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf).
 * @module
 */
/**
 * Round constants:
 * First 32 bits of fractional parts of the cube roots of the first 64 primes 2..311)
 */
// prettier-ignore
const SHA256_K = /* @__PURE__ */ Uint32Array.from([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);
/** Reusable temporary buffer. "W" comes straight from spec. */
const SHA256_W = /* @__PURE__ */ new Uint32Array(64);
class SHA256 extends HashMD {
    constructor(outputLen = 32) {
        super(64, outputLen, 8, false);
        // We cannot use array here since array allows indexing by variable
        // which means optimizer/compiler cannot use registers.
        this.A = SHA256_IV[0] | 0;
        this.B = SHA256_IV[1] | 0;
        this.C = SHA256_IV[2] | 0;
        this.D = SHA256_IV[3] | 0;
        this.E = SHA256_IV[4] | 0;
        this.F = SHA256_IV[5] | 0;
        this.G = SHA256_IV[6] | 0;
        this.H = SHA256_IV[7] | 0;
    }
    get() {
        const { A, B, C, D, E, F, G, H } = this;
        return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E | 0;
        this.F = F | 0;
        this.G = G | 0;
        this.H = H | 0;
    }
    process(view, offset) {
        // Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array
        for (let i = 0; i < 16; i++, offset += 4)
            SHA256_W[i] = view.getUint32(offset, false);
        for (let i = 16; i < 64; i++) {
            const W15 = SHA256_W[i - 15];
            const W2 = SHA256_W[i - 2];
            const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ (W15 >>> 3);
            const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ (W2 >>> 10);
            SHA256_W[i] = (s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16]) | 0;
        }
        // Compression function main loop, 64 rounds
        let { A, B, C, D, E, F, G, H } = this;
        for (let i = 0; i < 64; i++) {
            const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
            const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
            const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
            const T2 = (sigma0 + Maj(A, B, C)) | 0;
            H = G;
            G = F;
            F = E;
            E = (D + T1) | 0;
            D = C;
            C = B;
            B = A;
            A = (T1 + T2) | 0;
        }
        // Add the compressed chunk to the current hash value
        A = (A + this.A) | 0;
        B = (B + this.B) | 0;
        C = (C + this.C) | 0;
        D = (D + this.D) | 0;
        E = (E + this.E) | 0;
        F = (F + this.F) | 0;
        G = (G + this.G) | 0;
        H = (H + this.H) | 0;
        this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
        clean$1(SHA256_W);
    }
    destroy() {
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        clean$1(this.buffer);
    }
}
/**
 * SHA2-256 hash function from RFC 4634.
 *
 * It is the fastest JS hash, even faster than Blake3.
 * To break sha256 using birthday attack, attackers need to try 2^128 hashes.
 * BTC network is doing 2^70 hashes/sec (2^95 hashes/year) as per 2025.
 */
const sha256$2 = /* @__PURE__ */ createHasher$1(() => new SHA256());

/**
 * SHA2-256 a.k.a. sha256. In JS, it is the fastest hash, even faster than Blake3.
 *
 * To break sha256 using birthday attack, attackers need to try 2^128 hashes.
 * BTC network is doing 2^70 hashes/sec (2^95 hashes/year) as per 2025.
 *
 * Check out [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf).
 * @module
 * @deprecated
 */
/** @deprecated Use import from `noble/hashes/sha2` module */
const sha256$1 = sha256$2;

function sha256(value, to_) {
    const bytes = sha256$1(isHex(value, { strict: false }) ? toBytes$2(value) : value);
    return bytes;
}

/**
 * Transform a commitment to it's versioned hash.
 *
 * @example
 * ```ts
 * import {
 *   blobsToCommitments,
 *   commitmentToVersionedHash,
 *   toBlobs
 * } from 'viem'
 * import { kzg } from './kzg'
 *
 * const blobs = toBlobs({ data: '0x1234' })
 * const [commitment] = blobsToCommitments({ blobs, kzg })
 * const versionedHash = commitmentToVersionedHash({ commitment })
 * ```
 */
function commitmentToVersionedHash(parameters) {
    const { commitment, version = 1 } = parameters;
    const to = parameters.to ?? (typeof commitment === 'string' ? 'hex' : 'bytes');
    const versionedHash = sha256(commitment);
    versionedHash.set([version], 0);
    return (to === 'bytes' ? versionedHash : bytesToHex$1(versionedHash));
}

/**
 * Transform a list of commitments to their versioned hashes.
 *
 * @example
 * ```ts
 * import {
 *   blobsToCommitments,
 *   commitmentsToVersionedHashes,
 *   toBlobs
 * } from 'viem'
 * import { kzg } from './kzg'
 *
 * const blobs = toBlobs({ data: '0x1234' })
 * const commitments = blobsToCommitments({ blobs, kzg })
 * const versionedHashes = commitmentsToVersionedHashes({ commitments })
 * ```
 */
function commitmentsToVersionedHashes(parameters) {
    const { commitments, version } = parameters;
    const to = parameters.to ?? (typeof commitments[0] === 'string' ? 'hex' : 'bytes');
    const hashes = [];
    for (const commitment of commitments) {
        hashes.push(commitmentToVersionedHash({
            commitment,
            to,
            version,
        }));
    }
    return hashes;
}

// https://github.com/ethereum/EIPs/blob/master/EIPS/eip-4844.md#parameters
/** Blob limit per transaction. */
const blobsPerTransaction = 6;
/** The number of bytes in a BLS scalar field element. */
const bytesPerFieldElement = 32;
/** The number of field elements in a blob. */
const fieldElementsPerBlob = 4096;
/** The number of bytes in a blob. */
const bytesPerBlob = bytesPerFieldElement * fieldElementsPerBlob;
/** Blob bytes limit per transaction. */
const maxBytesPerTransaction = bytesPerBlob * blobsPerTransaction -
    // terminator byte (0x80).
    1 -
    // zero byte (0x00) appended to each field element.
    1 * fieldElementsPerBlob * blobsPerTransaction;

class BlobSizeTooLargeError extends BaseError$1 {
    constructor({ maxSize, size }) {
        super('Blob size is too large.', {
            metaMessages: [`Max: ${maxSize} bytes`, `Given: ${size} bytes`],
            name: 'BlobSizeTooLargeError',
        });
    }
}
class EmptyBlobError extends BaseError$1 {
    constructor() {
        super('Blob data must not be empty.', { name: 'EmptyBlobError' });
    }
}

/**
 * Transforms arbitrary data to blobs.
 *
 * @example
 * ```ts
 * import { toBlobs, stringToHex } from 'viem'
 *
 * const blobs = toBlobs({ data: stringToHex('hello world') })
 * ```
 */
function toBlobs(parameters) {
    const to = parameters.to ?? (typeof parameters.data === 'string' ? 'hex' : 'bytes');
    const data = (typeof parameters.data === 'string'
        ? hexToBytes$1(parameters.data)
        : parameters.data);
    const size_ = size$3(data);
    if (!size_)
        throw new EmptyBlobError();
    if (size_ > maxBytesPerTransaction)
        throw new BlobSizeTooLargeError({
            maxSize: maxBytesPerTransaction,
            size: size_,
        });
    const blobs = [];
    let active = true;
    let position = 0;
    while (active) {
        const blob = createCursor(new Uint8Array(bytesPerBlob));
        let size = 0;
        while (size < fieldElementsPerBlob) {
            const bytes = data.slice(position, position + (bytesPerFieldElement - 1));
            // Push a zero byte so the field element doesn't overflow the BLS modulus.
            blob.pushByte(0x00);
            // Push the current segment of data bytes.
            blob.pushBytes(bytes);
            // If we detect that the current segment of data bytes is less than 31 bytes,
            // we can stop processing and push a terminator byte to indicate the end of the blob.
            if (bytes.length < 31) {
                blob.pushByte(0x80);
                active = false;
                break;
            }
            size++;
            position += 31;
        }
        blobs.push(blob);
    }
    return (to === 'bytes'
        ? blobs.map((x) => x.bytes)
        : blobs.map((x) => bytesToHex$1(x.bytes)));
}

/**
 * Transforms arbitrary data (or blobs, commitments, & proofs) into a sidecar array.
 *
 * @example
 * ```ts
 * import { toBlobSidecars, stringToHex } from 'viem'
 *
 * const sidecars = toBlobSidecars({ data: stringToHex('hello world') })
 * ```
 *
 * @example
 * ```ts
 * import {
 *   blobsToCommitments,
 *   toBlobs,
 *   blobsToProofs,
 *   toBlobSidecars,
 *   stringToHex
 * } from 'viem'
 *
 * const blobs = toBlobs({ data: stringToHex('hello world') })
 * const commitments = blobsToCommitments({ blobs, kzg })
 * const proofs = blobsToProofs({ blobs, commitments, kzg })
 *
 * const sidecars = toBlobSidecars({ blobs, commitments, proofs })
 * ```
 */
function toBlobSidecars(parameters) {
    const { data, kzg, to } = parameters;
    const blobs = parameters.blobs ?? toBlobs({ data: data, to });
    const commitments = parameters.commitments ?? blobsToCommitments({ blobs, kzg: kzg, to });
    const proofs = parameters.proofs ?? blobsToProofs({ blobs, commitments, kzg: kzg, to });
    const sidecars = [];
    for (let i = 0; i < blobs.length; i++)
        sidecars.push({
            blob: blobs[i],
            commitment: commitments[i],
            proof: proofs[i],
        });
    return sidecars;
}

function getTransactionType(transaction) {
    if (transaction.type)
        return transaction.type;
    if (typeof transaction.authorizationList !== 'undefined')
        return 'eip7702';
    if (typeof transaction.blobs !== 'undefined' ||
        typeof transaction.blobVersionedHashes !== 'undefined' ||
        typeof transaction.maxFeePerBlobGas !== 'undefined' ||
        typeof transaction.sidecars !== 'undefined')
        return 'eip4844';
    if (typeof transaction.maxFeePerGas !== 'undefined' ||
        typeof transaction.maxPriorityFeePerGas !== 'undefined') {
        return 'eip1559';
    }
    if (typeof transaction.gasPrice !== 'undefined') {
        if (typeof transaction.accessList !== 'undefined')
            return 'eip2930';
        return 'legacy';
    }
    throw new InvalidSerializableTransactionError({ transaction });
}

function getTransactionError(err, { docsPath, ...args }) {
    const cause = (() => {
        const cause = getNodeError(err, args);
        if (cause instanceof UnknownNodeError)
            return err;
        return cause;
    })();
    return new TransactionExecutionError(cause, {
        docsPath,
        ...args,
    });
}

/**
 * Returns the chain ID associated with the current network.
 *
 * - Docs: https://viem.sh/docs/actions/public/getChainId
 * - JSON-RPC Methods: [`eth_chainId`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_chainid)
 *
 * @param client - Client to use
 * @returns The current chain ID. {@link GetChainIdReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getChainId } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const chainId = await getChainId(client)
 * // 1
 */
async function getChainId(client) {
    const chainIdHex = await client.request({
        method: 'eth_chainId',
    }, { dedupe: true });
    return hexToNumber$1(chainIdHex);
}

/**
 * Fills a transaction request with the necessary fields to be signed over.
 *
 * - Docs: https://viem.sh/docs/actions/public/fillTransaction
 *
 * @param client - Client to use
 * @param parameters - {@link FillTransactionParameters}
 * @returns The filled transaction. {@link FillTransactionReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { fillTransaction } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const result = await fillTransaction(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *   value: parseEther('1'),
 * })
 */
async function fillTransaction(client, parameters) {
    const { account = client.account, accessList, authorizationList, chain = client.chain, blobVersionedHashes, blobs, data, gas, gasPrice, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, nonce: nonce_, nonceManager, to, type, value, ...rest } = parameters;
    const nonce = await (async () => {
        if (!account)
            return nonce_;
        if (!nonceManager)
            return nonce_;
        if (typeof nonce_ !== 'undefined')
            return nonce_;
        const account_ = parseAccount(account);
        const chainId = chain
            ? chain.id
            : await getAction(client, getChainId, 'getChainId')({});
        return await nonceManager.consume({
            address: account_.address,
            chainId,
            client,
        });
    })();
    assertRequest(parameters);
    const chainFormat = chain?.formatters?.transactionRequest?.format;
    const format = chainFormat || formatTransactionRequest;
    const request = format({
        // Pick out extra data that might exist on the chain's transaction request type.
        ...extract$1(rest, { format: chainFormat }),
        account: account ? parseAccount(account) : undefined,
        accessList,
        authorizationList,
        blobs,
        blobVersionedHashes,
        data,
        gas,
        gasPrice,
        maxFeePerBlobGas,
        maxFeePerGas,
        maxPriorityFeePerGas,
        nonce,
        to,
        type,
        value,
    }, 'fillTransaction');
    try {
        const response = await client.request({
            method: 'eth_fillTransaction',
            params: [request],
        });
        const format = chain?.formatters?.transaction?.format || formatTransaction;
        const transaction = format(response.tx);
        // Remove unnecessary fields.
        delete transaction.blockHash;
        delete transaction.blockNumber;
        delete transaction.r;
        delete transaction.s;
        delete transaction.transactionIndex;
        delete transaction.v;
        delete transaction.yParity;
        // Rewrite fields.
        transaction.data = transaction.input;
        // Preference supplied fees (some nodes do not take these preferences).
        if (transaction.gas)
            transaction.gas = parameters.gas ?? transaction.gas;
        if (transaction.gasPrice)
            transaction.gasPrice = parameters.gasPrice ?? transaction.gasPrice;
        if (transaction.maxFeePerBlobGas)
            transaction.maxFeePerBlobGas =
                parameters.maxFeePerBlobGas ?? transaction.maxFeePerBlobGas;
        if (transaction.maxFeePerGas)
            transaction.maxFeePerGas =
                parameters.maxFeePerGas ?? transaction.maxFeePerGas;
        if (transaction.maxPriorityFeePerGas)
            transaction.maxPriorityFeePerGas =
                parameters.maxPriorityFeePerGas ?? transaction.maxPriorityFeePerGas;
        if (transaction.nonce)
            transaction.nonce = parameters.nonce ?? transaction.nonce;
        // Build fee multiplier function.
        const feeMultiplier = await (async () => {
            if (typeof chain?.fees?.baseFeeMultiplier === 'function') {
                const block = await getAction(client, getBlock, 'getBlock')({});
                return chain.fees.baseFeeMultiplier({
                    block,
                    client,
                    request: parameters,
                });
            }
            return chain?.fees?.baseFeeMultiplier ?? 1.2;
        })();
        if (feeMultiplier < 1)
            throw new BaseFeeScalarError();
        const decimals = feeMultiplier.toString().split('.')[1]?.length ?? 0;
        const denominator = 10 ** decimals;
        const multiplyFee = (base) => (base * BigInt(Math.ceil(feeMultiplier * denominator))) /
            BigInt(denominator);
        // Apply fee multiplier.
        if (transaction.maxFeePerGas && !parameters.maxFeePerGas)
            transaction.maxFeePerGas = multiplyFee(transaction.maxFeePerGas);
        if (transaction.gasPrice && !parameters.gasPrice)
            transaction.gasPrice = multiplyFee(transaction.gasPrice);
        return {
            raw: response.raw,
            transaction: {
                from: request.from,
                ...transaction,
            },
        };
    }
    catch (err) {
        throw getTransactionError(err, {
            ...parameters,
            chain: client.chain,
        });
    }
}

const defaultParameters = [
    'blobVersionedHashes',
    'chainId',
    'fees',
    'gas',
    'nonce',
    'type',
];
/** @internal */
const eip1559NetworkCache = /*#__PURE__*/ new Map();
/** @internal */
const supportsFillTransaction = /*#__PURE__*/ new LruMap$1(128);
/**
 * Prepares a transaction request for signing.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/prepareTransactionRequest
 *
 * @param args - {@link PrepareTransactionRequestParameters}
 * @returns The transaction request. {@link PrepareTransactionRequestReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { prepareTransactionRequest } from 'viem/actions'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const request = await prepareTransactionRequest(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   to: '0x0000000000000000000000000000000000000000',
 *   value: 1n,
 * })
 *
 * @example
 * // Account Hoisting
 * import { createWalletClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet } from 'viem/chains'
 * import { prepareTransactionRequest } from 'viem/actions'
 *
 * const client = createWalletClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const request = await prepareTransactionRequest(client, {
 *   to: '0x0000000000000000000000000000000000000000',
 *   value: 1n,
 * })
 */
async function prepareTransactionRequest(client, args) {
    let request = args;
    request.account ??= client.account;
    request.parameters ??= defaultParameters;
    const { account: account_, chain = client.chain, nonceManager, parameters, } = request;
    const prepareTransactionRequest = (() => {
        if (typeof chain?.prepareTransactionRequest === 'function')
            return {
                fn: chain.prepareTransactionRequest,
                runAt: ['beforeFillTransaction'],
            };
        if (Array.isArray(chain?.prepareTransactionRequest))
            return {
                fn: chain.prepareTransactionRequest[0],
                runAt: chain.prepareTransactionRequest[1].runAt,
            };
        return undefined;
    })();
    let chainId;
    async function getChainId$1() {
        if (chainId)
            return chainId;
        if (typeof request.chainId !== 'undefined')
            return request.chainId;
        if (chain)
            return chain.id;
        const chainId_ = await getAction(client, getChainId, 'getChainId')({});
        chainId = chainId_;
        return chainId;
    }
    const account = account_ ? parseAccount(account_) : account_;
    let nonce = request.nonce;
    if (parameters.includes('nonce') &&
        typeof nonce === 'undefined' &&
        account &&
        nonceManager) {
        const chainId = await getChainId$1();
        nonce = await nonceManager.consume({
            address: account.address,
            chainId,
            client,
        });
    }
    if (prepareTransactionRequest?.fn &&
        prepareTransactionRequest.runAt?.includes('beforeFillTransaction')) {
        request = await prepareTransactionRequest.fn({ ...request, chain }, {
            phase: 'beforeFillTransaction',
        });
        nonce ??= request.nonce;
    }
    const attemptFill = (() => {
        // Do not attempt if blobs are provided.
        if ((parameters.includes('blobVersionedHashes') ||
            parameters.includes('sidecars')) &&
            request.kzg &&
            request.blobs)
            return false;
        // Do not attempt if `eth_fillTransaction` is not supported.
        if (supportsFillTransaction.get(client.uid) === false)
            return false;
        // Should attempt `eth_fillTransaction` if "fees" or "gas" are required to be populated,
        // otherwise, can just use the other individual calls.
        const shouldAttempt = ['fees', 'gas'].some((parameter) => parameters.includes(parameter));
        if (!shouldAttempt)
            return false;
        // Check if `eth_fillTransaction` needs to be called.
        if (parameters.includes('chainId') && typeof request.chainId !== 'number')
            return true;
        if (parameters.includes('nonce') && typeof nonce !== 'number')
            return true;
        if (parameters.includes('fees') &&
            typeof request.gasPrice !== 'bigint' &&
            (typeof request.maxFeePerGas !== 'bigint' ||
                typeof request.maxPriorityFeePerGas !== 'bigint'))
            return true;
        if (parameters.includes('gas') && typeof request.gas !== 'bigint')
            return true;
        return false;
    })();
    const fillResult = attemptFill
        ? await getAction(client, fillTransaction, 'fillTransaction')({ ...request, nonce })
            .then((result) => {
            const { chainId, from, gas, gasPrice, nonce, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, type, ...rest } = result.transaction;
            supportsFillTransaction.set(client.uid, true);
            return {
                ...request,
                ...(from ? { from } : {}),
                ...(type ? { type } : {}),
                ...(typeof chainId !== 'undefined' ? { chainId } : {}),
                ...(typeof gas !== 'undefined' ? { gas } : {}),
                ...(typeof gasPrice !== 'undefined' ? { gasPrice } : {}),
                ...(typeof nonce !== 'undefined' ? { nonce } : {}),
                ...(typeof maxFeePerBlobGas !== 'undefined'
                    ? { maxFeePerBlobGas }
                    : {}),
                ...(typeof maxFeePerGas !== 'undefined' ? { maxFeePerGas } : {}),
                ...(typeof maxPriorityFeePerGas !== 'undefined'
                    ? { maxPriorityFeePerGas }
                    : {}),
                ...('nonceKey' in rest && typeof rest.nonceKey !== 'undefined'
                    ? { nonceKey: rest.nonceKey }
                    : {}),
            };
        })
            .catch((e) => {
            const error = e;
            if (error.name !== 'TransactionExecutionError')
                return request;
            const unsupported = error.walk?.((e) => {
                const error = e;
                return (error.name === 'MethodNotFoundRpcError' ||
                    error.name === 'MethodNotSupportedRpcError');
            });
            if (unsupported)
                supportsFillTransaction.set(client.uid, false);
            return request;
        })
        : request;
    nonce ??= fillResult.nonce;
    request = {
        ...fillResult,
        ...(account ? { from: account?.address } : {}),
        ...(nonce ? { nonce } : {}),
    };
    const { blobs, gas, kzg, type } = request;
    if (prepareTransactionRequest?.fn &&
        prepareTransactionRequest.runAt?.includes('beforeFillParameters')) {
        request = await prepareTransactionRequest.fn({ ...request, chain }, {
            phase: 'beforeFillParameters',
        });
    }
    let block;
    async function getBlock$1() {
        if (block)
            return block;
        block = await getAction(client, getBlock, 'getBlock')({ blockTag: 'latest' });
        return block;
    }
    if (parameters.includes('nonce') &&
        typeof nonce === 'undefined' &&
        account &&
        !nonceManager)
        request.nonce = await getAction(client, getTransactionCount, 'getTransactionCount')({
            address: account.address,
            blockTag: 'pending',
        });
    if ((parameters.includes('blobVersionedHashes') ||
        parameters.includes('sidecars')) &&
        blobs &&
        kzg) {
        const commitments = blobsToCommitments({ blobs, kzg });
        if (parameters.includes('blobVersionedHashes')) {
            const versionedHashes = commitmentsToVersionedHashes({
                commitments,
                to: 'hex',
            });
            request.blobVersionedHashes = versionedHashes;
        }
        if (parameters.includes('sidecars')) {
            const proofs = blobsToProofs({ blobs, commitments, kzg });
            const sidecars = toBlobSidecars({
                blobs,
                commitments,
                proofs,
                to: 'hex',
            });
            request.sidecars = sidecars;
        }
    }
    if (parameters.includes('chainId'))
        request.chainId = await getChainId$1();
    if ((parameters.includes('fees') || parameters.includes('type')) &&
        typeof type === 'undefined') {
        try {
            request.type = getTransactionType(request);
        }
        catch {
            let isEip1559Network = eip1559NetworkCache.get(client.uid);
            if (typeof isEip1559Network === 'undefined') {
                const block = await getBlock$1();
                isEip1559Network = typeof block?.baseFeePerGas === 'bigint';
                eip1559NetworkCache.set(client.uid, isEip1559Network);
            }
            request.type = isEip1559Network ? 'eip1559' : 'legacy';
        }
    }
    if (parameters.includes('fees')) {
        // TODO(4844): derive blob base fees once https://github.com/ethereum/execution-apis/pull/486 is merged.
        if (request.type !== 'legacy' && request.type !== 'eip2930') {
            // EIP-1559 fees
            if (typeof request.maxFeePerGas === 'undefined' ||
                typeof request.maxPriorityFeePerGas === 'undefined') {
                const block = await getBlock$1();
                const { maxFeePerGas, maxPriorityFeePerGas } = await internal_estimateFeesPerGas(client, {
                    block: block,
                    chain,
                    request: request,
                });
                if (typeof request.maxPriorityFeePerGas === 'undefined' &&
                    request.maxFeePerGas &&
                    request.maxFeePerGas < maxPriorityFeePerGas)
                    throw new MaxFeePerGasTooLowError({
                        maxPriorityFeePerGas,
                    });
                request.maxPriorityFeePerGas = maxPriorityFeePerGas;
                request.maxFeePerGas = maxFeePerGas;
            }
        }
        else {
            // Legacy fees
            if (typeof request.maxFeePerGas !== 'undefined' ||
                typeof request.maxPriorityFeePerGas !== 'undefined')
                throw new Eip1559FeesNotSupportedError();
            if (typeof request.gasPrice === 'undefined') {
                const block = await getBlock$1();
                const { gasPrice: gasPrice_ } = await internal_estimateFeesPerGas(client, {
                    block: block,
                    chain,
                    request: request,
                    type: 'legacy',
                });
                request.gasPrice = gasPrice_;
            }
        }
    }
    if (parameters.includes('gas') && typeof gas === 'undefined')
        request.gas = await getAction(client, estimateGas, 'estimateGas')({
            ...request,
            account,
            prepare: account?.type === 'local' ? [] : ['blobVersionedHashes'],
        });
    if (prepareTransactionRequest?.fn &&
        prepareTransactionRequest.runAt?.includes('afterFillParameters'))
        request = await prepareTransactionRequest.fn({ ...request, chain }, {
            phase: 'afterFillParameters',
        });
    assertRequest(request);
    delete request.parameters;
    return request;
}

/**
 * Estimates the gas necessary to complete a transaction without submitting it to the network.
 *
 * - Docs: https://viem.sh/docs/actions/public/estimateGas
 * - JSON-RPC Methods: [`eth_estimateGas`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_estimategas)
 *
 * @param client - Client to use
 * @param parameters - {@link EstimateGasParameters}
 * @returns The gas estimate (in gas units). {@link EstimateGasReturnType}
 *
 * @example
 * import { createPublicClient, http, parseEther } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { estimateGas } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const gasEstimate = await estimateGas(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *   value: parseEther('1'),
 * })
 */
async function estimateGas(client, args) {
    const { account: account_ = client.account, prepare = true } = args;
    const account = account_ ? parseAccount(account_) : undefined;
    const parameters = (() => {
        if (Array.isArray(prepare))
            return prepare;
        // Some RPC Providers do not compute versioned hashes from blobs. We will need
        // to compute them.
        if (account?.type !== 'local')
            return ['blobVersionedHashes'];
        return undefined;
    })();
    try {
        const to = await (async () => {
            // If `to` exists on the parameters, use that.
            if (args.to)
                return args.to;
            // If no `to` exists, and we are sending a EIP-7702 transaction, use the
            // address of the first authorization in the list.
            if (args.authorizationList && args.authorizationList.length > 0)
                return await recoverAuthorizationAddress({
                    authorization: args.authorizationList[0],
                }).catch(() => {
                    throw new BaseError$1('`to` is required. Could not infer from `authorizationList`');
                });
            // Otherwise, we are sending a deployment transaction.
            return undefined;
        })();
        const { accessList, authorizationList, blobs, blobVersionedHashes, blockNumber, blockTag, data, gas, gasPrice, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, nonce, value, stateOverride, ...rest } = prepare
            ? (await prepareTransactionRequest(client, {
                ...args,
                parameters,
                to,
            }))
            : args;
        // If we get `gas` back from the prepared transaction request, which is
        // different from the `gas` we provided, it was likely filled by other means
        // during request preparation (e.g. `eth_fillTransaction` or `chain.transactionRequest.prepare`).
        // (e.g. `eth_fillTransaction` or `chain.transactionRequest.prepare`).
        if (gas && args.gas !== gas)
            return gas;
        const blockNumberHex = typeof blockNumber === 'bigint' ? numberToHex(blockNumber) : undefined;
        const block = blockNumberHex || blockTag;
        const rpcStateOverride = serializeStateOverride(stateOverride);
        assertRequest(args);
        const chainFormat = client.chain?.formatters?.transactionRequest?.format;
        const format = chainFormat || formatTransactionRequest;
        const request = format({
            // Pick out extra data that might exist on the chain's transaction request type.
            ...extract$1(rest, { format: chainFormat }),
            account,
            accessList,
            authorizationList,
            blobs,
            blobVersionedHashes,
            data,
            gasPrice,
            maxFeePerBlobGas,
            maxFeePerGas,
            maxPriorityFeePerGas,
            nonce,
            to,
            value,
        }, 'estimateGas');
        return BigInt(await client.request({
            method: 'eth_estimateGas',
            params: rpcStateOverride
                ? [
                    request,
                    block ?? client.experimental_blockTag ?? 'latest',
                    rpcStateOverride,
                ]
                : block
                    ? [request, block]
                    : [request],
        }));
    }
    catch (err) {
        throw getEstimateGasError(err, {
            ...args,
            account,
            chain: client.chain,
        });
    }
}

/**
 * Estimates the gas required to successfully execute a contract write function call.
 *
 * - Docs: https://viem.sh/docs/contract/estimateContractGas
 *
 * Internally, uses a [Public Client](https://viem.sh/docs/clients/public) to call the [`estimateGas` action](https://viem.sh/docs/actions/public/estimateGas) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).
 *
 * @param client - Client to use
 * @param parameters - {@link EstimateContractGasParameters}
 * @returns The gas estimate (in wei). {@link EstimateContractGasReturnType}
 *
 * @example
 * import { createPublicClient, http, parseAbi } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { estimateContractGas } from 'viem/contract'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const gas = await estimateContractGas(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *   abi: parseAbi(['function mint() public']),
 *   functionName: 'mint',
 *   account: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
 * })
 */
async function estimateContractGas(client, parameters) {
    const { abi, address, args, functionName, dataSuffix = typeof client.dataSuffix === 'string'
        ? client.dataSuffix
        : client.dataSuffix?.value, ...request } = parameters;
    const data = encodeFunctionData({
        abi,
        args,
        functionName,
    });
    try {
        const gas = await getAction(client, estimateGas, 'estimateGas')({
            data: `${data}${dataSuffix ? dataSuffix.replace('0x', '') : ''}`,
            to: address,
            ...request,
        });
        return gas;
    }
    catch (error) {
        const account = request.account ? parseAccount(request.account) : undefined;
        throw getContractError(error, {
            abi,
            address,
            args,
            docsPath: '/docs/contract/estimateContractGas',
            functionName,
            sender: account?.address,
        });
    }
}

function isAddressEqual(a, b) {
    if (!isAddress(a, { strict: false }))
        throw new InvalidAddressError$1({ address: a });
    if (!isAddress(b, { strict: false }))
        throw new InvalidAddressError$1({ address: b });
    return a.toLowerCase() === b.toLowerCase();
}

function formatLog(log, { args, eventName, } = {}) {
    return {
        ...log,
        blockHash: log.blockHash ? log.blockHash : null,
        blockNumber: log.blockNumber ? BigInt(log.blockNumber) : null,
        blockTimestamp: log.blockTimestamp
            ? BigInt(log.blockTimestamp)
            : log.blockTimestamp === null
                ? null
                : undefined,
        logIndex: log.logIndex ? Number(log.logIndex) : null,
        transactionHash: log.transactionHash ? log.transactionHash : null,
        transactionIndex: log.transactionIndex
            ? Number(log.transactionIndex)
            : null,
        ...(eventName ? { args, eventName } : {}),
    };
}

const docsPath$4 = '/docs/contract/decodeEventLog';
function decodeEventLog(parameters) {
    const { abi, data, strict: strict_, topics, } = parameters;
    const strict = strict_ ?? true;
    const [signature, ...argTopics] = topics;
    if (!signature)
        throw new AbiEventSignatureEmptyTopicsError({ docsPath: docsPath$4 });
    const abiItem = abi.find((x) => x.type === 'event' &&
        signature === toEventSelector(formatAbiItem(x)));
    if (!(abiItem && 'name' in abiItem) || abiItem.type !== 'event')
        throw new AbiEventSignatureNotFoundError(signature, { docsPath: docsPath$4 });
    const { name, inputs } = abiItem;
    const isUnnamed = inputs?.some((x) => !('name' in x && x.name));
    const args = isUnnamed ? [] : {};
    // Decode topics (indexed args).
    const indexedInputs = inputs
        .map((x, i) => [x, i])
        .filter(([x]) => 'indexed' in x && x.indexed);
    const missingIndexedInputs = [];
    for (let i = 0; i < indexedInputs.length; i++) {
        const [param, argIndex] = indexedInputs[i];
        const topic = argTopics[i];
        if (!topic) {
            if (strict)
                throw new DecodeLogTopicsMismatch({
                    abiItem,
                    param: param,
                });
            // Track missing indexed inputs to decode from data when strict is false
            missingIndexedInputs.push([param, argIndex]);
            continue;
        }
        args[isUnnamed ? argIndex : param.name || argIndex] = decodeTopic({
            param,
            value: topic,
        });
    }
    // Decode data (non-indexed args + missing indexed args when strict is false).
    const nonIndexedInputs = inputs.filter((x) => !('indexed' in x && x.indexed));
    // When strict is false, missing indexed inputs should be decoded from data
    const inputsToDecode = strict
        ? nonIndexedInputs
        : [...missingIndexedInputs.map(([param]) => param), ...nonIndexedInputs];
    if (inputsToDecode.length > 0) {
        if (data && data !== '0x') {
            try {
                const decodedData = decodeAbiParameters(inputsToDecode, data);
                if (decodedData) {
                    let dataIndex = 0;
                    // First, assign missing indexed parameters (when strict is false)
                    if (!strict) {
                        for (const [param, argIndex] of missingIndexedInputs) {
                            args[isUnnamed ? argIndex : param.name || argIndex] =
                                decodedData[dataIndex++];
                        }
                    }
                    // Then, assign non-indexed parameters
                    if (isUnnamed) {
                        for (let i = 0; i < inputs.length; i++)
                            if (args[i] === undefined && dataIndex < decodedData.length)
                                args[i] = decodedData[dataIndex++];
                    }
                    else
                        for (let i = 0; i < nonIndexedInputs.length; i++)
                            args[nonIndexedInputs[i].name] = decodedData[dataIndex++];
                }
            }
            catch (err) {
                if (strict) {
                    if (err instanceof AbiDecodingDataSizeTooSmallError ||
                        err instanceof PositionOutOfBoundsError$1)
                        throw new DecodeLogDataMismatch({
                            abiItem,
                            data: data,
                            params: inputsToDecode,
                            size: size$3(data),
                        });
                    throw err;
                }
            }
        }
        else if (strict) {
            throw new DecodeLogDataMismatch({
                abiItem,
                data: '0x',
                params: inputsToDecode,
                size: 0,
            });
        }
    }
    return {
        eventName: name,
        args: Object.values(args).length > 0 ? args : undefined,
    };
}
function decodeTopic({ param, value }) {
    if (param.type === 'string' ||
        param.type === 'bytes' ||
        param.type === 'tuple' ||
        param.type.match(/^(.*)\[(\d+)?\]$/))
        return value;
    const decodedArg = decodeAbiParameters([param], value) || [];
    return decodedArg[0];
}

// TODO(v3): checksum address.
/**
 * Extracts & decodes logs matching the provided signature(s) (`abi` + optional `eventName`)
 * from a set of opaque logs.
 *
 * @param parameters - {@link ParseEventLogsParameters}
 * @returns The logs. {@link ParseEventLogsReturnType}
 *
 * @example
 * import { createClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { parseEventLogs } from 'viem/op-stack'
 *
 * const client = createClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 *
 * const receipt = await getTransactionReceipt(client, {
 *   hash: '0xec23b2ba4bc59ba61554507c1b1bc91649e6586eb2dd00c728e8ed0db8bb37ea',
 * })
 *
 * const logs = parseEventLogs({ logs: receipt.logs })
 * // [{ args: { ... }, eventName: 'TransactionDeposited', ... }, ...]
 */
function parseEventLogs(parameters) {
    const { abi, args, logs, strict = true } = parameters;
    const eventName = (() => {
        if (!parameters.eventName)
            return undefined;
        if (Array.isArray(parameters.eventName))
            return parameters.eventName;
        return [parameters.eventName];
    })();
    const abiTopics = abi
        .filter((abiItem) => abiItem.type === 'event')
        .map((abiItem) => ({
        abi: abiItem,
        selector: toEventSelector(abiItem),
    }));
    return logs
        .map((log) => {
        // Normalize RpcLog (hex-encoded quantities) to Log (bigint/number).
        // When logs come directly from an RPC response (e.g. eth_getLogs),
        // fields like blockNumber are hex strings instead of bigints.
        const formattedLog = typeof log.blockNumber === 'string' ? formatLog(log) : log;
        // Find all matching ABI items with the same selector.
        // Multiple events can share the same selector but differ in indexed parameters
        // (e.g., ERC20 vs ERC721 Transfer events).
        const abiItems = abiTopics.filter((abiTopic) => formattedLog.topics[0] === abiTopic.selector);
        if (abiItems.length === 0)
            return null;
        // Try each matching ABI item until one successfully decodes.
        let event;
        let abiItem;
        for (const item of abiItems) {
            try {
                event = decodeEventLog({
                    ...formattedLog,
                    abi: [item.abi],
                    strict: true,
                });
                abiItem = item;
                break;
            }
            catch {
                // Try next ABI item
            }
        }
        // If strict decoding failed for all, and we're in non-strict mode,
        // fall back to the first matching ABI item.
        if (!event && !strict) {
            abiItem = abiItems[0];
            try {
                event = decodeEventLog({
                    data: formattedLog.data,
                    topics: formattedLog.topics,
                    abi: [abiItem.abi],
                    strict: false,
                });
            }
            catch {
                // If decoding still fails, return partial log in non-strict mode.
                const isUnnamed = abiItem.abi.inputs?.some((x) => !('name' in x && x.name));
                return {
                    ...formattedLog,
                    args: isUnnamed ? [] : {},
                    eventName: abiItem.abi.name,
                };
            }
        }
        // If no event was found, return null.
        if (!event || !abiItem)
            return null;
        // Check that the decoded event name matches the provided event name.
        if (eventName && !eventName.includes(event.eventName))
            return null;
        // Check that the decoded event args match the provided args.
        if (!includesArgs({
            args: event.args,
            inputs: abiItem.abi.inputs,
            matchArgs: args,
        }))
            return null;
        return { ...event, ...formattedLog };
    })
        .filter(Boolean);
}
function includesArgs(parameters) {
    const { args, inputs, matchArgs } = parameters;
    if (!matchArgs)
        return true;
    if (!args)
        return false;
    function isEqual(input, value, arg) {
        try {
            if (input.type === 'address')
                return isAddressEqual(value, arg);
            if (input.type === 'string' || input.type === 'bytes')
                return keccak256$1(toBytes$2(value)) === arg;
            return value === arg;
        }
        catch {
            return false;
        }
    }
    if (Array.isArray(args) && Array.isArray(matchArgs)) {
        return matchArgs.every((value, index) => {
            if (value === null || value === undefined)
                return true;
            const input = inputs[index];
            if (!input)
                return false;
            const value_ = Array.isArray(value) ? value : [value];
            return value_.some((value) => isEqual(input, value, args[index]));
        });
    }
    if (typeof args === 'object' &&
        !Array.isArray(args) &&
        typeof matchArgs === 'object' &&
        !Array.isArray(matchArgs))
        return Object.entries(matchArgs).every(([key, value]) => {
            if (value === null || value === undefined)
                return true;
            const input = inputs.find((input) => input.name === key);
            if (!input)
                return false;
            const value_ = Array.isArray(value) ? value : [value];
            return value_.some((value) => isEqual(input, value, args[key]));
        });
    return false;
}

/**
 * Returns a list of event logs matching the provided parameters.
 *
 * - Docs: https://viem.sh/docs/actions/public/getLogs
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/logs_event-logs
 * - JSON-RPC Methods: [`eth_getLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs)
 *
 * @param client - Client to use
 * @param parameters - {@link GetLogsParameters}
 * @returns A list of event logs. {@link GetLogsReturnType}
 *
 * @example
 * import { createPublicClient, http, parseAbiItem } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getLogs } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const logs = await getLogs(client)
 */
async function getLogs(client, { address, blockHash, fromBlock, toBlock, event, events: events_, args, strict: strict_, } = {}) {
    const strict = strict_ ?? false;
    const events = events_ ?? (event ? [event] : undefined);
    let topics = [];
    if (events) {
        const encoded = events.flatMap((event) => encodeEventTopics({
            abi: [event],
            eventName: event.name,
            args: events_ ? undefined : args,
        }));
        // TODO: Clean up type casting
        topics = [encoded];
        if (event)
            topics = topics[0];
    }
    let logs;
    if (blockHash) {
        logs = await client.request({
            method: 'eth_getLogs',
            params: [{ address, topics, blockHash }],
        });
    }
    else {
        logs = await client.request({
            method: 'eth_getLogs',
            params: [
                {
                    address,
                    topics,
                    fromBlock: typeof fromBlock === 'bigint' ? numberToHex(fromBlock) : fromBlock,
                    toBlock: typeof toBlock === 'bigint' ? numberToHex(toBlock) : toBlock,
                },
            ],
        });
    }
    const formattedLogs = logs.map((log) => formatLog(log));
    if (!events)
        return formattedLogs;
    return parseEventLogs({
        abi: events,
        args: args,
        logs: formattedLogs,
        strict,
    });
}

/**
 * Returns a list of event logs emitted by a contract.
 *
 * - Docs: https://viem.sh/docs/contract/getContractEvents#getcontractevents
 * - JSON-RPC Methods: [`eth_getLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs)
 *
 * @param client - Client to use
 * @param parameters - {@link GetContractEventsParameters}
 * @returns A list of event logs. {@link GetContractEventsReturnType}
 *
 * @example
 * import { createClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getContractEvents } from 'viem/public'
 * import { wagmiAbi } from './abi'
 *
 * const client = createClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const logs = await getContractEvents(client, {
 *  address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *  abi: wagmiAbi,
 *  eventName: 'Transfer'
 * })
 */
async function getContractEvents(client, parameters) {
    const { abi, address, args, blockHash, eventName, fromBlock, toBlock, strict, } = parameters;
    const event = eventName
        ? getAbiItem({ abi, name: eventName })
        : undefined;
    const events = !event
        ? abi.filter((x) => x.type === 'event')
        : undefined;
    return getAction(client, getLogs, 'getLogs')({
        address,
        args,
        blockHash,
        event,
        events,
        fromBlock,
        toBlock,
        strict,
    });
}

const docsPath$3 = '/docs/contract/decodeFunctionResult';
function decodeFunctionResult(parameters) {
    const { abi, args, functionName, data } = parameters;
    let abiItem = abi[0];
    if (functionName) {
        const item = getAbiItem({ abi, args, name: functionName });
        if (!item)
            throw new AbiFunctionNotFoundError(functionName, { docsPath: docsPath$3 });
        abiItem = item;
    }
    if (abiItem.type !== 'function')
        throw new AbiFunctionNotFoundError(undefined, { docsPath: docsPath$3 });
    if (!abiItem.outputs)
        throw new AbiFunctionOutputsNotFoundError(abiItem.name, { docsPath: docsPath$3 });
    const values = decodeAbiParameters(abiItem.outputs, data);
    if (values && values.length > 1)
        return values;
    if (values && values.length === 1)
        return values[0];
    return undefined;
}

/** @internal */
const version = '0.1.1';

/** @internal */
function getVersion() {
    return version;
}

/**
 * Base error class inherited by all errors thrown by ox.
 *
 * @example
 * ```ts
 * import { Errors } from 'ox'
 * throw new Errors.BaseError('An error occurred')
 * ```
 */
class BaseError extends Error {
    static setStaticOptions(options) {
        BaseError.prototype.docsOrigin = options.docsOrigin;
        BaseError.prototype.showVersion = options.showVersion;
        BaseError.prototype.version = options.version;
    }
    constructor(shortMessage, options = {}) {
        const details = (() => {
            if (options.cause instanceof BaseError) {
                if (options.cause.details)
                    return options.cause.details;
                if (options.cause.shortMessage)
                    return options.cause.shortMessage;
            }
            if (options.cause &&
                'details' in options.cause &&
                typeof options.cause.details === 'string')
                return options.cause.details;
            if (options.cause?.message)
                return options.cause.message;
            return options.details;
        })();
        const docsPath = (() => {
            if (options.cause instanceof BaseError)
                return options.cause.docsPath || options.docsPath;
            return options.docsPath;
        })();
        const docsBaseUrl = options.docsOrigin ?? BaseError.prototype.docsOrigin;
        const docs = `${docsBaseUrl}${docsPath ?? ''}`;
        const showVersion = Boolean(options.version ?? BaseError.prototype.showVersion);
        const version = options.version ?? BaseError.prototype.version;
        const message = [
            shortMessage || 'An error occurred.',
            ...(options.metaMessages ? ['', ...options.metaMessages] : []),
            ...(details || docsPath || showVersion
                ? [
                    '',
                    details ? `Details: ${details}` : undefined,
                    docsPath ? `See: ${docs}` : undefined,
                    showVersion ? `Version: ${version}` : undefined,
                ]
                : []),
        ]
            .filter((x) => typeof x === 'string')
            .join('\n');
        super(message, options.cause ? { cause: options.cause } : undefined);
        Object.defineProperty(this, "details", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "docs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "docsOrigin", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "docsPath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "shortMessage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "showVersion", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "version", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cause", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'BaseError'
        });
        this.cause = options.cause;
        this.details = details;
        this.docs = docs;
        this.docsOrigin = docsBaseUrl;
        this.docsPath = docsPath;
        this.shortMessage = shortMessage;
        this.showVersion = showVersion;
        this.version = version;
    }
    walk(fn) {
        return walk(this, fn);
    }
}
Object.defineProperty(BaseError, "defaultStaticOptions", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: {
        docsOrigin: 'https://oxlib.sh',
        showVersion: false,
        version: `ox@${getVersion()}`,
    }
});
(() => {
    BaseError.setStaticOptions(BaseError.defaultStaticOptions);
})();
/** @internal */
function walk(err, fn) {
    if (fn?.(err))
        return err;
    if (err && typeof err === 'object' && 'cause' in err && err.cause)
        return walk(err.cause, fn);
    return fn ? null : err;
}

/** @internal */
function assertSize$1(bytes, size_) {
    if (size$2(bytes) > size_)
        throw new SizeOverflowError$1({
            givenSize: size$2(bytes),
            maxSize: size_,
        });
}
/** @internal */
const charCodeMap = {
    zero: 48,
    nine: 57,
    A: 65,
    F: 70,
    a: 97,
    f: 102,
};
/** @internal */
function charCodeToBase16(char) {
    if (char >= charCodeMap.zero && char <= charCodeMap.nine)
        return char - charCodeMap.zero;
    if (char >= charCodeMap.A && char <= charCodeMap.F)
        return char - (charCodeMap.A - 10);
    if (char >= charCodeMap.a && char <= charCodeMap.f)
        return char - (charCodeMap.a - 10);
    return undefined;
}
/** @internal */
function pad$1(bytes, options = {}) {
    const { dir, size = 32 } = options;
    if (size === 0)
        return bytes;
    if (bytes.length > size)
        throw new SizeExceedsPaddingSizeError$1({
            size: bytes.length,
            targetSize: size,
            type: 'Bytes',
        });
    const paddedBytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
        const padEnd = dir === 'right';
        paddedBytes[padEnd ? i : size - i - 1] =
            bytes[padEnd ? i : bytes.length - i - 1];
    }
    return paddedBytes;
}
/** @internal */
function trim(value, options = {}) {
    const { dir = 'left' } = options;
    let data = value;
    let sliceLength = 0;
    for (let i = 0; i < data.length - 1; i++) {
        if (data[dir === 'left' ? i : data.length - i - 1].toString() === '0')
            sliceLength++;
        else
            break;
    }
    data =
        dir === 'left'
            ? data.slice(sliceLength)
            : data.slice(0, data.length - sliceLength);
    return data;
}

/** @internal */
function assertSize(hex, size_) {
    if (size$1(hex) > size_)
        throw new SizeOverflowError({
            givenSize: size$1(hex),
            maxSize: size_,
        });
}
/** @internal */
function assertStartOffset(value, start) {
    if (typeof start === 'number' && start > 0 && start > size$1(value) - 1)
        throw new SliceOffsetOutOfBoundsError({
            offset: start,
            position: 'start',
            size: size$1(value),
        });
}
/** @internal */
function assertEndOffset(value, start, end) {
    if (typeof start === 'number' &&
        typeof end === 'number' &&
        size$1(value) !== end - start) {
        throw new SliceOffsetOutOfBoundsError({
            offset: end,
            position: 'end',
            size: size$1(value),
        });
    }
}
/** @internal */
function pad(hex_, options = {}) {
    const { dir, size = 32 } = options;
    if (size === 0)
        return hex_;
    const hex = hex_.replace('0x', '');
    if (hex.length > size * 2)
        throw new SizeExceedsPaddingSizeError({
            size: Math.ceil(hex.length / 2),
            targetSize: size,
            type: 'Hex',
        });
    return `0x${hex[dir === 'right' ? 'padEnd' : 'padStart'](size * 2, '0')}`;
}

const bigIntSuffix = '#__bigint';
/**
 * Stringifies a value to its JSON representation, with support for `bigint`.
 *
 * @example
 * ```ts twoslash
 * import { Json } from 'ox'
 *
 * const json = Json.stringify({
 *   foo: 'bar',
 *   baz: 69420694206942069420694206942069420694206942069420n,
 * })
 * // @log: '{"foo":"bar","baz":"69420694206942069420694206942069420694206942069420#__bigint"}'
 * ```
 *
 * @param value - The value to stringify.
 * @param replacer - A function that transforms the results. It is passed the key and value of the property, and must return the value to be used in the JSON string. If this function returns `undefined`, the property is not included in the resulting JSON string.
 * @param space - A string or number that determines the indentation of the JSON string. If it is a number, it indicates the number of spaces to use as indentation; if it is a string (e.g. `'\t'`), it uses the string as the indentation character.
 * @returns The JSON string.
 */
function stringify(value, replacer, space) {
    return JSON.stringify(value, (key, value) => {
        if (typeof value === 'bigint')
            return value.toString() + bigIntSuffix;
        return value;
    }, space);
}

const decoder = /*#__PURE__*/ new TextDecoder();
const encoder$1 = /*#__PURE__*/ new TextEncoder();
/**
 * Instantiates a {@link ox#Bytes.Bytes} value from a `Uint8Array`, a hex string, or an array of unsigned 8-bit integers.
 *
 * :::tip
 *
 * To instantiate from a **Boolean**, **String**, or **Number**, use one of the following:
 *
 * - `Bytes.fromBoolean`
 *
 * - `Bytes.fromString`
 *
 * - `Bytes.fromNumber`
 *
 * :::
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { Bytes } from 'ox'
 *
 * const data = Bytes.from([255, 124, 5, 4])
 * // @log: Uint8Array([255, 124, 5, 4])
 *
 * const data = Bytes.from('0xdeadbeef')
 * // @log: Uint8Array([222, 173, 190, 239])
 * ```
 *
 * @param value - Value to convert.
 * @returns A {@link ox#Bytes.Bytes} instance.
 */
function from$7(value) {
    if (value instanceof Uint8Array)
        return value;
    if (typeof value === 'string')
        return fromHex$1(value);
    return fromArray(value);
}
/**
 * Converts an array of unsigned 8-bit integers into {@link ox#Bytes.Bytes}.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * const data = Bytes.fromArray([255, 124, 5, 4])
 * // @log: Uint8Array([255, 124, 5, 4])
 * ```
 *
 * @param value - Value to convert.
 * @returns A {@link ox#Bytes.Bytes} instance.
 */
function fromArray(value) {
    return value instanceof Uint8Array ? value : new Uint8Array(value);
}
/**
 * Encodes a {@link ox#Hex.Hex} value into {@link ox#Bytes.Bytes}.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * const data = Bytes.fromHex('0x48656c6c6f20776f726c6421')
 * // @log: Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])
 * ```
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * const data = Bytes.fromHex('0x48656c6c6f20776f726c6421', { size: 32 })
 * // @log: Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
 * ```
 *
 * @param value - {@link ox#Hex.Hex} value to encode.
 * @param options - Encoding options.
 * @returns Encoded {@link ox#Bytes.Bytes}.
 */
function fromHex$1(value, options = {}) {
    const { size } = options;
    let hex = value;
    if (size) {
        assertSize(value, size);
        hex = padRight(value, size);
    }
    let hexString = hex.slice(2);
    if (hexString.length % 2)
        hexString = `0${hexString}`;
    const length = hexString.length / 2;
    const bytes = new Uint8Array(length);
    for (let index = 0, j = 0; index < length; index++) {
        const nibbleLeft = charCodeToBase16(hexString.charCodeAt(j++));
        const nibbleRight = charCodeToBase16(hexString.charCodeAt(j++));
        if (nibbleLeft === undefined || nibbleRight === undefined) {
            throw new BaseError(`Invalid byte sequence ("${hexString[j - 2]}${hexString[j - 1]}" in "${hexString}").`);
        }
        bytes[index] = (nibbleLeft << 4) | nibbleRight;
    }
    return bytes;
}
/**
 * Encodes a string into {@link ox#Bytes.Bytes}.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * const data = Bytes.fromString('Hello world!')
 * // @log: Uint8Array([72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 33])
 * ```
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * const data = Bytes.fromString('Hello world!', { size: 32 })
 * // @log: Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
 * ```
 *
 * @param value - String to encode.
 * @param options - Encoding options.
 * @returns Encoded {@link ox#Bytes.Bytes}.
 */
function fromString$1(value, options = {}) {
    const { size } = options;
    const bytes = encoder$1.encode(value);
    if (typeof size === 'number') {
        assertSize$1(bytes, size);
        return padRight$1(bytes, size);
    }
    return bytes;
}
/**
 * Pads a {@link ox#Bytes.Bytes} value to the right with zero bytes until it reaches the given `size` (default: 32 bytes).
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * Bytes.padRight(Bytes.from([1]), 4)
 * // @log: Uint8Array([1, 0, 0, 0])
 * ```
 *
 * @param value - {@link ox#Bytes.Bytes} value to pad.
 * @param size - Size to pad the {@link ox#Bytes.Bytes} value to.
 * @returns Padded {@link ox#Bytes.Bytes} value.
 */
function padRight$1(value, size) {
    return pad$1(value, { dir: 'right', size });
}
/**
 * Retrieves the size of a {@link ox#Bytes.Bytes} value.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * Bytes.size(Bytes.from([1, 2, 3, 4]))
 * // @log: 4
 * ```
 *
 * @param value - {@link ox#Bytes.Bytes} value.
 * @returns Size of the {@link ox#Bytes.Bytes} value.
 */
function size$2(value) {
    return value.length;
}
/**
 * Returns a section of a {@link ox#Bytes.Bytes} value given a start/end bytes offset.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * Bytes.slice(
 *   Bytes.from([1, 2, 3, 4, 5, 6, 7, 8, 9]),
 *   1,
 *   4,
 * )
 * // @log: Uint8Array([2, 3, 4])
 * ```
 *
 * @param value - The {@link ox#Bytes.Bytes} value.
 * @param start - Start offset.
 * @param end - End offset.
 * @param options - Slice options.
 * @returns Sliced {@link ox#Bytes.Bytes} value.
 */
function slice$1(value, start, end, options = {}) {
    const value_ = value.slice(start, end);
    return value_;
}
/**
 * Decodes a {@link ox#Bytes.Bytes} into a bigint.
 *
 * @example
 * ```ts
 * import { Bytes } from 'ox'
 *
 * Bytes.toBigInt(Bytes.from([1, 164]))
 * // @log: 420n
 * ```
 *
 * @param bytes - The {@link ox#Bytes.Bytes} to decode.
 * @param options - Decoding options.
 * @returns Decoded bigint.
 */
function toBigInt$1(bytes, options = {}) {
    const { size } = options;
    if (typeof size !== 'undefined')
        assertSize$1(bytes, size);
    const hex = fromBytes$1(bytes, options);
    return toBigInt(hex, options);
}
/**
 * Decodes a {@link ox#Bytes.Bytes} into a boolean.
 *
 * @example
 * ```ts
 * import { Bytes } from 'ox'
 *
 * Bytes.toBoolean(Bytes.from([1]))
 * // @log: true
 * ```
 *
 * @param bytes - The {@link ox#Bytes.Bytes} to decode.
 * @param options - Decoding options.
 * @returns Decoded boolean.
 */
function toBoolean(bytes, options = {}) {
    const { size } = options;
    let bytes_ = bytes;
    if (typeof size !== 'undefined') {
        assertSize$1(bytes_, size);
        bytes_ = trimLeft(bytes_);
    }
    if (bytes_.length > 1 || bytes_[0] > 1)
        throw new InvalidBytesBooleanError(bytes_);
    return Boolean(bytes_[0]);
}
/**
 * Decodes a {@link ox#Bytes.Bytes} into a number.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * Bytes.toNumber(Bytes.from([1, 164]))
 * // @log: 420
 * ```
 */
function toNumber$1(bytes, options = {}) {
    const { size } = options;
    if (typeof size !== 'undefined')
        assertSize$1(bytes, size);
    const hex = fromBytes$1(bytes, options);
    return toNumber(hex, options);
}
/**
 * Decodes a {@link ox#Bytes.Bytes} into a string.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * const data = Bytes.toString(Bytes.from([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]))
 * // @log: 'Hello world'
 * ```
 *
 * @param bytes - The {@link ox#Bytes.Bytes} to decode.
 * @param options - Options.
 * @returns Decoded string.
 */
function toString(bytes, options = {}) {
    const { size } = options;
    let bytes_ = bytes;
    if (typeof size !== 'undefined') {
        assertSize$1(bytes_, size);
        bytes_ = trimRight(bytes_);
    }
    return decoder.decode(bytes_);
}
/**
 * Trims leading zeros from a {@link ox#Bytes.Bytes} value.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * Bytes.trimLeft(Bytes.from([0, 0, 0, 0, 1, 2, 3]))
 * // @log: Uint8Array([1, 2, 3])
 * ```
 *
 * @param value - {@link ox#Bytes.Bytes} value.
 * @returns Trimmed {@link ox#Bytes.Bytes} value.
 */
function trimLeft(value) {
    return trim(value, { dir: 'left' });
}
/**
 * Trims trailing zeros from a {@link ox#Bytes.Bytes} value.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * Bytes.trimRight(Bytes.from([1, 2, 3, 0, 0, 0, 0]))
 * // @log: Uint8Array([1, 2, 3])
 * ```
 *
 * @param value - {@link ox#Bytes.Bytes} value.
 * @returns Trimmed {@link ox#Bytes.Bytes} value.
 */
function trimRight(value) {
    return trim(value, { dir: 'right' });
}
/**
 * Thrown when the bytes value cannot be represented as a boolean.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * Bytes.toBoolean(Bytes.from([5]))
 * // @error: Bytes.InvalidBytesBooleanError: Bytes value `[5]` is not a valid boolean.
 * // @error: The bytes array must contain a single byte of either a `0` or `1` value.
 * ```
 */
class InvalidBytesBooleanError extends BaseError {
    constructor(bytes) {
        super(`Bytes value \`${bytes}\` is not a valid boolean.`, {
            metaMessages: [
                'The bytes array must contain a single byte of either a `0` or `1` value.',
            ],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Bytes.InvalidBytesBooleanError'
        });
    }
}
/**
 * Thrown when a size exceeds the maximum allowed size.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * Bytes.fromString('Hello World!', { size: 8 })
 * // @error: Bytes.SizeOverflowError: Size cannot exceed `8` bytes. Given size: `12` bytes.
 * ```
 */
let SizeOverflowError$1 = class SizeOverflowError extends BaseError {
    constructor({ givenSize, maxSize }) {
        super(`Size cannot exceed \`${maxSize}\` bytes. Given size: \`${givenSize}\` bytes.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Bytes.SizeOverflowError'
        });
    }
};
/**
 * Thrown when a the padding size exceeds the maximum allowed size.
 *
 * @example
 * ```ts twoslash
 * import { Bytes } from 'ox'
 *
 * Bytes.padLeft(Bytes.fromString('Hello World!'), 8)
 * // @error: [Bytes.SizeExceedsPaddingSizeError: Bytes size (`12`) exceeds padding size (`8`).
 * ```
 */
let SizeExceedsPaddingSizeError$1 = class SizeExceedsPaddingSizeError extends BaseError {
    constructor({ size, targetSize, type, }) {
        super(`${type.charAt(0).toUpperCase()}${type
            .slice(1)
            .toLowerCase()} size (\`${size}\`) exceeds padding size (\`${targetSize}\`).`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Bytes.SizeExceedsPaddingSizeError'
        });
    }
};

const encoder = /*#__PURE__*/ new TextEncoder();
const hexes$1 = /*#__PURE__*/ Array.from({ length: 256 }, (_v, i) => i.toString(16).padStart(2, '0'));
/**
 * Asserts if the given value is {@link ox#Hex.Hex}.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.assert('abc')
 * // @error: InvalidHexValueTypeError:
 * // @error: Value `"abc"` of type `string` is an invalid hex type.
 * // @error: Hex types must be represented as `"0x\${string}"`.
 * ```
 *
 * @param value - The value to assert.
 * @param options - Options.
 */
function assert$4(value, options = {}) {
    const { strict = false } = options;
    if (!value)
        throw new InvalidHexTypeError(value);
    if (typeof value !== 'string')
        throw new InvalidHexTypeError(value);
    if (strict) {
        if (!/^0x[0-9a-fA-F]*$/.test(value))
            throw new InvalidHexValueError(value);
    }
    if (!value.startsWith('0x'))
        throw new InvalidHexValueError(value);
}
/**
 * Concatenates two or more {@link ox#Hex.Hex}.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.concat('0x123', '0x456')
 * // @log: '0x123456'
 * ```
 *
 * @param values - The {@link ox#Hex.Hex} values to concatenate.
 * @returns The concatenated {@link ox#Hex.Hex} value.
 */
function concat(...values) {
    return `0x${values.reduce((acc, x) => acc + x.replace('0x', ''), '')}`;
}
/**
 * Instantiates a {@link ox#Hex.Hex} value from a hex string or {@link ox#Bytes.Bytes} value.
 *
 * :::tip
 *
 * To instantiate from a **Boolean**, **String**, or **Number**, use one of the following:
 *
 * - `Hex.fromBoolean`
 *
 * - `Hex.fromString`
 *
 * - `Hex.fromNumber`
 *
 * :::
 *
 * @example
 * ```ts twoslash
 * import { Bytes, Hex } from 'ox'
 *
 * Hex.from('0x48656c6c6f20576f726c6421')
 * // @log: '0x48656c6c6f20576f726c6421'
 *
 * Hex.from(Bytes.from([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]))
 * // @log: '0x48656c6c6f20576f726c6421'
 * ```
 *
 * @param value - The {@link ox#Bytes.Bytes} value to encode.
 * @returns The encoded {@link ox#Hex.Hex} value.
 */
function from$6(value) {
    if (value instanceof Uint8Array)
        return fromBytes$1(value);
    if (Array.isArray(value))
        return fromBytes$1(new Uint8Array(value));
    return value;
}
/**
 * Encodes a boolean into a {@link ox#Hex.Hex} value.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.fromBoolean(true)
 * // @log: '0x1'
 *
 * Hex.fromBoolean(false)
 * // @log: '0x0'
 *
 * Hex.fromBoolean(true, { size: 32 })
 * // @log: '0x0000000000000000000000000000000000000000000000000000000000000001'
 * ```
 *
 * @param value - The boolean value to encode.
 * @param options - Options.
 * @returns The encoded {@link ox#Hex.Hex} value.
 */
function fromBoolean(value, options = {}) {
    const hex = `0x${Number(value)}`;
    if (typeof options.size === 'number') {
        assertSize(hex, options.size);
        return padLeft(hex, options.size);
    }
    return hex;
}
/**
 * Encodes a {@link ox#Bytes.Bytes} value into a {@link ox#Hex.Hex} value.
 *
 * @example
 * ```ts twoslash
 * import { Bytes, Hex } from 'ox'
 *
 * Hex.fromBytes(Bytes.from([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]))
 * // @log: '0x48656c6c6f20576f726c6421'
 * ```
 *
 * @param value - The {@link ox#Bytes.Bytes} value to encode.
 * @param options - Options.
 * @returns The encoded {@link ox#Hex.Hex} value.
 */
function fromBytes$1(value, options = {}) {
    let string = '';
    for (let i = 0; i < value.length; i++)
        string += hexes$1[value[i]];
    const hex = `0x${string}`;
    if (typeof options.size === 'number') {
        assertSize(hex, options.size);
        return padRight(hex, options.size);
    }
    return hex;
}
/**
 * Encodes a number or bigint into a {@link ox#Hex.Hex} value.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.fromNumber(420)
 * // @log: '0x1a4'
 *
 * Hex.fromNumber(420, { size: 32 })
 * // @log: '0x00000000000000000000000000000000000000000000000000000000000001a4'
 * ```
 *
 * @param value - The number or bigint value to encode.
 * @param options - Options.
 * @returns The encoded {@link ox#Hex.Hex} value.
 */
function fromNumber(value, options = {}) {
    const { signed, size } = options;
    const value_ = BigInt(value);
    let maxValue;
    if (size) {
        if (signed)
            maxValue = (1n << (BigInt(size) * 8n - 1n)) - 1n;
        else
            maxValue = 2n ** (BigInt(size) * 8n) - 1n;
    }
    else if (typeof value === 'number') {
        maxValue = BigInt(Number.MAX_SAFE_INTEGER);
    }
    const minValue = typeof maxValue === 'bigint' && signed ? -maxValue - 1n : 0;
    if ((maxValue && value_ > maxValue) || value_ < minValue) {
        const suffix = typeof value === 'bigint' ? 'n' : '';
        throw new IntegerOutOfRangeError({
            max: maxValue ? `${maxValue}${suffix}` : undefined,
            min: `${minValue}${suffix}`,
            signed,
            size,
            value: `${value}${suffix}`,
        });
    }
    const stringValue = (signed && value_ < 0 ? BigInt.asUintN(size * 8, BigInt(value_)) : value_).toString(16);
    const hex = `0x${stringValue}`;
    if (size)
        return padLeft(hex, size);
    return hex;
}
/**
 * Encodes a string into a {@link ox#Hex.Hex} value.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 * Hex.fromString('Hello World!')
 * // '0x48656c6c6f20576f726c6421'
 *
 * Hex.fromString('Hello World!', { size: 32 })
 * // '0x48656c6c6f20576f726c64210000000000000000000000000000000000000000'
 * ```
 *
 * @param value - The string value to encode.
 * @param options - Options.
 * @returns The encoded {@link ox#Hex.Hex} value.
 */
function fromString(value, options = {}) {
    return fromBytes$1(encoder.encode(value), options);
}
/**
 * Pads a {@link ox#Hex.Hex} value to the left with zero bytes until it reaches the given `size` (default: 32 bytes).
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.padLeft('0x1234', 4)
 * // @log: '0x00001234'
 * ```
 *
 * @param value - The {@link ox#Hex.Hex} value to pad.
 * @param size - The size (in bytes) of the output hex value.
 * @returns The padded {@link ox#Hex.Hex} value.
 */
function padLeft(value, size) {
    return pad(value, { dir: 'left', size });
}
/**
 * Pads a {@link ox#Hex.Hex} value to the right with zero bytes until it reaches the given `size` (default: 32 bytes).
 *
 * @example
 * ```ts
 * import { Hex } from 'ox'
 *
 * Hex.padRight('0x1234', 4)
 * // @log: '0x12340000'
 * ```
 *
 * @param value - The {@link ox#Hex.Hex} value to pad.
 * @param size - The size (in bytes) of the output hex value.
 * @returns The padded {@link ox#Hex.Hex} value.
 */
function padRight(value, size) {
    return pad(value, { dir: 'right', size });
}
/**
 * Returns a section of a {@link ox#Bytes.Bytes} value given a start/end bytes offset.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.slice('0x0123456789', 1, 4)
 * // @log: '0x234567'
 * ```
 *
 * @param value - The {@link ox#Hex.Hex} value to slice.
 * @param start - The start offset (in bytes).
 * @param end - The end offset (in bytes).
 * @param options - Options.
 * @returns The sliced {@link ox#Hex.Hex} value.
 */
function slice(value, start, end, options = {}) {
    const { strict } = options;
    assertStartOffset(value, start);
    const value_ = `0x${value
        .replace('0x', '')
        .slice((start ?? 0) * 2, (end ?? value.length) * 2)}`;
    if (strict)
        assertEndOffset(value_, start, end);
    return value_;
}
/**
 * Retrieves the size of a {@link ox#Hex.Hex} value (in bytes).
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.size('0xdeadbeef')
 * // @log: 4
 * ```
 *
 * @param value - The {@link ox#Hex.Hex} value to get the size of.
 * @returns The size of the {@link ox#Hex.Hex} value (in bytes).
 */
function size$1(value) {
    return Math.ceil((value.length - 2) / 2);
}
/**
 * Decodes a {@link ox#Hex.Hex} value into a BigInt.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.toBigInt('0x1a4')
 * // @log: 420n
 *
 * Hex.toBigInt('0x00000000000000000000000000000000000000000000000000000000000001a4', { size: 32 })
 * // @log: 420n
 * ```
 *
 * @param hex - The {@link ox#Hex.Hex} value to decode.
 * @param options - Options.
 * @returns The decoded BigInt.
 */
function toBigInt(hex, options = {}) {
    const { signed } = options;
    if (options.size)
        assertSize(hex, options.size);
    const value = BigInt(hex);
    if (!signed)
        return value;
    const size = (hex.length - 2) / 2;
    const max_unsigned = (1n << (BigInt(size) * 8n)) - 1n;
    const max_signed = max_unsigned >> 1n;
    if (value <= max_signed)
        return value;
    return value - max_unsigned - 1n;
}
/**
 * Decodes a {@link ox#Hex.Hex} value into a number.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.toNumber('0x1a4')
 * // @log: 420
 *
 * Hex.toNumber('0x00000000000000000000000000000000000000000000000000000000000001a4', { size: 32 })
 * // @log: 420
 * ```
 *
 * @param hex - The {@link ox#Hex.Hex} value to decode.
 * @param options - Options.
 * @returns The decoded number.
 */
function toNumber(hex, options = {}) {
    const { signed, size } = options;
    if (!signed && !size)
        return Number(hex);
    return Number(toBigInt(hex, options));
}
/**
 * Checks if the given value is {@link ox#Hex.Hex}.
 *
 * @example
 * ```ts twoslash
 * import { Bytes, Hex } from 'ox'
 *
 * Hex.validate('0xdeadbeef')
 * // @log: true
 *
 * Hex.validate(Bytes.from([1, 2, 3]))
 * // @log: false
 * ```
 *
 * @param value - The value to check.
 * @param options - Options.
 * @returns `true` if the value is a {@link ox#Hex.Hex}, `false` otherwise.
 */
function validate$3(value, options = {}) {
    const { strict = false } = options;
    try {
        assert$4(value, { strict });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Thrown when the provided integer is out of range, and cannot be represented as a hex value.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.fromNumber(420182738912731283712937129)
 * // @error: Hex.IntegerOutOfRangeError: Number \`4.2018273891273126e+26\` is not in safe unsigned integer range (`0` to `9007199254740991`)
 * ```
 */
class IntegerOutOfRangeError extends BaseError {
    constructor({ max, min, signed, size, value, }) {
        super(`Number \`${value}\` is not in safe${size ? ` ${size * 8}-bit` : ''}${signed ? ' signed' : ' unsigned'} integer range ${max ? `(\`${min}\` to \`${max}\`)` : `(above \`${min}\`)`}`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Hex.IntegerOutOfRangeError'
        });
    }
}
/**
 * Thrown when the provided value is not a valid hex type.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.assert(1)
 * // @error: Hex.InvalidHexTypeError: Value `1` of type `number` is an invalid hex type.
 * ```
 */
class InvalidHexTypeError extends BaseError {
    constructor(value) {
        super(`Value \`${typeof value === 'object' ? stringify(value) : value}\` of type \`${typeof value}\` is an invalid hex type.`, {
            metaMessages: ['Hex types must be represented as `"0x${string}"`.'],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Hex.InvalidHexTypeError'
        });
    }
}
/**
 * Thrown when the provided hex value is invalid.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.assert('0x0123456789abcdefg')
 * // @error: Hex.InvalidHexValueError: Value `0x0123456789abcdefg` is an invalid hex value.
 * // @error: Hex values must start with `"0x"` and contain only hexadecimal characters (0-9, a-f, A-F).
 * ```
 */
class InvalidHexValueError extends BaseError {
    constructor(value) {
        super(`Value \`${value}\` is an invalid hex value.`, {
            metaMessages: [
                'Hex values must start with `"0x"` and contain only hexadecimal characters (0-9, a-f, A-F).',
            ],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Hex.InvalidHexValueError'
        });
    }
}
/**
 * Thrown when the size of the value exceeds the expected max size.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.fromString('Hello World!', { size: 8 })
 * // @error: Hex.SizeOverflowError: Size cannot exceed `8` bytes. Given size: `12` bytes.
 * ```
 */
class SizeOverflowError extends BaseError {
    constructor({ givenSize, maxSize }) {
        super(`Size cannot exceed \`${maxSize}\` bytes. Given size: \`${givenSize}\` bytes.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Hex.SizeOverflowError'
        });
    }
}
/**
 * Thrown when the slice offset exceeds the bounds of the value.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.slice('0x0123456789', 6)
 * // @error: Hex.SliceOffsetOutOfBoundsError: Slice starting at offset `6` is out-of-bounds (size: `5`).
 * ```
 */
class SliceOffsetOutOfBoundsError extends BaseError {
    constructor({ offset, position, size, }) {
        super(`Slice ${position === 'start' ? 'starting' : 'ending'} at offset \`${offset}\` is out-of-bounds (size: \`${size}\`).`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Hex.SliceOffsetOutOfBoundsError'
        });
    }
}
/**
 * Thrown when the size of the value exceeds the pad size.
 *
 * @example
 * ```ts twoslash
 * import { Hex } from 'ox'
 *
 * Hex.padLeft('0x1a4e12a45a21323123aaa87a897a897a898a6567a578a867a98778a667a85a875a87a6a787a65a675a6a9', 32)
 * // @error: Hex.SizeExceedsPaddingSizeError: Hex size (`43`) exceeds padding size (`32`).
 * ```
 */
class SizeExceedsPaddingSizeError extends BaseError {
    constructor({ size, targetSize, type, }) {
        super(`${type.charAt(0).toUpperCase()}${type
            .slice(1)
            .toLowerCase()} size (\`${size}\`) exceeds padding size (\`${targetSize}\`).`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Hex.SizeExceedsPaddingSizeError'
        });
    }
}

/**
 * Converts a {@link ox#Withdrawal.Withdrawal} to an {@link ox#Withdrawal.Rpc}.
 *
 * @example
 * ```ts twoslash
 * import { Withdrawal } from 'ox'
 *
 * const withdrawal = Withdrawal.toRpc({
 *   address: '0x00000000219ab540356cBB839Cbe05303d7705Fa',
 *   amount: 6423331n,
 *   index: 0,
 *   validatorIndex: 1,
 * })
 * // @log: {
 * // @log:   address: '0x00000000219ab540356cBB839Cbe05303d7705Fa',
 * // @log:   amount: '0x620323',
 * // @log:   index: '0x0',
 * // @log:   validatorIndex: '0x1',
 * // @log: }
 * ```
 *
 * @param withdrawal - The Withdrawal to convert.
 * @returns An RPC Withdrawal.
 */
function toRpc$1(withdrawal) {
    return {
        address: withdrawal.address,
        amount: fromNumber(withdrawal.amount),
        index: fromNumber(withdrawal.index),
        validatorIndex: fromNumber(withdrawal.validatorIndex),
    };
}

/**
 * Converts an {@link ox#BlockOverrides.BlockOverrides} to an {@link ox#BlockOverrides.Rpc}.
 *
 * @example
 * ```ts twoslash
 * import { BlockOverrides } from 'ox'
 *
 * const blockOverrides = BlockOverrides.toRpc({
 *   baseFeePerGas: 1n,
 *   blobBaseFee: 2n,
 *   feeRecipient: '0x0000000000000000000000000000000000000000',
 *   gasLimit: 4n,
 *   number: 5n,
 *   prevRandao: 6n,
 *   time: 78187493520n,
 *   withdrawals: [
 *     {
 *       address: '0x0000000000000000000000000000000000000000',
 *       amount: 1n,
 *       index: 0,
 *       validatorIndex: 1,
 *     },
 *   ],
 * })
 * ```
 *
 * @param blockOverrides - The block overrides to convert.
 * @returns An instantiated {@link ox#BlockOverrides.Rpc}.
 */
function toRpc(blockOverrides) {
    return {
        ...(typeof blockOverrides.baseFeePerGas === 'bigint' && {
            baseFeePerGas: fromNumber(blockOverrides.baseFeePerGas),
        }),
        ...(typeof blockOverrides.blobBaseFee === 'bigint' && {
            blobBaseFee: fromNumber(blockOverrides.blobBaseFee),
        }),
        ...(typeof blockOverrides.feeRecipient === 'string' && {
            feeRecipient: blockOverrides.feeRecipient,
        }),
        ...(typeof blockOverrides.gasLimit === 'bigint' && {
            gasLimit: fromNumber(blockOverrides.gasLimit),
        }),
        ...(typeof blockOverrides.number === 'bigint' && {
            number: fromNumber(blockOverrides.number),
        }),
        ...(typeof blockOverrides.prevRandao === 'bigint' && {
            prevRandao: fromNumber(blockOverrides.prevRandao),
        }),
        ...(typeof blockOverrides.time === 'bigint' && {
            time: fromNumber(blockOverrides.time),
        }),
        ...(blockOverrides.withdrawals && {
            withdrawals: blockOverrides.withdrawals.map(toRpc$1),
        }),
    };
}

/* [Multicall3](https://github.com/mds1/multicall) */
const multicall3Abi = [
    {
        inputs: [
            {
                components: [
                    {
                        name: 'target',
                        type: 'address',
                    },
                    {
                        name: 'allowFailure',
                        type: 'bool',
                    },
                    {
                        name: 'callData',
                        type: 'bytes',
                    },
                ],
                name: 'calls',
                type: 'tuple[]',
            },
        ],
        name: 'aggregate3',
        outputs: [
            {
                components: [
                    {
                        name: 'success',
                        type: 'bool',
                    },
                    {
                        name: 'returnData',
                        type: 'bytes',
                    },
                ],
                name: 'returnData',
                type: 'tuple[]',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            {
                name: 'addr',
                type: 'address',
            },
        ],
        name: 'getEthBalance',
        outputs: [
            {
                name: 'balance',
                type: 'uint256',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getCurrentBlockTimestamp',
        outputs: [
            {
                internalType: 'uint256',
                name: 'timestamp',
                type: 'uint256',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
];
const batchGatewayAbi = [
    {
        name: 'query',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            {
                type: 'tuple[]',
                name: 'queries',
                components: [
                    {
                        type: 'address',
                        name: 'sender',
                    },
                    {
                        type: 'string[]',
                        name: 'urls',
                    },
                    {
                        type: 'bytes',
                        name: 'data',
                    },
                ],
            },
        ],
        outputs: [
            {
                type: 'bool[]',
                name: 'failures',
            },
            {
                type: 'bytes[]',
                name: 'responses',
            },
        ],
    },
    {
        name: 'HttpError',
        type: 'error',
        inputs: [
            {
                type: 'uint16',
                name: 'status',
            },
            {
                type: 'string',
                name: 'message',
            },
        ],
    },
];
const universalResolverErrors = [
    {
        inputs: [
            {
                name: 'dns',
                type: 'bytes',
            },
        ],
        name: 'DNSDecodingFailed',
        type: 'error',
    },
    {
        inputs: [
            {
                name: 'ens',
                type: 'string',
            },
        ],
        name: 'DNSEncodingFailed',
        type: 'error',
    },
    {
        inputs: [],
        name: 'EmptyAddress',
        type: 'error',
    },
    {
        inputs: [
            {
                name: 'status',
                type: 'uint16',
            },
            {
                name: 'message',
                type: 'string',
            },
        ],
        name: 'HttpError',
        type: 'error',
    },
    {
        inputs: [],
        name: 'InvalidBatchGatewayResponse',
        type: 'error',
    },
    {
        inputs: [
            {
                name: 'errorData',
                type: 'bytes',
            },
        ],
        name: 'ResolverError',
        type: 'error',
    },
    {
        inputs: [
            {
                name: 'name',
                type: 'bytes',
            },
            {
                name: 'resolver',
                type: 'address',
            },
        ],
        name: 'ResolverNotContract',
        type: 'error',
    },
    {
        inputs: [
            {
                name: 'name',
                type: 'bytes',
            },
        ],
        name: 'ResolverNotFound',
        type: 'error',
    },
    {
        inputs: [
            {
                name: 'primary',
                type: 'string',
            },
            {
                name: 'primaryAddress',
                type: 'bytes',
            },
        ],
        name: 'ReverseAddressMismatch',
        type: 'error',
    },
    {
        inputs: [
            {
                internalType: 'bytes4',
                name: 'selector',
                type: 'bytes4',
            },
        ],
        name: 'UnsupportedResolverProfile',
        type: 'error',
    },
];
const universalResolverResolveAbi = [
    ...universalResolverErrors,
    {
        name: 'resolveWithGateways',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'name', type: 'bytes' },
            { name: 'data', type: 'bytes' },
            { name: 'gateways', type: 'string[]' },
        ],
        outputs: [
            { name: '', type: 'bytes' },
            { name: 'address', type: 'address' },
        ],
    },
];
const universalResolverReverseAbi = [
    ...universalResolverErrors,
    {
        name: 'reverseWithGateways',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { type: 'bytes', name: 'reverseName' },
            { type: 'uint256', name: 'coinType' },
            { type: 'string[]', name: 'gateways' },
        ],
        outputs: [
            { type: 'string', name: 'resolvedName' },
            { type: 'address', name: 'resolver' },
            { type: 'address', name: 'reverseResolver' },
        ],
    },
];
const textResolverAbi = [
    {
        name: 'text',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'name', type: 'bytes32' },
            { name: 'key', type: 'string' },
        ],
        outputs: [{ name: '', type: 'string' }],
    },
];
const addressResolverAbi = [
    {
        name: 'addr',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'name', type: 'bytes32' }],
        outputs: [{ name: '', type: 'address' }],
    },
    {
        name: 'addr',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'name', type: 'bytes32' },
            { name: 'coinType', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bytes' }],
    },
];
// ERC-1271
// isValidSignature(bytes32 hash, bytes signature) → bytes4 magicValue
/** @internal */
const erc1271Abi = [
    {
        name: 'isValidSignature',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'hash', type: 'bytes32' },
            { name: 'signature', type: 'bytes' },
        ],
        outputs: [{ name: '', type: 'bytes4' }],
    },
];
// ERC-6492 - universal deployless signature validator contract
// constructor(address _signer, bytes32 _hash, bytes _signature) → bytes4 returnValue
// returnValue is either 0x1 (valid) or 0x0 (invalid)
const erc6492SignatureValidatorAbi = [
    {
        inputs: [
            {
                name: '_signer',
                type: 'address',
            },
            {
                name: '_hash',
                type: 'bytes32',
            },
            {
                name: '_signature',
                type: 'bytes',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'constructor',
    },
    {
        inputs: [
            {
                name: '_signer',
                type: 'address',
            },
            {
                name: '_hash',
                type: 'bytes32',
            },
            {
                name: '_signature',
                type: 'bytes',
            },
        ],
        outputs: [
            {
                type: 'bool',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
        name: 'isValidSig',
    },
];

const aggregate3Signature = '0x82ad56cb';

const deploylessCallViaBytecodeBytecode = '0x608060405234801561001057600080fd5b5060405161018e38038061018e83398101604081905261002f91610124565b6000808351602085016000f59050803b61004857600080fd5b6000808351602085016000855af16040513d6000823e81610067573d81fd5b3d81f35b634e487b7160e01b600052604160045260246000fd5b600082601f83011261009257600080fd5b81516001600160401b038111156100ab576100ab61006b565b604051601f8201601f19908116603f011681016001600160401b03811182821017156100d9576100d961006b565b6040528181528382016020018510156100f157600080fd5b60005b82811015610110576020818601810151838301820152016100f4565b506000918101602001919091529392505050565b6000806040838503121561013757600080fd5b82516001600160401b0381111561014d57600080fd5b61015985828601610081565b602085015190935090506001600160401b0381111561017757600080fd5b61018385828601610081565b915050925092905056fe';
const deploylessCallViaFactoryBytecode = '0x608060405234801561001057600080fd5b506040516102c03803806102c083398101604081905261002f916101e6565b836001600160a01b03163b6000036100e457600080836001600160a01b03168360405161005c9190610270565b6000604051808303816000865af19150503d8060008114610099576040519150601f19603f3d011682016040523d82523d6000602084013e61009e565b606091505b50915091508115806100b857506001600160a01b0386163b155b156100e1578060405163101bb98d60e01b81526004016100d8919061028c565b60405180910390fd5b50505b6000808451602086016000885af16040513d6000823e81610103573d81fd5b3d81f35b80516001600160a01b038116811461011e57600080fd5b919050565b634e487b7160e01b600052604160045260246000fd5b60005b8381101561015457818101518382015260200161013c565b50506000910152565b600082601f83011261016e57600080fd5b81516001600160401b0381111561018757610187610123565b604051601f8201601f19908116603f011681016001600160401b03811182821017156101b5576101b5610123565b6040528181528382016020018510156101cd57600080fd5b6101de826020830160208701610139565b949350505050565b600080600080608085870312156101fc57600080fd5b61020585610107565b60208601519094506001600160401b0381111561022157600080fd5b61022d8782880161015d565b93505061023c60408601610107565b60608601519092506001600160401b0381111561025857600080fd5b6102648782880161015d565b91505092959194509250565b60008251610282818460208701610139565b9190910192915050565b60208152600082518060208401526102ab816040850160208701610139565b601f01601f1916919091016040019291505056fe';
const erc6492SignatureValidatorByteCode = '0x608060405234801561001057600080fd5b5060405161069438038061069483398101604081905261002f9161051e565b600061003c848484610048565b9050806000526001601ff35b60007f64926492649264926492649264926492649264926492649264926492649264926100748361040c565b036101e7576000606080848060200190518101906100929190610577565b60405192955090935091506000906001600160a01b038516906100b69085906105dd565b6000604051808303816000865af19150503d80600081146100f3576040519150601f19603f3d011682016040523d82523d6000602084013e6100f8565b606091505b50509050876001600160a01b03163b60000361016057806101605760405162461bcd60e51b815260206004820152601e60248201527f5369676e617475726556616c696461746f723a206465706c6f796d656e74000060448201526064015b60405180910390fd5b604051630b135d3f60e11b808252906001600160a01b038a1690631626ba7e90610190908b9087906004016105f9565b602060405180830381865afa1580156101ad573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906101d19190610633565b6001600160e01b03191614945050505050610405565b6001600160a01b0384163b1561027a57604051630b135d3f60e11b808252906001600160a01b03861690631626ba7e9061022790879087906004016105f9565b602060405180830381865afa158015610244573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906102689190610633565b6001600160e01b031916149050610405565b81516041146102df5760405162461bcd60e51b815260206004820152603a602482015260008051602061067483398151915260448201527f3a20696e76616c6964207369676e6174757265206c656e6774680000000000006064820152608401610157565b6102e7610425565b5060208201516040808401518451859392600091859190811061030c5761030c61065d565b016020015160f81c9050601b811480159061032b57508060ff16601c14155b1561038c5760405162461bcd60e51b815260206004820152603b602482015260008051602061067483398151915260448201527f3a20696e76616c6964207369676e617475726520762076616c756500000000006064820152608401610157565b60408051600081526020810180835289905260ff83169181019190915260608101849052608081018390526001600160a01b0389169060019060a0016020604051602081039080840390855afa1580156103ea573d6000803e3d6000fd5b505050602060405103516001600160a01b0316149450505050505b9392505050565b600060208251101561041d57600080fd5b508051015190565b60405180606001604052806003906020820280368337509192915050565b6001600160a01b038116811461045857600080fd5b50565b634e487b7160e01b600052604160045260246000fd5b60005b8381101561048c578181015183820152602001610474565b50506000910152565b600082601f8301126104a657600080fd5b81516001600160401b038111156104bf576104bf61045b565b604051601f8201601f19908116603f011681016001600160401b03811182821017156104ed576104ed61045b565b60405281815283820160200185101561050557600080fd5b610516826020830160208701610471565b949350505050565b60008060006060848603121561053357600080fd5b835161053e81610443565b6020850151604086015191945092506001600160401b0381111561056157600080fd5b61056d86828701610495565b9150509250925092565b60008060006060848603121561058c57600080fd5b835161059781610443565b60208501519093506001600160401b038111156105b357600080fd5b6105bf86828701610495565b604086015190935090506001600160401b0381111561056157600080fd5b600082516105ef818460208701610471565b9190910192915050565b828152604060208201526000825180604084015261061e816060850160208701610471565b601f01601f1916919091016060019392505050565b60006020828403121561064557600080fd5b81516001600160e01b03198116811461040557600080fd5b634e487b7160e01b600052603260045260246000fdfe5369676e617475726556616c696461746f72237265636f7665725369676e6572';
const multicall3Bytecode = '0x608060405234801561001057600080fd5b506115b9806100206000396000f3fe6080604052600436106100f35760003560e01c80634d2301cc1161008a578063a8b0574e11610059578063a8b0574e14610325578063bce38bd714610350578063c3077fa914610380578063ee82ac5e146103b2576100f3565b80634d2301cc1461026257806372425d9d1461029f57806382ad56cb146102ca57806386d516e8146102fa576100f3565b80633408e470116100c65780633408e470146101af578063399542e9146101da5780633e64a6961461020c57806342cbb15c14610237576100f3565b80630f28c97d146100f8578063174dea7114610123578063252dba421461015357806327e86d6e14610184575b600080fd5b34801561010457600080fd5b5061010d6103ef565b60405161011a9190610c0a565b60405180910390f35b61013d60048036038101906101389190610c94565b6103f7565b60405161014a9190610e94565b60405180910390f35b61016d60048036038101906101689190610f0c565b610615565b60405161017b92919061101b565b60405180910390f35b34801561019057600080fd5b506101996107ab565b6040516101a69190611064565b60405180910390f35b3480156101bb57600080fd5b506101c46107b7565b6040516101d19190610c0a565b60405180910390f35b6101f460048036038101906101ef91906110ab565b6107bf565b6040516102039392919061110b565b60405180910390f35b34801561021857600080fd5b506102216107e1565b60405161022e9190610c0a565b60405180910390f35b34801561024357600080fd5b5061024c6107e9565b6040516102599190610c0a565b60405180910390f35b34801561026e57600080fd5b50610289600480360381019061028491906111a7565b6107f1565b6040516102969190610c0a565b60405180910390f35b3480156102ab57600080fd5b506102b4610812565b6040516102c19190610c0a565b60405180910390f35b6102e460048036038101906102df919061122a565b61081a565b6040516102f19190610e94565b60405180910390f35b34801561030657600080fd5b5061030f6109e4565b60405161031c9190610c0a565b60405180910390f35b34801561033157600080fd5b5061033a6109ec565b6040516103479190611286565b60405180910390f35b61036a600480360381019061036591906110ab565b6109f4565b6040516103779190610e94565b60405180910390f35b61039a60048036038101906103959190610f0c565b610ba6565b6040516103a99392919061110b565b60405180910390f35b3480156103be57600080fd5b506103d960048036038101906103d491906112cd565b610bca565b6040516103e69190611064565b60405180910390f35b600042905090565b60606000808484905090508067ffffffffffffffff81111561041c5761041b6112fa565b5b60405190808252806020026020018201604052801561045557816020015b610442610bd5565b81526020019060019003908161043a5790505b5092503660005b828110156105c957600085828151811061047957610478611329565b5b6020026020010151905087878381811061049657610495611329565b5b90506020028101906104a89190611367565b925060008360400135905080860195508360000160208101906104cb91906111a7565b73ffffffffffffffffffffffffffffffffffffffff16818580606001906104f2919061138f565b604051610500929190611431565b60006040518083038185875af1925050503d806000811461053d576040519150601f19603f3d011682016040523d82523d6000602084013e610542565b606091505b5083600001846020018290528215151515815250505081516020850135176105bc577f08c379a000000000000000000000000000000000000000000000000000000000600052602060045260176024527f4d756c746963616c6c333a2063616c6c206661696c656400000000000000000060445260846000fd5b826001019250505061045c565b5082341461060c576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610603906114a7565b60405180910390fd5b50505092915050565b6000606043915060008484905090508067ffffffffffffffff81111561063e5761063d6112fa565b5b60405190808252806020026020018201604052801561067157816020015b606081526020019060019003908161065c5790505b5091503660005b828110156107a157600087878381811061069557610694611329565b5b90506020028101906106a791906114c7565b92508260000160208101906106bc91906111a7565b73ffffffffffffffffffffffffffffffffffffffff168380602001906106e2919061138f565b6040516106f0929190611431565b6000604051808303816000865af19150503d806000811461072d576040519150601f19603f3d011682016040523d82523d6000602084013e610732565b606091505b5086848151811061074657610745611329565b5b60200260200101819052819250505080610795576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161078c9061153b565b60405180910390fd5b81600101915050610678565b5050509250929050565b60006001430340905090565b600046905090565b6000806060439250434091506107d68686866109f4565b905093509350939050565b600048905090565b600043905090565b60008173ffffffffffffffffffffffffffffffffffffffff16319050919050565b600044905090565b606060008383905090508067ffffffffffffffff81111561083e5761083d6112fa565b5b60405190808252806020026020018201604052801561087757816020015b610864610bd5565b81526020019060019003908161085c5790505b5091503660005b828110156109db57600084828151811061089b5761089a611329565b5b602002602001015190508686838181106108b8576108b7611329565b5b90506020028101906108ca919061155b565b92508260000160208101906108df91906111a7565b73ffffffffffffffffffffffffffffffffffffffff16838060400190610905919061138f565b604051610913929190611431565b6000604051808303816000865af19150503d8060008114610950576040519150601f19603f3d011682016040523d82523d6000602084013e610955565b606091505b5082600001836020018290528215151515815250505080516020840135176109cf577f08c379a000000000000000000000000000000000000000000000000000000000600052602060045260176024527f4d756c746963616c6c333a2063616c6c206661696c656400000000000000000060445260646000fd5b8160010191505061087e565b50505092915050565b600045905090565b600041905090565b606060008383905090508067ffffffffffffffff811115610a1857610a176112fa565b5b604051908082528060200260200182016040528015610a5157816020015b610a3e610bd5565b815260200190600190039081610a365790505b5091503660005b82811015610b9c576000848281518110610a7557610a74611329565b5b60200260200101519050868683818110610a9257610a91611329565b5b9050602002810190610aa491906114c7565b9250826000016020810190610ab991906111a7565b73ffffffffffffffffffffffffffffffffffffffff16838060200190610adf919061138f565b604051610aed929190611431565b6000604051808303816000865af19150503d8060008114610b2a576040519150601f19603f3d011682016040523d82523d6000602084013e610b2f565b606091505b508260000183602001829052821515151581525050508715610b90578060000151610b8f576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b869061153b565b60405180910390fd5b5b81600101915050610a58565b5050509392505050565b6000806060610bb7600186866107bf565b8093508194508295505050509250925092565b600081409050919050565b6040518060400160405280600015158152602001606081525090565b6000819050919050565b610c0481610bf1565b82525050565b6000602082019050610c1f6000830184610bfb565b92915050565b600080fd5b600080fd5b600080fd5b600080fd5b600080fd5b60008083601f840112610c5457610c53610c2f565b5b8235905067ffffffffffffffff811115610c7157610c70610c34565b5b602083019150836020820283011115610c8d57610c8c610c39565b5b9250929050565b60008060208385031215610cab57610caa610c25565b5b600083013567ffffffffffffffff811115610cc957610cc8610c2a565b5b610cd585828601610c3e565b92509250509250929050565b600081519050919050565b600082825260208201905092915050565b6000819050602082019050919050565b60008115159050919050565b610d2281610d0d565b82525050565b600081519050919050565b600082825260208201905092915050565b60005b83811015610d62578082015181840152602081019050610d47565b83811115610d71576000848401525b50505050565b6000601f19601f8301169050919050565b6000610d9382610d28565b610d9d8185610d33565b9350610dad818560208601610d44565b610db681610d77565b840191505092915050565b6000604083016000830151610dd96000860182610d19565b5060208301518482036020860152610df18282610d88565b9150508091505092915050565b6000610e0a8383610dc1565b905092915050565b6000602082019050919050565b6000610e2a82610ce1565b610e348185610cec565b935083602082028501610e4685610cfd565b8060005b85811015610e825784840389528151610e638582610dfe565b9450610e6e83610e12565b925060208a01995050600181019050610e4a565b50829750879550505050505092915050565b60006020820190508181036000830152610eae8184610e1f565b905092915050565b60008083601f840112610ecc57610ecb610c2f565b5b8235905067ffffffffffffffff811115610ee957610ee8610c34565b5b602083019150836020820283011115610f0557610f04610c39565b5b9250929050565b60008060208385031215610f2357610f22610c25565b5b600083013567ffffffffffffffff811115610f4157610f40610c2a565b5b610f4d85828601610eb6565b92509250509250929050565b600081519050919050565b600082825260208201905092915050565b6000819050602082019050919050565b6000610f918383610d88565b905092915050565b6000602082019050919050565b6000610fb182610f59565b610fbb8185610f64565b935083602082028501610fcd85610f75565b8060005b858110156110095784840389528151610fea8582610f85565b9450610ff583610f99565b925060208a01995050600181019050610fd1565b50829750879550505050505092915050565b60006040820190506110306000830185610bfb565b81810360208301526110428184610fa6565b90509392505050565b6000819050919050565b61105e8161104b565b82525050565b60006020820190506110796000830184611055565b92915050565b61108881610d0d565b811461109357600080fd5b50565b6000813590506110a58161107f565b92915050565b6000806000604084860312156110c4576110c3610c25565b5b60006110d286828701611096565b935050602084013567ffffffffffffffff8111156110f3576110f2610c2a565b5b6110ff86828701610eb6565b92509250509250925092565b60006060820190506111206000830186610bfb565b61112d6020830185611055565b818103604083015261113f8184610e1f565b9050949350505050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061117482611149565b9050919050565b61118481611169565b811461118f57600080fd5b50565b6000813590506111a18161117b565b92915050565b6000602082840312156111bd576111bc610c25565b5b60006111cb84828501611192565b91505092915050565b60008083601f8401126111ea576111e9610c2f565b5b8235905067ffffffffffffffff81111561120757611206610c34565b5b60208301915083602082028301111561122357611222610c39565b5b9250929050565b6000806020838503121561124157611240610c25565b5b600083013567ffffffffffffffff81111561125f5761125e610c2a565b5b61126b858286016111d4565b92509250509250929050565b61128081611169565b82525050565b600060208201905061129b6000830184611277565b92915050565b6112aa81610bf1565b81146112b557600080fd5b50565b6000813590506112c7816112a1565b92915050565b6000602082840312156112e3576112e2610c25565b5b60006112f1848285016112b8565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b600080fd5b600080fd5b600080fd5b60008235600160800383360303811261138357611382611358565b5b80830191505092915050565b600080833560016020038436030381126113ac576113ab611358565b5b80840192508235915067ffffffffffffffff8211156113ce576113cd61135d565b5b6020830192506001820236038313156113ea576113e9611362565b5b509250929050565b600081905092915050565b82818337600083830152505050565b600061141883856113f2565b93506114258385846113fd565b82840190509392505050565b600061143e82848661140c565b91508190509392505050565b600082825260208201905092915050565b7f4d756c746963616c6c333a2076616c7565206d69736d61746368000000000000600082015250565b6000611491601a8361144a565b915061149c8261145b565b602082019050919050565b600060208201905081810360008301526114c081611484565b9050919050565b6000823560016040038336030381126114e3576114e2611358565b5b80830191505092915050565b7f4d756c746963616c6c333a2063616c6c206661696c6564000000000000000000600082015250565b600061152560178361144a565b9150611530826114ef565b602082019050919050565b6000602082019050818103600083015261155481611518565b9050919050565b60008235600160600383360303811261157757611576611358565b5b8083019150509291505056fea264697066735822122020c1bc9aacf8e4a6507193432a895a8e77094f45a1395583f07b24e860ef06cd64736f6c634300080c0033';

class ChainDoesNotSupportContract extends BaseError$1 {
    constructor({ blockNumber, chain, contract, }) {
        super(`Chain "${chain.name}" does not support contract "${contract.name}".`, {
            metaMessages: [
                'This could be due to any of the following:',
                ...(blockNumber &&
                    contract.blockCreated &&
                    contract.blockCreated > blockNumber
                    ? [
                        `- The contract "${contract.name}" was not deployed until block ${contract.blockCreated} (current block ${blockNumber}).`,
                    ]
                    : [
                        `- The chain does not have the contract "${contract.name}" configured.`,
                    ]),
            ],
            name: 'ChainDoesNotSupportContract',
        });
    }
}
class ChainMismatchError extends BaseError$1 {
    constructor({ chain, currentChainId, }) {
        super(`The current chain of the wallet (id: ${currentChainId}) does not match the target chain for the transaction (id: ${chain.id} – ${chain.name}).`, {
            metaMessages: [
                `Current Chain ID:  ${currentChainId}`,
                `Expected Chain ID: ${chain.id} – ${chain.name}`,
            ],
            name: 'ChainMismatchError',
        });
    }
}
class ChainNotFoundError extends BaseError$1 {
    constructor() {
        super([
            'No chain was provided to the request.',
            'Please provide a chain with the `chain` argument on the Action, or by supplying a `chain` to WalletClient.',
        ].join('\n'), {
            name: 'ChainNotFoundError',
        });
    }
}
class ClientChainNotConfiguredError extends BaseError$1 {
    constructor() {
        super('No chain was provided to the Client.', {
            name: 'ClientChainNotConfiguredError',
        });
    }
}

const docsPath$2 = '/docs/contract/encodeDeployData';
function encodeDeployData(parameters) {
    const { abi, args, bytecode } = parameters;
    if (!args || args.length === 0)
        return bytecode;
    const description = abi.find((x) => 'type' in x && x.type === 'constructor');
    if (!description)
        throw new AbiConstructorNotFoundError({ docsPath: docsPath$2 });
    if (!('inputs' in description))
        throw new AbiConstructorParamsNotFoundError({ docsPath: docsPath$2 });
    if (!description.inputs || description.inputs.length === 0)
        throw new AbiConstructorParamsNotFoundError({ docsPath: docsPath$2 });
    const data = encodeAbiParameters(description.inputs, args);
    return concatHex([bytecode, data]);
}

function getChainContractAddress({ blockNumber, chain, contract: name, }) {
    const contract = chain?.contracts?.[name];
    if (!contract)
        throw new ChainDoesNotSupportContract({
            chain,
            contract: { name },
        });
    if (blockNumber &&
        contract.blockCreated &&
        contract.blockCreated > blockNumber)
        throw new ChainDoesNotSupportContract({
            blockNumber,
            chain,
            contract: {
                name,
                blockCreated: contract.blockCreated,
            },
        });
    return contract.address;
}

function getCallError(err, { docsPath, ...args }) {
    const cause = (() => {
        const cause = getNodeError(err, args);
        if (cause instanceof UnknownNodeError)
            return err;
        return cause;
    })();
    return new CallExecutionError(cause, {
        docsPath,
        ...args,
    });
}

/** @internal */
function withResolvers() {
    let resolve = () => undefined;
    let reject = () => undefined;
    const promise = new Promise((resolve_, reject_) => {
        resolve = resolve_;
        reject = reject_;
    });
    return { promise, resolve, reject };
}

const schedulerCache = /*#__PURE__*/ new Map();
/** @internal */
function createBatchScheduler({ fn, id, shouldSplitBatch, wait = 0, sort, }) {
    const exec = async () => {
        const scheduler = getScheduler();
        flush();
        const args = scheduler.map(({ args }) => args);
        if (args.length === 0)
            return;
        fn(args)
            .then((data) => {
            if (sort && Array.isArray(data))
                data.sort(sort);
            for (let i = 0; i < scheduler.length; i++) {
                const { resolve } = scheduler[i];
                resolve?.([data[i], data]);
            }
        })
            .catch((err) => {
            for (let i = 0; i < scheduler.length; i++) {
                const { reject } = scheduler[i];
                reject?.(err);
            }
        });
    };
    const flush = () => schedulerCache.delete(id);
    const getBatchedArgs = () => getScheduler().map(({ args }) => args);
    const getScheduler = () => schedulerCache.get(id) || [];
    const setScheduler = (item) => schedulerCache.set(id, [...getScheduler(), item]);
    return {
        flush,
        async schedule(args) {
            const { promise, resolve, reject } = withResolvers();
            const split = shouldSplitBatch?.([...getBatchedArgs(), args]);
            if (split)
                exec();
            const hasActiveScheduler = getScheduler().length > 0;
            if (hasActiveScheduler) {
                setScheduler({ args, resolve, reject });
                return promise;
            }
            setScheduler({ args, resolve, reject });
            setTimeout(exec, wait);
            return promise;
        },
    };
}

/**
 * Executes a new message call immediately without submitting a transaction to the network.
 *
 * - Docs: https://viem.sh/docs/actions/public/call
 * - JSON-RPC Methods: [`eth_call`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_call)
 *
 * @param client - Client to use
 * @param parameters - {@link CallParameters}
 * @returns The call data. {@link CallReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { call } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const data = await call(client, {
 *   account: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
 *   data: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
 *   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 * })
 */
async function call(client, args) {
    const { account: account_ = client.account, authorizationList, batch = Boolean(client.batch?.multicall), blockNumber, blockTag = client.experimental_blockTag ?? 'latest', accessList, blobs, blockOverrides, code, data: data_, factory, factoryData, gas, gasPrice, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, nonce, to, value, stateOverride, ...rest } = args;
    const account = account_ ? parseAccount(account_) : undefined;
    if (code && (factory || factoryData))
        throw new BaseError$1('Cannot provide both `code` & `factory`/`factoryData` as parameters.');
    if (code && to)
        throw new BaseError$1('Cannot provide both `code` & `to` as parameters.');
    // Check if the call is deployless via bytecode.
    const deploylessCallViaBytecode = code && data_;
    // Check if the call is deployless via a factory.
    const deploylessCallViaFactory = factory && factoryData && to && data_;
    const deploylessCall = deploylessCallViaBytecode || deploylessCallViaFactory;
    const data = (() => {
        if (deploylessCallViaBytecode)
            return toDeploylessCallViaBytecodeData({
                code,
                data: data_,
            });
        if (deploylessCallViaFactory)
            return toDeploylessCallViaFactoryData({
                data: data_,
                factory,
                factoryData,
                to,
            });
        return data_;
    })();
    try {
        assertRequest(args);
        const blockNumberHex = typeof blockNumber === 'bigint' ? numberToHex(blockNumber) : undefined;
        const block = blockNumberHex || blockTag;
        const rpcBlockOverrides = blockOverrides
            ? toRpc(blockOverrides)
            : undefined;
        const rpcStateOverride = serializeStateOverride(stateOverride);
        const chainFormat = client.chain?.formatters?.transactionRequest?.format;
        const format = chainFormat || formatTransactionRequest;
        const request = format({
            // Pick out extra data that might exist on the chain's transaction request type.
            ...extract$1(rest, { format: chainFormat }),
            accessList,
            account,
            authorizationList,
            blobs,
            data,
            gas,
            gasPrice,
            maxFeePerBlobGas,
            maxFeePerGas,
            maxPriorityFeePerGas,
            nonce,
            to: deploylessCall ? undefined : to,
            value,
        }, 'call');
        if (batch &&
            shouldPerformMulticall({ request }) &&
            !rpcStateOverride &&
            !rpcBlockOverrides) {
            try {
                return await scheduleMulticall(client, {
                    ...request,
                    blockNumber,
                    blockTag,
                });
            }
            catch (err) {
                if (!(err instanceof ClientChainNotConfiguredError) &&
                    !(err instanceof ChainDoesNotSupportContract))
                    throw err;
            }
        }
        const params = (() => {
            const base = [
                request,
                block,
            ];
            if (rpcStateOverride && rpcBlockOverrides)
                return [...base, rpcStateOverride, rpcBlockOverrides];
            if (rpcStateOverride)
                return [...base, rpcStateOverride];
            if (rpcBlockOverrides)
                return [...base, {}, rpcBlockOverrides];
            return base;
        })();
        const response = await client.request({
            method: 'eth_call',
            params,
        });
        if (response === '0x')
            return { data: undefined };
        return { data: response };
    }
    catch (err) {
        const data = getRevertErrorData(err);
        // Check for CCIP-Read offchain lookup signature.
        const { offchainLookup, offchainLookupSignature } = await Promise.resolve().then(function () { return ccip; });
        if (client.ccipRead !== false &&
            data?.slice(0, 10) === offchainLookupSignature &&
            to)
            return { data: await offchainLookup(client, { data, to }) };
        // Check for counterfactual deployment error.
        if (deploylessCall && data?.slice(0, 10) === '0x101bb98d')
            throw new CounterfactualDeploymentFailedError({ factory });
        throw getCallError(err, {
            ...args,
            account,
            chain: client.chain,
        });
    }
}
// We only want to perform a scheduled multicall if:
// - The request has calldata,
// - The request has a target address,
// - The target address is not already the aggregate3 signature,
// - The request has no other properties (`nonce`, `gas`, etc cannot be sent with a multicall).
function shouldPerformMulticall({ request }) {
    const { data, to, ...request_ } = request;
    if (!data)
        return false;
    if (data.startsWith(aggregate3Signature))
        return false;
    if (!to)
        return false;
    if (Object.values(request_).filter((x) => typeof x !== 'undefined').length > 0)
        return false;
    return true;
}
async function scheduleMulticall(client, args) {
    const { batchSize = 1024, deployless = false, wait = 0, } = typeof client.batch?.multicall === 'object' ? client.batch.multicall : {};
    const { blockNumber, blockTag = client.experimental_blockTag ?? 'latest', data, to, } = args;
    const multicallAddress = (() => {
        if (deployless)
            return null;
        if (args.multicallAddress)
            return args.multicallAddress;
        if (client.chain) {
            return getChainContractAddress({
                blockNumber,
                chain: client.chain,
                contract: 'multicall3',
            });
        }
        throw new ClientChainNotConfiguredError();
    })();
    const blockNumberHex = typeof blockNumber === 'bigint' ? numberToHex(blockNumber) : undefined;
    const block = blockNumberHex || blockTag;
    const { schedule } = createBatchScheduler({
        id: `${client.uid}.${block}`,
        wait,
        shouldSplitBatch(args) {
            const size = args.reduce((size, { data }) => size + (data.length - 2), 0);
            return size > batchSize * 2;
        },
        fn: async (requests) => {
            const calls = requests.map((request) => ({
                allowFailure: true,
                callData: request.data,
                target: request.to,
            }));
            const calldata = encodeFunctionData({
                abi: multicall3Abi,
                args: [calls],
                functionName: 'aggregate3',
            });
            const data = await client.request({
                method: 'eth_call',
                params: [
                    {
                        ...(multicallAddress === null
                            ? {
                                data: toDeploylessCallViaBytecodeData({
                                    code: multicall3Bytecode,
                                    data: calldata,
                                }),
                            }
                            : { to: multicallAddress, data: calldata }),
                    },
                    block,
                ],
            });
            return decodeFunctionResult({
                abi: multicall3Abi,
                args: [calls],
                functionName: 'aggregate3',
                data: data || '0x',
            });
        },
    });
    const [{ returnData, success }] = await schedule({ data, to });
    if (!success)
        throw new RawContractError({ data: returnData });
    if (returnData === '0x')
        return { data: undefined };
    return { data: returnData };
}
function toDeploylessCallViaBytecodeData(parameters) {
    const { code, data } = parameters;
    return encodeDeployData({
        abi: parseAbi(['constructor(bytes, bytes)']),
        bytecode: deploylessCallViaBytecodeBytecode,
        args: [code, data],
    });
}
function toDeploylessCallViaFactoryData(parameters) {
    const { data, factory, factoryData, to } = parameters;
    return encodeDeployData({
        abi: parseAbi(['constructor(address, bytes, address, bytes)']),
        bytecode: deploylessCallViaFactoryBytecode,
        args: [to, data, factory, factoryData],
    });
}
/** @internal */
function getRevertErrorData(err) {
    if (!(err instanceof BaseError$1))
        return undefined;
    const error = err.walk();
    return typeof error?.data === 'object' ? error.data?.data : error.data;
}

/**
 * Calls a read-only function on a contract, and returns the response.
 *
 * - Docs: https://viem.sh/docs/contract/readContract
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts_reading-contracts
 *
 * A "read-only" function (constant function) on a Solidity contract is denoted by a `view` or `pure` keyword. They can only read the state of the contract, and cannot make any changes to it. Since read-only methods do not change the state of the contract, they do not require any gas to be executed, and can be called by any user without the need to pay for gas.
 *
 * Internally, uses a [Public Client](https://viem.sh/docs/clients/public) to call the [`call` action](https://viem.sh/docs/actions/public/call) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).
 *
 * @param client - Client to use
 * @param parameters - {@link ReadContractParameters}
 * @returns The response from the contract. Type is inferred. {@link ReadContractReturnType}
 *
 * @example
 * import { createPublicClient, http, parseAbi } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { readContract } from 'viem/contract'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const result = await readContract(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *   abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
 *   functionName: 'balanceOf',
 *   args: ['0xA0Cf798816D4b9b9866b5330EEa46a18382f251e'],
 * })
 * // 424122n
 */
async function readContract(client, parameters) {
    const { abi, address, args, functionName, ...rest } = parameters;
    const calldata = encodeFunctionData({
        abi,
        args,
        functionName,
    });
    try {
        const { data } = await getAction(client, call, 'call')({
            ...rest,
            data: calldata,
            to: address,
        });
        return decodeFunctionResult({
            abi,
            args,
            functionName,
            data: data || '0x',
        });
    }
    catch (error) {
        throw getContractError(error, {
            abi,
            address,
            args,
            docsPath: '/docs/contract/readContract',
            functionName,
        });
    }
}

/**
 * Simulates/validates a contract interaction. This is useful for retrieving **return data** and **revert reasons** of contract write functions.
 *
 * - Docs: https://viem.sh/docs/contract/simulateContract
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts_writing-to-contracts
 *
 * This function does not require gas to execute and _**does not**_ change the state of the blockchain. It is almost identical to [`readContract`](https://viem.sh/docs/contract/readContract), but also supports contract write functions.
 *
 * Internally, uses a [Public Client](https://viem.sh/docs/clients/public) to call the [`call` action](https://viem.sh/docs/actions/public/call) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).
 *
 * @param client - Client to use
 * @param parameters - {@link SimulateContractParameters}
 * @returns The simulation result and write request. {@link SimulateContractReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { simulateContract } from 'viem/contract'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const result = await simulateContract(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *   abi: parseAbi(['function mint(uint32) view returns (uint32)']),
 *   functionName: 'mint',
 *   args: ['69420'],
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 * })
 */
async function simulateContract(client, parameters) {
    const { abi, address, args, functionName, dataSuffix = typeof client.dataSuffix === 'string'
        ? client.dataSuffix
        : client.dataSuffix?.value, ...callRequest } = parameters;
    const account = callRequest.account
        ? parseAccount(callRequest.account)
        : client.account;
    const calldata = encodeFunctionData({ abi, args, functionName });
    try {
        const { data } = await getAction(client, call, 'call')({
            batch: false,
            data: `${calldata}${dataSuffix ? dataSuffix.replace('0x', '') : ''}`,
            to: address,
            ...callRequest,
            account,
        });
        const result = decodeFunctionResult({
            abi,
            args,
            functionName,
            data: data || '0x',
        });
        const minimizedAbi = abi.filter((abiItem) => 'name' in abiItem && abiItem.name === parameters.functionName);
        return {
            result,
            request: {
                abi: minimizedAbi,
                address,
                args,
                dataSuffix,
                functionName,
                ...callRequest,
                account,
            },
        };
    }
    catch (error) {
        throw getContractError(error, {
            abi,
            address,
            args,
            docsPath: '/docs/contract/simulateContract',
            functionName,
            sender: account?.address,
        });
    }
}

/** @internal */
const listenersCache = /*#__PURE__*/ new Map();
/** @internal */
const cleanupCache = /*#__PURE__*/ new Map();
let callbackCount = 0;
/**
 * @description Sets up an observer for a given function. If another function
 * is set up under the same observer id, the function will only be called once
 * for both instances of the observer.
 */
function observe(observerId, callbacks, fn) {
    const callbackId = ++callbackCount;
    const getListeners = () => listenersCache.get(observerId) || [];
    const unsubscribe = () => {
        const listeners = getListeners();
        listenersCache.set(observerId, listeners.filter((cb) => cb.id !== callbackId));
    };
    const unwatch = () => {
        const listeners = getListeners();
        if (!listeners.some((cb) => cb.id === callbackId))
            return;
        const cleanup = cleanupCache.get(observerId);
        if (listeners.length === 1 && cleanup) {
            const p = cleanup();
            if (p instanceof Promise)
                p.catch(() => { });
        }
        unsubscribe();
    };
    const listeners = getListeners();
    listenersCache.set(observerId, [
        ...listeners,
        { id: callbackId, fns: callbacks },
    ]);
    if (listeners && listeners.length > 0)
        return unwatch;
    const emit = {};
    for (const key in callbacks) {
        emit[key] = ((...args) => {
            const listeners = getListeners();
            if (listeners.length === 0)
                return;
            for (const listener of listeners)
                listener.fns[key]?.(...args);
        });
    }
    const cleanup = fn(emit);
    if (typeof cleanup === 'function')
        cleanupCache.set(observerId, cleanup);
    return unwatch;
}

async function wait(time) {
    return new Promise((res) => setTimeout(res, time));
}

/**
 * @description Polls a function at a specified interval.
 */
function poll(fn, { emitOnBegin, initialWaitTime, interval }) {
    let active = true;
    const unwatch = () => (active = false);
    const watch = async () => {
        let data;
        if (emitOnBegin)
            data = await fn({ unpoll: unwatch });
        const initialWait = (await initialWaitTime?.(data)) ?? interval;
        await wait(initialWait);
        const poll = async () => {
            if (!active)
                return;
            await fn({ unpoll: unwatch });
            await wait(interval);
            poll();
        };
        poll();
    };
    watch();
    return unwatch;
}

/** @internal */
const promiseCache$1 = /*#__PURE__*/ new Map();
/** @internal */
const responseCache = /*#__PURE__*/ new Map();
function getCache(cacheKey) {
    const buildCache = (cacheKey, cache) => ({
        clear: () => cache.delete(cacheKey),
        get: () => cache.get(cacheKey),
        set: (data) => cache.set(cacheKey, data),
    });
    const promise = buildCache(cacheKey, promiseCache$1);
    const response = buildCache(cacheKey, responseCache);
    return {
        clear: () => {
            promise.clear();
            response.clear();
        },
        promise,
        response,
    };
}
/**
 * @description Returns the result of a given promise, and caches the result for
 * subsequent invocations against a provided cache key.
 */
async function withCache(fn, { cacheKey, cacheTime = Number.POSITIVE_INFINITY }) {
    const cache = getCache(cacheKey);
    // If a response exists in the cache, and it's not expired, return it
    // and do not invoke the promise.
    // If the max age is 0, the cache is disabled.
    const response = cache.response.get();
    if (response && cacheTime > 0) {
        const age = Date.now() - response.created.getTime();
        if (age < cacheTime)
            return response.data;
    }
    let promise = cache.promise.get();
    if (!promise) {
        promise = fn();
        // Store the promise in the cache so that subsequent invocations
        // will wait for the same promise to resolve (deduping).
        cache.promise.set(promise);
    }
    try {
        const data = await promise;
        // Store the response in the cache so that subsequent invocations
        // will return the same response.
        cache.response.set({ created: new Date(), data });
        return data;
    }
    finally {
        // Clear the promise cache so that subsequent invocations will
        // invoke the promise again.
        cache.promise.clear();
    }
}

const cacheKey = (id) => `blockNumber.${id}`;
/**
 * Returns the number of the most recent block seen.
 *
 * - Docs: https://viem.sh/docs/actions/public/getBlockNumber
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_fetching-blocks
 * - JSON-RPC Methods: [`eth_blockNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blocknumber)
 *
 * @param client - Client to use
 * @param parameters - {@link GetBlockNumberParameters}
 * @returns The number of the block. {@link GetBlockNumberReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getBlockNumber } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const blockNumber = await getBlockNumber(client)
 * // 69420n
 */
async function getBlockNumber(client, { cacheTime = client.cacheTime } = {}) {
    const blockNumberHex = await withCache(() => client.request({
        method: 'eth_blockNumber',
    }), { cacheKey: cacheKey(client.uid), cacheTime });
    return BigInt(blockNumberHex);
}

/**
 * Returns a list of logs or hashes based on a [Filter](/docs/glossary/terms#filter) since the last time it was called.
 *
 * - Docs: https://viem.sh/docs/actions/public/getFilterChanges
 * - JSON-RPC Methods: [`eth_getFilterChanges`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getfilterchanges)
 *
 * A Filter can be created from the following actions:
 *
 * - [`createBlockFilter`](https://viem.sh/docs/actions/public/createBlockFilter)
 * - [`createContractEventFilter`](https://viem.sh/docs/contract/createContractEventFilter)
 * - [`createEventFilter`](https://viem.sh/docs/actions/public/createEventFilter)
 * - [`createPendingTransactionFilter`](https://viem.sh/docs/actions/public/createPendingTransactionFilter)
 *
 * Depending on the type of filter, the return value will be different:
 *
 * - If the filter was created with `createContractEventFilter` or `createEventFilter`, it returns a list of logs.
 * - If the filter was created with `createPendingTransactionFilter`, it returns a list of transaction hashes.
 * - If the filter was created with `createBlockFilter`, it returns a list of block hashes.
 *
 * @param client - Client to use
 * @param parameters - {@link GetFilterChangesParameters}
 * @returns Logs or hashes. {@link GetFilterChangesReturnType}
 *
 * @example
 * // Blocks
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createBlockFilter, getFilterChanges } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const filter = await createBlockFilter(client)
 * const hashes = await getFilterChanges(client, { filter })
 *
 * @example
 * // Contract Events
 * import { createPublicClient, http, parseAbi } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createContractEventFilter, getFilterChanges } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const filter = await createContractEventFilter(client, {
 *   address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
 *   abi: parseAbi(['event Transfer(address indexed, address indexed, uint256)']),
 *   eventName: 'Transfer',
 * })
 * const logs = await getFilterChanges(client, { filter })
 *
 * @example
 * // Raw Events
 * import { createPublicClient, http, parseAbiItem } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createEventFilter, getFilterChanges } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const filter = await createEventFilter(client, {
 *   address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
 *   event: parseAbiItem('event Transfer(address indexed, address indexed, uint256)'),
 * })
 * const logs = await getFilterChanges(client, { filter })
 *
 * @example
 * // Transactions
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createPendingTransactionFilter, getFilterChanges } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const filter = await createPendingTransactionFilter(client)
 * const hashes = await getFilterChanges(client, { filter })
 */
async function getFilterChanges(_client, { filter, }) {
    const strict = 'strict' in filter && filter.strict;
    const logs = await filter.request({
        method: 'eth_getFilterChanges',
        params: [filter.id],
    });
    if (typeof logs[0] === 'string')
        return logs;
    const formattedLogs = logs.map((log) => formatLog(log));
    if (!('abi' in filter) || !filter.abi)
        return formattedLogs;
    return parseEventLogs({
        abi: filter.abi,
        logs: formattedLogs,
        strict,
    });
}

/**
 * Destroys a [`Filter`](https://viem.sh/docs/glossary/types#filter).
 *
 * - Docs: https://viem.sh/docs/actions/public/uninstallFilter
 * - JSON-RPC Methods: [`eth_uninstallFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_uninstallFilter)
 *
 * Destroys a Filter that was created from one of the following Actions:
 * - [`createBlockFilter`](https://viem.sh/docs/actions/public/createBlockFilter)
 * - [`createEventFilter`](https://viem.sh/docs/actions/public/createEventFilter)
 * - [`createPendingTransactionFilter`](https://viem.sh/docs/actions/public/createPendingTransactionFilter)
 *
 * @param client - Client to use
 * @param parameters - {@link UninstallFilterParameters}
 * @returns A boolean indicating if the Filter was successfully uninstalled. {@link UninstallFilterReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createPendingTransactionFilter, uninstallFilter } from 'viem/public'
 *
 * const filter = await createPendingTransactionFilter(client)
 * const uninstalled = await uninstallFilter(client, { filter })
 * // true
 */
async function uninstallFilter(_client, { filter }) {
    return filter.request({
        method: 'eth_uninstallFilter',
        params: [filter.id],
    });
}

/**
 * Watches and returns emitted contract event logs.
 *
 * - Docs: https://viem.sh/docs/contract/watchContractEvent
 *
 * This Action will batch up all the event logs found within the [`pollingInterval`](https://viem.sh/docs/contract/watchContractEvent#pollinginterval-optional), and invoke them via [`onLogs`](https://viem.sh/docs/contract/watchContractEvent#onLogs).
 *
 * `watchContractEvent` will attempt to create an [Event Filter](https://viem.sh/docs/contract/createContractEventFilter) and listen to changes to the Filter per polling interval, however, if the RPC Provider does not support Filters (e.g. `eth_newFilter`), then `watchContractEvent` will fall back to using [`getLogs`](https://viem.sh/docs/actions/public/getLogs) instead.
 *
 * @param client - Client to use
 * @param parameters - {@link WatchContractEventParameters}
 * @returns A function that can be invoked to stop watching for new event logs. {@link WatchContractEventReturnType}
 *
 * @example
 * import { createPublicClient, http, parseAbi } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { watchContractEvent } from 'viem/contract'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const unwatch = watchContractEvent(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *   abi: parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']),
 *   eventName: 'Transfer',
 *   args: { from: '0xc961145a54C96E3aE9bAA048c4F4D6b04C13916b' },
 *   onLogs: (logs) => console.log(logs),
 * })
 */
function watchContractEvent(client, parameters) {
    const { abi, address, args, batch = true, eventName, fromBlock, onError, onLogs, poll: poll_, pollingInterval = client.pollingInterval, strict: strict_, } = parameters;
    const enablePolling = (() => {
        if (typeof poll_ !== 'undefined')
            return poll_;
        if (typeof fromBlock === 'bigint')
            return true;
        if (client.transport.type === 'webSocket' ||
            client.transport.type === 'ipc')
            return false;
        if (client.transport.type === 'fallback' &&
            (client.transport.transports[0].config.type === 'webSocket' ||
                client.transport.transports[0].config.type === 'ipc'))
            return false;
        return true;
    })();
    const pollContractEvent = () => {
        const strict = strict_ ?? false;
        const observerId = stringify$1([
            'watchContractEvent',
            address,
            args,
            batch,
            client.uid,
            eventName,
            pollingInterval,
            strict,
            fromBlock,
        ]);
        return observe(observerId, { onLogs, onError }, (emit) => {
            let previousBlockNumber;
            if (fromBlock !== undefined)
                previousBlockNumber = fromBlock - 1n;
            let filter;
            let initialized = false;
            const unwatch = poll(async () => {
                if (!initialized) {
                    try {
                        filter = (await getAction(client, createContractEventFilter, 'createContractEventFilter')({
                            abi,
                            address,
                            args: args,
                            eventName: eventName,
                            strict: strict,
                            fromBlock,
                        }));
                    }
                    catch { }
                    initialized = true;
                    return;
                }
                try {
                    let logs;
                    if (filter) {
                        logs = await getAction(client, getFilterChanges, 'getFilterChanges')({ filter });
                    }
                    else {
                        // If the filter doesn't exist, we will fall back to use `getLogs`.
                        // The fall back exists because some RPC Providers do not support filters.
                        // Fetch the block number to use for `getLogs`.
                        const blockNumber = await getAction(client, getBlockNumber, 'getBlockNumber')({});
                        // If the block number has changed, we will need to fetch the logs.
                        // If the block number doesn't exist, we are yet to reach the first poll interval,
                        // so do not emit any logs.
                        if (previousBlockNumber && previousBlockNumber < blockNumber) {
                            logs = await getAction(client, getContractEvents, 'getContractEvents')({
                                abi,
                                address,
                                args,
                                eventName,
                                fromBlock: previousBlockNumber + 1n,
                                toBlock: blockNumber,
                                strict,
                            });
                        }
                        else {
                            logs = [];
                        }
                        previousBlockNumber = blockNumber;
                    }
                    if (logs.length === 0)
                        return;
                    if (batch)
                        emit.onLogs(logs);
                    else
                        for (const log of logs)
                            emit.onLogs([log]);
                }
                catch (err) {
                    // If a filter has been set and gets uninstalled, providers will throw an InvalidInput error.
                    // Reinitialize the filter when this occurs
                    if (filter && err instanceof InvalidInputRpcError)
                        initialized = false;
                    emit.onError?.(err);
                }
            }, {
                emitOnBegin: true,
                interval: pollingInterval,
            });
            return async () => {
                if (filter)
                    await getAction(client, uninstallFilter, 'uninstallFilter')({ filter });
                unwatch();
            };
        });
    };
    const subscribeContractEvent = () => {
        const strict = strict_ ?? false;
        const observerId = stringify$1([
            'watchContractEvent',
            address,
            args,
            batch,
            client.uid,
            eventName,
            pollingInterval,
            strict,
        ]);
        let active = true;
        let unsubscribe = () => (active = false);
        return observe(observerId, { onLogs, onError }, (emit) => {
            (async () => {
                try {
                    const transport = (() => {
                        if (client.transport.type === 'fallback') {
                            const transport = client.transport.transports.find((transport) => transport.config.type === 'webSocket' ||
                                transport.config.type === 'ipc');
                            if (!transport)
                                return client.transport;
                            return transport.value;
                        }
                        return client.transport;
                    })();
                    const topics = eventName
                        ? encodeEventTopics({
                            abi: abi,
                            eventName: eventName,
                            args,
                        })
                        : [];
                    const { unsubscribe: unsubscribe_ } = await transport.subscribe({
                        params: ['logs', { address, topics }],
                        onData(data) {
                            if (!active)
                                return;
                            const log = data.result;
                            try {
                                const { eventName, args } = decodeEventLog({
                                    abi: abi,
                                    data: log.data,
                                    topics: log.topics,
                                    strict: strict_,
                                });
                                const formatted = formatLog(log, {
                                    args,
                                    eventName: eventName,
                                });
                                emit.onLogs([formatted]);
                            }
                            catch (err) {
                                let eventName;
                                let isUnnamed;
                                if (err instanceof DecodeLogDataMismatch ||
                                    err instanceof DecodeLogTopicsMismatch) {
                                    // If strict mode is on, and log data/topics do not match event definition, skip.
                                    if (strict_)
                                        return;
                                    eventName = err.abiItem.name;
                                    isUnnamed = err.abiItem.inputs?.some((x) => !('name' in x && x.name));
                                }
                                // Set args to empty if there is an error decoding (e.g. indexed/non-indexed params mismatch).
                                const formatted = formatLog(log, {
                                    args: isUnnamed ? [] : {},
                                    eventName,
                                });
                                emit.onLogs([formatted]);
                            }
                        },
                        onError(error) {
                            emit.onError?.(error);
                        },
                    });
                    unsubscribe = unsubscribe_;
                    if (!active)
                        unsubscribe();
                }
                catch (err) {
                    onError?.(err);
                }
            })();
            return () => unsubscribe();
        });
    };
    return enablePolling ? pollContractEvent() : subscribeContractEvent();
}

class AccountNotFoundError extends BaseError$1 {
    constructor({ docsPath } = {}) {
        super([
            'Could not find an Account to execute with this Action.',
            'Please provide an Account with the `account` argument on the Action, or by supplying an `account` to the Client.',
        ].join('\n'), {
            docsPath,
            docsSlug: 'account',
            name: 'AccountNotFoundError',
        });
    }
}
class AccountTypeNotSupportedError extends BaseError$1 {
    constructor({ docsPath, metaMessages, type, }) {
        super(`Account type "${type}" is not supported.`, {
            docsPath,
            metaMessages,
            name: 'AccountTypeNotSupportedError',
        });
    }
}

function assertCurrentChain({ chain, currentChainId, }) {
    if (!chain)
        throw new ChainNotFoundError();
    if (currentChainId !== chain.id)
        throw new ChainMismatchError({ chain, currentChainId });
}

/**
 * Sends a **signed** transaction to the network
 *
 * - Docs: https://viem.sh/docs/actions/wallet/sendRawTransaction
 * - JSON-RPC Method: [`eth_sendRawTransaction`](https://ethereum.github.io/execution-apis/api-documentation/)
 *
 * @param client - Client to use
 * @param parameters - {@link SendRawTransactionParameters}
 * @returns The transaction hash. {@link SendRawTransactionReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { sendRawTransaction } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 *
 * const hash = await sendRawTransaction(client, {
 *   serializedTransaction: '0x02f850018203118080825208808080c080a04012522854168b27e5dc3d5839bab5e6b39e1a0ffd343901ce1622e3d64b48f1a04e00902ae0502c4728cbf12156290df99c3ed7de85b1dbfe20b5c36931733a33'
 * })
 */
async function sendRawTransaction(client, { serializedTransaction }) {
    return client.request({
        method: 'eth_sendRawTransaction',
        params: [serializedTransaction],
    }, { retryCount: 0 });
}

const supportsWalletNamespace$1 = new LruMap$1(128);
/**
 * Creates, signs, and sends a new transaction to the network.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/sendTransaction
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_sending-transactions
 * - JSON-RPC Methods:
 *   - JSON-RPC Accounts: [`eth_sendTransaction`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendtransaction)
 *   - Local Accounts: [`eth_sendRawTransaction`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendrawtransaction)
 *
 * @param client - Client to use
 * @param parameters - {@link SendTransactionParameters}
 * @returns The [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash. {@link SendTransactionReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { sendTransaction } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const hash = await sendTransaction(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *   value: 1000000000000000000n,
 * })
 *
 * @example
 * // Account Hoisting
 * import { createWalletClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet } from 'viem/chains'
 * import { sendTransaction } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const hash = await sendTransaction(client, {
 *   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *   value: 1000000000000000000n,
 * })
 */
async function sendTransaction(client, parameters) {
    const { account: account_ = client.account, assertChainId = true, chain = client.chain, accessList, authorizationList, blobs, data, dataSuffix = typeof client.dataSuffix === 'string'
        ? client.dataSuffix
        : client.dataSuffix?.value, gas, gasPrice, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, nonce, type, value, ...rest } = parameters;
    if (typeof account_ === 'undefined')
        throw new AccountNotFoundError({
            docsPath: '/docs/actions/wallet/sendTransaction',
        });
    const account = account_ ? parseAccount(account_) : null;
    try {
        assertRequest(parameters);
        const to = await (async () => {
            // If `to` exists on the parameters, use that.
            if (parameters.to)
                return parameters.to;
            // If `to` is null, we are sending a deployment transaction.
            if (parameters.to === null)
                return undefined;
            // If no `to` exists, and we are sending a EIP-7702 transaction, use the
            // address of the first authorization in the list.
            if (authorizationList && authorizationList.length > 0)
                return await recoverAuthorizationAddress({
                    authorization: authorizationList[0],
                }).catch(() => {
                    throw new BaseError$1('`to` is required. Could not infer from `authorizationList`.');
                });
            // Otherwise, we are sending a deployment transaction.
            return undefined;
        })();
        if (account?.type === 'json-rpc' || account === null) {
            let chainId;
            if (chain !== null) {
                chainId = await getAction(client, getChainId, 'getChainId')({});
                if (assertChainId)
                    assertCurrentChain({
                        currentChainId: chainId,
                        chain,
                    });
            }
            const chainFormat = client.chain?.formatters?.transactionRequest?.format;
            const format = chainFormat || formatTransactionRequest;
            const request = format({
                // Pick out extra data that might exist on the chain's transaction request type.
                ...extract$1(rest, { format: chainFormat }),
                accessList,
                account,
                authorizationList,
                blobs,
                chainId,
                data: data ? concat$1([data, dataSuffix ?? '0x']) : data,
                gas,
                gasPrice,
                maxFeePerBlobGas,
                maxFeePerGas,
                maxPriorityFeePerGas,
                nonce,
                to,
                type,
                value,
            }, 'sendTransaction');
            const isWalletNamespaceSupported = supportsWalletNamespace$1.get(client.uid);
            const method = isWalletNamespaceSupported
                ? 'wallet_sendTransaction'
                : 'eth_sendTransaction';
            try {
                return await client.request({
                    method,
                    params: [request],
                }, { retryCount: 0 });
            }
            catch (e) {
                if (isWalletNamespaceSupported === false)
                    throw e;
                const error = e;
                // If the transport does not support the method or input, attempt to use the
                // `wallet_sendTransaction` method.
                if (error.name === 'InvalidInputRpcError' ||
                    error.name === 'InvalidParamsRpcError' ||
                    error.name === 'MethodNotFoundRpcError' ||
                    error.name === 'MethodNotSupportedRpcError') {
                    return await client
                        .request({
                        method: 'wallet_sendTransaction',
                        params: [request],
                    }, { retryCount: 0 })
                        .then((hash) => {
                        supportsWalletNamespace$1.set(client.uid, true);
                        return hash;
                    })
                        .catch((e) => {
                        const walletNamespaceError = e;
                        if (walletNamespaceError.name === 'MethodNotFoundRpcError' ||
                            walletNamespaceError.name === 'MethodNotSupportedRpcError') {
                            supportsWalletNamespace$1.set(client.uid, false);
                            throw error;
                        }
                        throw walletNamespaceError;
                    });
                }
                throw error;
            }
        }
        if (account?.type === 'local') {
            // Prepare the request for signing (assign appropriate fees, etc.)
            const request = await getAction(client, prepareTransactionRequest, 'prepareTransactionRequest')({
                account,
                accessList,
                authorizationList,
                blobs,
                chain,
                data: data ? concat$1([data, dataSuffix ?? '0x']) : data,
                gas,
                gasPrice,
                maxFeePerBlobGas,
                maxFeePerGas,
                maxPriorityFeePerGas,
                nonce,
                nonceManager: account.nonceManager,
                parameters: [...defaultParameters, 'sidecars'],
                type,
                value,
                ...rest,
                to,
            });
            const serializer = chain?.serializers?.transaction;
            const serializedTransaction = (await account.signTransaction(request, {
                serializer,
            }));
            return await getAction(client, sendRawTransaction, 'sendRawTransaction')({
                serializedTransaction,
            });
        }
        if (account?.type === 'smart')
            throw new AccountTypeNotSupportedError({
                metaMessages: [
                    'Consider using the `sendUserOperation` Action instead.',
                ],
                docsPath: '/docs/actions/bundler/sendUserOperation',
                type: 'smart',
            });
        throw new AccountTypeNotSupportedError({
            docsPath: '/docs/actions/wallet/sendTransaction',
            type: account?.type,
        });
    }
    catch (err) {
        if (err instanceof AccountTypeNotSupportedError)
            throw err;
        throw getTransactionError(err, {
            ...parameters,
            account,
            chain: parameters.chain || undefined,
        });
    }
}

/**
 * Executes a write function on a contract.
 *
 * - Docs: https://viem.sh/docs/contract/writeContract
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts_writing-to-contracts
 *
 * A "write" function on a Solidity contract modifies the state of the blockchain. These types of functions require gas to be executed, and hence a [Transaction](https://viem.sh/docs/glossary/terms) is needed to be broadcast in order to change the state.
 *
 * Internally, uses a [Wallet Client](https://viem.sh/docs/clients/wallet) to call the [`sendTransaction` action](https://viem.sh/docs/actions/wallet/sendTransaction) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).
 *
 * __Warning: The `write` internally sends a transaction – it does not validate if the contract write will succeed (the contract may throw an error). It is highly recommended to [simulate the contract write with `contract.simulate`](https://viem.sh/docs/contract/writeContract#usage) before you execute it.__
 *
 * @param client - Client to use
 * @param parameters - {@link WriteContractParameters}
 * @returns A [Transaction Hash](https://viem.sh/docs/glossary/terms#hash). {@link WriteContractReturnType}
 *
 * @example
 * import { createWalletClient, custom, parseAbi } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { writeContract } from 'viem/contract'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const hash = await writeContract(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *   abi: parseAbi(['function mint(uint32 tokenId) nonpayable']),
 *   functionName: 'mint',
 *   args: [69420],
 * })
 *
 * @example
 * // With Validation
 * import { createWalletClient, http, parseAbi } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { simulateContract, writeContract } from 'viem/contract'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const { request } = await simulateContract(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *   abi: parseAbi(['function mint(uint32 tokenId) nonpayable']),
 *   functionName: 'mint',
 *   args: [69420],
 * }
 * const hash = await writeContract(client, request)
 */
async function writeContract(client, parameters) {
    return writeContract.internal(client, sendTransaction, 'sendTransaction', parameters);
}
(function (writeContract) {
    async function internal(client, actionFn, name, parameters) {
        const { abi, account: account_ = client.account, address, args, functionName, ...request } = parameters;
        if (typeof account_ === 'undefined')
            throw new AccountNotFoundError({
                docsPath: '/docs/contract/writeContract',
            });
        const account = account_ ? parseAccount(account_) : null;
        const data = encodeFunctionData({
            abi,
            args,
            functionName,
        });
        try {
            return await getAction(client, actionFn, name)({
                data,
                to: address,
                account,
                ...request,
            });
        }
        catch (error) {
            throw getContractError(error, {
                abi,
                address,
                args,
                docsPath: '/docs/contract/writeContract',
                functionName,
                sender: account?.address,
            });
        }
    }
    writeContract.internal = internal;
})(writeContract || (writeContract = {}));

class BundleFailedError extends BaseError$1 {
    constructor(result) {
        super(`Call bundle failed with status: ${result.statusCode}`, {
            name: 'BundleFailedError',
        });
        Object.defineProperty(this, "result", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.result = result;
    }
}

function withRetry(fn, { delay: delay_ = 100, retryCount = 2, shouldRetry = () => true, } = {}) {
    return new Promise((resolve, reject) => {
        const attemptRetry = async ({ count = 0 } = {}) => {
            const retry = async ({ error }) => {
                const delay = typeof delay_ === 'function' ? delay_({ count, error }) : delay_;
                if (delay)
                    await wait(delay);
                attemptRetry({ count: count + 1 });
            };
            try {
                const data = await fn();
                resolve(data);
            }
            catch (err) {
                if (count < retryCount &&
                    (await shouldRetry({ count, error: err })))
                    return retry({ error: err });
                reject(err);
            }
        };
        attemptRetry();
    });
}

const receiptStatuses = {
    '0x0': 'reverted',
    '0x1': 'success',
};
function formatTransactionReceipt(transactionReceipt, _) {
    const receipt = {
        ...transactionReceipt,
        blockNumber: transactionReceipt.blockNumber
            ? BigInt(transactionReceipt.blockNumber)
            : null,
        contractAddress: transactionReceipt.contractAddress
            ? transactionReceipt.contractAddress
            : null,
        cumulativeGasUsed: transactionReceipt.cumulativeGasUsed
            ? BigInt(transactionReceipt.cumulativeGasUsed)
            : null,
        effectiveGasPrice: transactionReceipt.effectiveGasPrice
            ? BigInt(transactionReceipt.effectiveGasPrice)
            : null,
        gasUsed: transactionReceipt.gasUsed
            ? BigInt(transactionReceipt.gasUsed)
            : null,
        logs: transactionReceipt.logs
            ? transactionReceipt.logs.map((log) => formatLog(log))
            : null,
        to: transactionReceipt.to ? transactionReceipt.to : null,
        transactionIndex: transactionReceipt.transactionIndex
            ? hexToNumber$1(transactionReceipt.transactionIndex)
            : null,
        status: transactionReceipt.status
            ? receiptStatuses[transactionReceipt.status]
            : null,
        type: transactionReceipt.type
            ? transactionType[transactionReceipt.type] || transactionReceipt.type
            : null,
    };
    if (transactionReceipt.blobGasPrice)
        receipt.blobGasPrice = BigInt(transactionReceipt.blobGasPrice);
    if (transactionReceipt.blobGasUsed)
        receipt.blobGasUsed = BigInt(transactionReceipt.blobGasUsed);
    return receipt;
}

const fallbackMagicIdentifier = '0x5792579257925792579257925792579257925792579257925792579257925792';
const fallbackTransactionErrorMagicIdentifier = numberToHex(0, {
    size: 32,
});
/**
 * Requests the connected wallet to send a batch of calls.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/sendCalls
 * - JSON-RPC Methods: [`wallet_sendCalls`](https://eips.ethereum.org/EIPS/eip-5792)
 *
 * @param client - Client to use
 * @returns Transaction identifier. {@link SendCallsReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { sendCalls } from 'viem/actions'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const id = await sendCalls(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   calls: [
 *     {
 *       data: '0xdeadbeef',
 *       to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *     },
 *     {
 *       to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *       value: 69420n,
 *     },
 *   ],
 * })
 */
async function sendCalls(client, parameters) {
    const { account: account_ = client.account, chain = client.chain, experimental_fallback, experimental_fallbackDelay = 32, forceAtomic = false, id, version = '2.0.0', } = parameters;
    const account = account_ ? parseAccount(account_) : null;
    let capabilities = parameters.capabilities;
    if (client.dataSuffix && !parameters.capabilities?.dataSuffix) {
        if (typeof client.dataSuffix === 'string')
            capabilities = {
                ...parameters.capabilities,
                dataSuffix: { value: client.dataSuffix, optional: true },
            };
        else
            capabilities = {
                ...parameters.capabilities,
                dataSuffix: {
                    value: client.dataSuffix.value,
                    ...(client.dataSuffix.required ? {} : { optional: true }),
                },
            };
    }
    const calls = parameters.calls.map((call_) => {
        const call = call_;
        const data = call.abi
            ? encodeFunctionData({
                abi: call.abi,
                functionName: call.functionName,
                args: call.args,
            })
            : call.data;
        return {
            data: call.dataSuffix && data ? concat$1([data, call.dataSuffix]) : data,
            to: call.to,
            value: call.value ? numberToHex(call.value) : undefined,
        };
    });
    try {
        const response = await client.request({
            method: 'wallet_sendCalls',
            params: [
                {
                    atomicRequired: forceAtomic,
                    calls,
                    capabilities,
                    chainId: numberToHex(chain.id),
                    from: account?.address,
                    id,
                    version,
                },
            ],
        }, { retryCount: 0 });
        if (typeof response === 'string')
            return { id: response };
        return response;
    }
    catch (err) {
        const error = err;
        // If the transport does not support EIP-5792, fall back to
        // `eth_sendTransaction`.
        if (experimental_fallback &&
            (error.name === 'MethodNotFoundRpcError' ||
                error.name === 'MethodNotSupportedRpcError' ||
                error.name === 'UnknownRpcError' ||
                error.details
                    .toLowerCase()
                    .includes('does not exist / is not available') ||
                error.details.toLowerCase().includes('missing or invalid. request()') ||
                error.details
                    .toLowerCase()
                    .includes('did not match any variant of untagged enum') ||
                error.details
                    .toLowerCase()
                    .includes('account upgraded to unsupported contract') ||
                error.details.toLowerCase().includes('eip-7702 not supported') ||
                error.details.toLowerCase().includes('unsupported wc_ method') ||
                // magic.link
                error.details
                    .toLowerCase()
                    .includes('feature toggled misconfigured') ||
                // Trust Wallet
                error.details
                    .toLowerCase()
                    .includes('jsonrpcengine: response has no error or result for request'))) {
            if (capabilities) {
                const hasNonOptionalCapability = Object.values(capabilities).some((capability) => !capability.optional);
                if (hasNonOptionalCapability) {
                    const message = 'non-optional `capabilities` are not supported on fallback to `eth_sendTransaction`.';
                    throw new UnsupportedNonOptionalCapabilityError(new BaseError$1(message, {
                        details: message,
                    }));
                }
            }
            if (forceAtomic && calls.length > 1) {
                const message = '`forceAtomic` is not supported on fallback to `eth_sendTransaction`.';
                throw new AtomicityNotSupportedError(new BaseError$1(message, {
                    details: message,
                }));
            }
            const promises = [];
            for (const call of calls) {
                const promise = sendTransaction(client, {
                    account,
                    chain,
                    data: call.data,
                    to: call.to,
                    value: call.value ? hexToBigInt(call.value) : undefined,
                });
                promises.push(promise);
                // Note: some browser wallets require a small delay between transactions
                // to prevent duplicate JSON-RPC requests.
                if (experimental_fallbackDelay > 0)
                    await new Promise((resolve) => setTimeout(resolve, experimental_fallbackDelay));
            }
            const results = await Promise.allSettled(promises);
            if (results.every((r) => r.status === 'rejected'))
                throw results[0].reason;
            const hashes = results.map((result) => {
                if (result.status === 'fulfilled')
                    return result.value;
                return fallbackTransactionErrorMagicIdentifier;
            });
            return {
                id: concat$1([
                    ...hashes,
                    numberToHex(chain.id, { size: 32 }),
                    fallbackMagicIdentifier,
                ]),
            };
        }
        throw getTransactionError(err, {
            ...parameters,
            account,
            chain: parameters.chain,
        });
    }
}

/**
 * Returns the status of a call batch that was sent via `sendCalls`.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/getCallsStatus
 * - JSON-RPC Methods: [`wallet_getCallsStatus`](https://eips.ethereum.org/EIPS/eip-5792)
 *
 * @param client - Client to use
 * @returns Status of the calls. {@link GetCallsStatusReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getCallsStatus } from 'viem/actions'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const { receipts, status } = await getCallsStatus(client, { id: '0xdeadbeef' })
 */
async function getCallsStatus(client, parameters) {
    async function getStatus(id) {
        const isTransactions = id.endsWith(fallbackMagicIdentifier.slice(2));
        if (isTransactions) {
            const chainId = trim$1(sliceHex(id, -64, -32));
            const hashes = sliceHex(id, 0, -64)
                .slice(2)
                .match(/.{1,64}/g);
            const receipts = await Promise.all(hashes.map((hash) => fallbackTransactionErrorMagicIdentifier.slice(2) !== hash
                ? client.request({
                    method: 'eth_getTransactionReceipt',
                    params: [`0x${hash}`],
                }, { dedupe: true })
                : undefined));
            const status = (() => {
                if (receipts.some((r) => r === null))
                    return 100; // pending
                if (receipts.every((r) => r?.status === '0x1'))
                    return 200; // success
                if (receipts.every((r) => r?.status === '0x0'))
                    return 500; // complete failure
                return 600; // partial failure
            })();
            return {
                atomic: false,
                chainId: hexToNumber$1(chainId),
                receipts: receipts.filter(Boolean),
                status,
                version: '2.0.0',
            };
        }
        return client.request({
            method: 'wallet_getCallsStatus',
            params: [id],
        });
    }
    const { atomic = false, chainId, receipts, version = '2.0.0', ...response } = await getStatus(parameters.id);
    const [status, statusCode] = (() => {
        const statusCode = response.status;
        if (statusCode >= 100 && statusCode < 200)
            return ['pending', statusCode];
        if (statusCode >= 200 && statusCode < 300)
            return ['success', statusCode];
        if (statusCode >= 300 && statusCode < 700)
            return ['failure', statusCode];
        // @ts-expect-error: for backwards compatibility
        if (statusCode === 'CONFIRMED')
            return ['success', 200];
        // @ts-expect-error: for backwards compatibility
        if (statusCode === 'PENDING')
            return ['pending', 100];
        return [undefined, statusCode];
    })();
    return {
        ...response,
        atomic,
        // @ts-expect-error: for backwards compatibility
        chainId: chainId ? hexToNumber$1(chainId) : undefined,
        receipts: receipts?.map((receipt) => ({
            ...receipt,
            blockNumber: hexToBigInt(receipt.blockNumber),
            gasUsed: hexToBigInt(receipt.gasUsed),
            status: receiptStatuses[receipt.status],
        })) ?? [],
        statusCode,
        status,
        version,
    };
}

/**
 * Waits for the status & receipts of a call bundle that was sent via `sendCalls`.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/waitForCallsStatus
 * - JSON-RPC Methods: [`wallet_getCallsStatus`](https://eips.ethereum.org/EIPS/eip-5792)
 *
 * @param client - Client to use
 * @param parameters - {@link WaitForCallsStatusParameters}
 * @returns Status & receipts of the call bundle. {@link WaitForCallsStatusReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { waitForCallsStatus } from 'viem/actions'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 *
 * const { receipts, status } = await waitForCallsStatus(client, { id: '0xdeadbeef' })
 */
async function waitForCallsStatus(client, parameters) {
    const { id, pollingInterval = client.pollingInterval, status = ({ statusCode }) => statusCode === 200 || statusCode >= 300, retryCount = 4, retryDelay = ({ count }) => ~~(1 << count) * 200, // exponential backoff
    timeout = 60_000, throwOnFailure = false, } = parameters;
    const observerId = stringify$1(['waitForCallsStatus', client.uid, id]);
    const { promise, resolve, reject } = withResolvers();
    let timer;
    const unobserve = observe(observerId, { resolve, reject }, (emit) => {
        const unpoll = poll(async () => {
            const done = (fn) => {
                clearTimeout(timer);
                unpoll();
                fn();
                unobserve();
            };
            try {
                const result = await withRetry(async () => {
                    const result = await getAction(client, getCallsStatus, 'getCallsStatus')({ id });
                    if (throwOnFailure && result.status === 'failure')
                        throw new BundleFailedError(result);
                    return result;
                }, {
                    retryCount,
                    delay: retryDelay,
                });
                if (!status(result))
                    return;
                done(() => emit.resolve(result));
            }
            catch (error) {
                done(() => emit.reject(error));
            }
        }, {
            interval: pollingInterval,
            emitOnBegin: true,
        });
        return unpoll;
    });
    timer = timeout
        ? setTimeout(() => {
            unobserve();
            clearTimeout(timer);
            reject(new WaitForCallsStatusTimeoutError({ id }));
        }, timeout)
        : undefined;
    return await promise;
}
class WaitForCallsStatusTimeoutError extends BaseError$1 {
    constructor({ id }) {
        super(`Timed out while waiting for call bundle with id "${id}" to be confirmed.`, { name: 'WaitForCallsStatusTimeoutError' });
    }
}

const size = 256;
let index = size;
let buffer;
function uid(length = 11) {
    if (!buffer || index + length > size * 2) {
        buffer = '';
        index = 0;
        for (let i = 0; i < size; i++) {
            buffer += ((256 + Math.random() * 256) | 0).toString(16).substring(1);
        }
    }
    return buffer.substring(index, index++ + length);
}

function createClient(parameters) {
    const { batch, chain, ccipRead, dataSuffix, key = 'base', name = 'Base Client', type = 'base', } = parameters;
    const experimental_blockTag = parameters.experimental_blockTag ??
        (typeof chain?.experimental_preconfirmationTime === 'number'
            ? 'pending'
            : undefined);
    const blockTime = chain?.blockTime ?? 12_000;
    const defaultPollingInterval = Math.min(Math.max(Math.floor(blockTime / 2), 500), 4_000);
    const pollingInterval = parameters.pollingInterval ?? defaultPollingInterval;
    const cacheTime = parameters.cacheTime ?? pollingInterval;
    const account = parameters.account
        ? parseAccount(parameters.account)
        : undefined;
    const { config, request, value } = parameters.transport({
        account,
        chain,
        pollingInterval,
    });
    const transport = { ...config, ...value };
    const client = {
        account,
        batch,
        cacheTime,
        ccipRead,
        chain,
        dataSuffix,
        key,
        name,
        pollingInterval,
        request,
        transport,
        type,
        uid: uid(),
        ...(experimental_blockTag ? { experimental_blockTag } : {}),
    };
    function extend(base) {
        return (extendFn) => {
            const extended = extendFn(base);
            for (const key in client)
                delete extended[key];
            const combined = { ...base, ...extended };
            return Object.assign(combined, { extend: extend(combined) });
        };
    }
    return Object.assign(client, { extend: extend(client) });
}

/*
 * @description Checks if error is a valid null result UniversalResolver error
 */
function isNullUniversalResolverError(err) {
    if (!(err instanceof BaseError$1))
        return false;
    const cause = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (!(cause instanceof ContractFunctionRevertedError))
        return false;
    if (cause.data?.errorName === 'HttpError')
        return true;
    if (cause.data?.errorName === 'ResolverError')
        return true;
    if (cause.data?.errorName === 'ResolverNotContract')
        return true;
    if (cause.data?.errorName === 'ResolverNotFound')
        return true;
    if (cause.data?.errorName === 'ReverseAddressMismatch')
        return true;
    if (cause.data?.errorName === 'UnsupportedResolverProfile')
        return true;
    return false;
}

function decodeFunctionData(parameters) {
    const { abi, data } = parameters;
    const signature = slice$2(data, 0, 4);
    const description = abi.find((x) => x.type === 'function' &&
        signature === toFunctionSelector(formatAbiItem(x)));
    if (!description)
        throw new AbiFunctionSignatureNotFoundError(signature, {
            docsPath: '/docs/contract/decodeFunctionData',
        });
    return {
        functionName: description.name,
        args: ('inputs' in description &&
            description.inputs &&
            description.inputs.length > 0
            ? decodeAbiParameters(description.inputs, slice$2(data, 4))
            : undefined),
    };
}

const docsPath$1 = '/docs/contract/encodeErrorResult';
function encodeErrorResult(parameters) {
    const { abi, errorName, args } = parameters;
    let abiItem = abi[0];
    if (errorName) {
        const item = getAbiItem({ abi, args, name: errorName });
        if (!item)
            throw new AbiErrorNotFoundError(errorName, { docsPath: docsPath$1 });
        abiItem = item;
    }
    if (abiItem.type !== 'error')
        throw new AbiErrorNotFoundError(undefined, { docsPath: docsPath$1 });
    const definition = formatAbiItem(abiItem);
    const signature = toFunctionSelector(definition);
    let data = '0x';
    if (args && args.length > 0) {
        if (!abiItem.inputs)
            throw new AbiErrorInputsNotFoundError(abiItem.name, { docsPath: docsPath$1 });
        data = encodeAbiParameters(abiItem.inputs, args);
    }
    return concatHex([signature, data]);
}

const docsPath = '/docs/contract/encodeFunctionResult';
function encodeFunctionResult(parameters) {
    const { abi, functionName, result } = parameters;
    let abiItem = abi[0];
    if (functionName) {
        const item = getAbiItem({ abi, name: functionName });
        if (!item)
            throw new AbiFunctionNotFoundError(functionName, { docsPath });
        abiItem = item;
    }
    if (abiItem.type !== 'function')
        throw new AbiFunctionNotFoundError(undefined, { docsPath });
    if (!abiItem.outputs)
        throw new AbiFunctionOutputsNotFoundError(abiItem.name, { docsPath });
    const values = (() => {
        if (abiItem.outputs.length === 0)
            return [];
        if (abiItem.outputs.length === 1)
            return [result];
        if (Array.isArray(result))
            return result;
        throw new InvalidArrayError$1(result);
    })();
    return encodeAbiParameters(abiItem.outputs, values);
}

const localBatchGatewayUrl = 'x-batch-gateway:true';
async function localBatchGatewayRequest(parameters) {
    const { data, ccipRequest } = parameters;
    const { args: [queries], } = decodeFunctionData({ abi: batchGatewayAbi, data });
    const failures = [];
    const responses = [];
    await Promise.all(queries.map(async (query, i) => {
        try {
            responses[i] = query.urls.includes(localBatchGatewayUrl)
                ? await localBatchGatewayRequest({ data: query.data, ccipRequest })
                : await ccipRequest(query);
            failures[i] = false;
        }
        catch (err) {
            failures[i] = true;
            responses[i] = encodeError(err);
        }
    }));
    return encodeFunctionResult({
        abi: batchGatewayAbi,
        functionName: 'query',
        result: [failures, responses],
    });
}
function encodeError(error) {
    if (error.name === 'HttpRequestError' && error.status)
        return encodeErrorResult({
            abi: batchGatewayAbi,
            errorName: 'HttpError',
            args: [error.status, error.shortMessage],
        });
    return encodeErrorResult({
        abi: [solidityError],
        errorName: 'Error',
        args: ['shortMessage' in error ? error.shortMessage : error.message],
    });
}

function encodedLabelToLabelhash(label) {
    if (label.length !== 66)
        return null;
    if (label.indexOf('[') !== 0)
        return null;
    if (label.indexOf(']') !== 65)
        return null;
    const hash = `0x${label.slice(1, 65)}`;
    if (!isHex(hash))
        return null;
    return hash;
}

/**
 * @description Hashes ENS name
 *
 * - Since ENS names prohibit certain forbidden characters (e.g. underscore) and have other validation rules, you likely want to [normalize ENS names](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) with [UTS-46 normalization](https://unicode.org/reports/tr46) before passing them to `namehash`. You can use the built-in [`normalize`](https://viem.sh/docs/ens/utilities/normalize) function for this.
 *
 * @example
 * namehash('wevm.eth')
 * '0x08c85f2f4059e930c45a6aeff9dcd3bd95dc3c5c1cddef6a0626b31152248560'
 *
 * @link https://eips.ethereum.org/EIPS/eip-137
 */
function namehash(name) {
    let result = new Uint8Array(32).fill(0);
    if (!name)
        return bytesToHex$1(result);
    const labels = name.split('.');
    // Iterate in reverse order building up hash
    for (let i = labels.length - 1; i >= 0; i -= 1) {
        const hashFromEncodedLabel = encodedLabelToLabelhash(labels[i]);
        const hashed = hashFromEncodedLabel
            ? toBytes$2(hashFromEncodedLabel)
            : keccak256$1(stringToBytes(labels[i]), 'bytes');
        result = keccak256$1(concat$1([result, hashed]), 'bytes');
    }
    return bytesToHex$1(result);
}

function encodeLabelhash(hash) {
    return `[${hash.slice(2)}]`;
}

/**
 * @description Hashes ENS label
 *
 * - Since ENS labels prohibit certain forbidden characters (e.g. underscore) and have other validation rules, you likely want to [normalize ENS labels](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) with [UTS-46 normalization](https://unicode.org/reports/tr46) before passing them to `labelhash`. You can use the built-in [`normalize`](https://viem.sh/docs/ens/utilities/normalize) function for this.
 *
 * @example
 * labelhash('eth')
 * '0x4f5b812789fc606be1b3b16908db13fc7a9adf7ca72641f84d75b47069d3d7f0'
 */
function labelhash(label) {
    const result = new Uint8Array(32).fill(0);
    if (!label)
        return bytesToHex$1(result);
    return encodedLabelToLabelhash(label) || keccak256$1(stringToBytes(label));
}

/*
 * @description Encodes a DNS packet into a ByteArray containing a UDP payload.
 *
 * @example
 * packetToBytes('awkweb.eth')
 * '0x0661776b7765620365746800'
 *
 * @see https://docs.ens.domains/resolution/names#dns
 *
 */
function packetToBytes(packet) {
    // strip leading and trailing `.`
    const value = packet.replace(/^\.|\.$/gm, '');
    if (value.length === 0)
        return new Uint8Array(1);
    const bytes = new Uint8Array(stringToBytes(value).byteLength + 2);
    let offset = 0;
    const list = value.split('.');
    for (let i = 0; i < list.length; i++) {
        let encoded = stringToBytes(list[i]);
        // if the length is > 255, make the encoded label value a labelhash
        // this is compatible with the universal resolver
        if (encoded.byteLength > 255)
            encoded = stringToBytes(encodeLabelhash(labelhash(list[i])));
        bytes[offset] = encoded.length;
        bytes.set(encoded, offset + 1);
        offset += encoded.length + 1;
    }
    if (bytes.byteLength !== offset + 1)
        return bytes.slice(0, offset + 1);
    return bytes;
}

/**
 * Gets address for ENS name.
 *
 * - Docs: https://viem.sh/docs/ens/actions/getEnsAddress
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens
 *
 * Calls `resolve(bytes, bytes)` on ENS Universal Resolver Contract.
 *
 * Since ENS names prohibit certain forbidden characters (e.g. underscore) and have other validation rules, you likely want to [normalize ENS names](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) with [UTS-46 normalization](https://unicode.org/reports/tr46) before passing them to `getEnsAddress`. You can use the built-in [`normalize`](https://viem.sh/docs/ens/utilities/normalize) function for this.
 *
 * @param client - Client to use
 * @param parameters - {@link GetEnsAddressParameters}
 * @returns Address for ENS name or `null` if not found. {@link GetEnsAddressReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getEnsAddress, normalize } from 'viem/ens'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const ensAddress = await getEnsAddress(client, {
 *   name: normalize('wevm.eth'),
 * })
 * // '0xd2135CfB216b74109775236E36d4b433F1DF507B'
 */
async function getEnsAddress(client, parameters) {
    const { blockNumber, blockTag, coinType, name, gatewayUrls, strict } = parameters;
    const { chain } = client;
    const universalResolverAddress = (() => {
        if (parameters.universalResolverAddress)
            return parameters.universalResolverAddress;
        if (!chain)
            throw new Error('client chain not configured. universalResolverAddress is required.');
        return getChainContractAddress({
            blockNumber,
            chain,
            contract: 'ensUniversalResolver',
        });
    })();
    const tlds = chain?.ensTlds;
    if (tlds && !tlds.some((tld) => name.endsWith(tld)))
        return null;
    const args = (() => {
        if (coinType != null)
            return [namehash(name), BigInt(coinType)];
        return [namehash(name)];
    })();
    try {
        const functionData = encodeFunctionData({
            abi: addressResolverAbi,
            functionName: 'addr',
            args,
        });
        const readContractParameters = {
            address: universalResolverAddress,
            abi: universalResolverResolveAbi,
            functionName: 'resolveWithGateways',
            args: [
                toHex(packetToBytes(name)),
                functionData,
                gatewayUrls ?? [localBatchGatewayUrl],
            ],
            blockNumber,
            blockTag,
        };
        const readContractAction = getAction(client, readContract, 'readContract');
        const res = await readContractAction(readContractParameters);
        if (res[0] === '0x')
            return null;
        const address = decodeFunctionResult({
            abi: addressResolverAbi,
            args,
            functionName: 'addr',
            data: res[0],
        });
        if (address === '0x')
            return null;
        if (trim$1(address) === '0x00')
            return null;
        return address;
    }
    catch (err) {
        if (strict)
            throw err;
        if (isNullUniversalResolverError(err))
            return null;
        throw err;
    }
}

class EnsAvatarInvalidMetadataError extends BaseError$1 {
    constructor({ data }) {
        super('Unable to extract image from metadata. The metadata may be malformed or invalid.', {
            metaMessages: [
                '- Metadata must be a JSON object with at least an `image`, `image_url` or `image_data` property.',
                '',
                `Provided data: ${JSON.stringify(data)}`,
            ],
            name: 'EnsAvatarInvalidMetadataError',
        });
    }
}
class EnsAvatarInvalidNftUriError extends BaseError$1 {
    constructor({ reason }) {
        super(`ENS NFT avatar URI is invalid. ${reason}`, {
            name: 'EnsAvatarInvalidNftUriError',
        });
    }
}
class EnsAvatarUriResolutionError extends BaseError$1 {
    constructor({ uri }) {
        super(`Unable to resolve ENS avatar URI "${uri}". The URI may be malformed, invalid, or does not respond with a valid image.`, { name: 'EnsAvatarUriResolutionError' });
    }
}
class EnsAvatarUnsupportedNamespaceError extends BaseError$1 {
    constructor({ namespace }) {
        super(`ENS NFT avatar namespace "${namespace}" is not supported. Must be "erc721" or "erc1155".`, { name: 'EnsAvatarUnsupportedNamespaceError' });
    }
}

const networkRegex = /(?<protocol>https?:\/\/[^/]*|ipfs:\/|ipns:\/|ar:\/)?(?<root>\/)?(?<subpath>ipfs\/|ipns\/)?(?<target>[\w\-.]+)(?<subtarget>\/.*)?/;
const ipfsHashRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|b[A-Za-z2-7]{58,}|B[A-Z2-7]{58,}|z[1-9A-HJ-NP-Za-km-z]{48,}|F[0-9A-F]{50,})(\/(?<target>[\w\-.]+))?(?<subtarget>\/.*)?$/;
const base64Regex = /^data:([a-zA-Z\-/+]*);base64,([^"].*)/;
const dataURIRegex = /^data:([a-zA-Z\-/+]*)?(;[a-zA-Z0-9].*?)?(,)/;
/** @internal */
async function isImageUri(uri) {
    try {
        const res = await fetch(uri, { method: 'HEAD' });
        // retrieve content type header to check if content is image
        if (res.status === 200) {
            const contentType = res.headers.get('content-type');
            return contentType?.startsWith('image/');
        }
        return false;
    }
    catch (error) {
        // if error is not cors related then fail
        if (typeof error === 'object' && typeof error.response !== 'undefined') {
            return false;
        }
        // fail in NodeJS, since the error is not cors but any other network issue
        if (!Object.hasOwn(globalThis, 'Image'))
            return false;
        // in case of cors, use image api to validate if given url is an actual image
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve(true);
            };
            img.onerror = () => {
                resolve(false);
            };
            img.src = uri;
        });
    }
}
/** @internal */
function getGateway(custom, defaultGateway) {
    if (!custom)
        return defaultGateway;
    if (custom.endsWith('/'))
        return custom.slice(0, -1);
    return custom;
}
function resolveAvatarUri({ uri, gatewayUrls, }) {
    const isEncoded = base64Regex.test(uri);
    if (isEncoded)
        return { uri, isOnChain: true, isEncoded };
    const ipfsGateway = getGateway(gatewayUrls?.ipfs, 'https://ipfs.io');
    const arweaveGateway = getGateway(gatewayUrls?.arweave, 'https://arweave.net');
    const networkRegexMatch = uri.match(networkRegex);
    const { protocol, subpath, target, subtarget = '', } = networkRegexMatch?.groups || {};
    const isIPNS = protocol === 'ipns:/' || subpath === 'ipns/';
    const isIPFS = protocol === 'ipfs:/' || subpath === 'ipfs/' || ipfsHashRegex.test(uri);
    if (uri.startsWith('http') && !isIPNS && !isIPFS) {
        let replacedUri = uri;
        if (gatewayUrls?.arweave)
            replacedUri = uri.replace(/https:\/\/arweave.net/g, gatewayUrls?.arweave);
        return { uri: replacedUri, isOnChain: false, isEncoded: false };
    }
    if ((isIPNS || isIPFS) && target) {
        return {
            uri: `${ipfsGateway}/${isIPNS ? 'ipns' : 'ipfs'}/${target}${subtarget}`,
            isOnChain: false,
            isEncoded: false,
        };
    }
    if (protocol === 'ar:/' && target) {
        return {
            uri: `${arweaveGateway}/${target}${subtarget || ''}`,
            isOnChain: false,
            isEncoded: false,
        };
    }
    let parsedUri = uri.replace(dataURIRegex, '');
    if (parsedUri.startsWith('<svg')) {
        // if svg, base64 encode
        parsedUri = `data:image/svg+xml;base64,${btoa(parsedUri)}`;
    }
    if (parsedUri.startsWith('data:') || parsedUri.startsWith('{')) {
        return {
            uri: parsedUri,
            isOnChain: true,
            isEncoded: false,
        };
    }
    throw new EnsAvatarUriResolutionError({ uri });
}
function getJsonImage(data) {
    // validation check for json data, must include one of theses properties
    if (typeof data !== 'object' ||
        (!('image' in data) && !('image_url' in data) && !('image_data' in data))) {
        throw new EnsAvatarInvalidMetadataError({ data });
    }
    return data.image || data.image_url || data.image_data;
}
async function getMetadataAvatarUri({ gatewayUrls, uri, }) {
    try {
        const res = await fetch(uri).then((res) => res.json());
        const image = await parseAvatarUri({
            gatewayUrls,
            uri: getJsonImage(res),
        });
        return image;
    }
    catch {
        throw new EnsAvatarUriResolutionError({ uri });
    }
}
async function parseAvatarUri({ gatewayUrls, uri, }) {
    const { uri: resolvedURI, isOnChain } = resolveAvatarUri({ uri, gatewayUrls });
    if (isOnChain)
        return resolvedURI;
    // check if resolvedURI is an image, if it is return the url
    const isImage = await isImageUri(resolvedURI);
    if (isImage)
        return resolvedURI;
    throw new EnsAvatarUriResolutionError({ uri });
}
function parseNftUri(uri_) {
    let uri = uri_;
    // parse valid nft spec (CAIP-22/CAIP-29)
    // @see: https://github.com/ChainAgnostic/CAIPs/tree/master/CAIPs
    if (uri.startsWith('did:nft:')) {
        // convert DID to CAIP
        uri = uri.replace('did:nft:', '').replace(/_/g, '/');
    }
    const [reference, asset_namespace, tokenID] = uri.split('/');
    const [eip_namespace, chainID] = reference.split(':');
    const [erc_namespace, contractAddress] = asset_namespace.split(':');
    if (!eip_namespace || eip_namespace.toLowerCase() !== 'eip155')
        throw new EnsAvatarInvalidNftUriError({ reason: 'Only EIP-155 supported' });
    if (!chainID)
        throw new EnsAvatarInvalidNftUriError({ reason: 'Chain ID not found' });
    if (!contractAddress)
        throw new EnsAvatarInvalidNftUriError({
            reason: 'Contract address not found',
        });
    if (!tokenID)
        throw new EnsAvatarInvalidNftUriError({ reason: 'Token ID not found' });
    if (!erc_namespace)
        throw new EnsAvatarInvalidNftUriError({ reason: 'ERC namespace not found' });
    return {
        chainID: Number.parseInt(chainID, 10),
        namespace: erc_namespace.toLowerCase(),
        contractAddress: contractAddress,
        tokenID,
    };
}
async function getNftTokenUri(client, { nft }) {
    if (nft.namespace === 'erc721') {
        return readContract(client, {
            address: nft.contractAddress,
            abi: [
                {
                    name: 'tokenURI',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'tokenId', type: 'uint256' }],
                    outputs: [{ name: '', type: 'string' }],
                },
            ],
            functionName: 'tokenURI',
            args: [BigInt(nft.tokenID)],
        });
    }
    if (nft.namespace === 'erc1155') {
        return readContract(client, {
            address: nft.contractAddress,
            abi: [
                {
                    name: 'uri',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: '_id', type: 'uint256' }],
                    outputs: [{ name: '', type: 'string' }],
                },
            ],
            functionName: 'uri',
            args: [BigInt(nft.tokenID)],
        });
    }
    throw new EnsAvatarUnsupportedNamespaceError({ namespace: nft.namespace });
}

/*
 * @description Parses an ENS avatar record.
 *
 * @example
 * parseAvatarRecord('eip155:1/erc1155:0xb32979486938aa9694bfc898f35dbed459f44424/10063')
 * 'https://ipfs.io/ipfs/QmSP4nq9fnN9dAiCj42ug9Wa79rqmQerZXZch82VqpiH7U/image.gif'
 *
 * @see https://docs.ens.domains/web/avatars
 *
 */
async function parseAvatarRecord(client, { gatewayUrls, record, }) {
    if (/eip155:/i.test(record))
        return parseNftAvatarUri(client, { gatewayUrls, record });
    return parseAvatarUri({ uri: record, gatewayUrls });
}
async function parseNftAvatarUri(client, { gatewayUrls, record, }) {
    // parse NFT URI into properties
    const nft = parseNftUri(record);
    // fetch tokenURI from the NFT contract
    const nftUri = await getNftTokenUri(client, { nft });
    // resolve the URI from the fetched tokenURI
    const { uri: resolvedNftUri, isOnChain, isEncoded, } = resolveAvatarUri({ uri: nftUri, gatewayUrls });
    // if the resolved URI is on chain, return the data
    if (isOnChain &&
        (resolvedNftUri.includes('data:application/json;base64,') ||
            resolvedNftUri.startsWith('{'))) {
        const encodedJson = isEncoded
            ? // if it is encoded, decode it
                atob(resolvedNftUri.replace('data:application/json;base64,', ''))
            : // if it isn't encoded assume it is a JSON string, but it could be anything (it will error if it is)
                resolvedNftUri;
        const decoded = JSON.parse(encodedJson);
        return parseAvatarUri({ uri: getJsonImage(decoded), gatewayUrls });
    }
    let uriTokenId = nft.tokenID;
    if (nft.namespace === 'erc1155')
        uriTokenId = uriTokenId.replace('0x', '').padStart(64, '0');
    return getMetadataAvatarUri({
        gatewayUrls,
        uri: resolvedNftUri.replace(/(?:0x)?{id}/, uriTokenId),
    });
}

/**
 * Gets a text record for specified ENS name.
 *
 * - Docs: https://viem.sh/docs/ens/actions/getEnsResolver
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens
 *
 * Calls `resolve(bytes, bytes)` on ENS Universal Resolver Contract.
 *
 * Since ENS names prohibit certain forbidden characters (e.g. underscore) and have other validation rules, you likely want to [normalize ENS names](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) with [UTS-46 normalization](https://unicode.org/reports/tr46) before passing them to `getEnsAddress`. You can use the built-in [`normalize`](https://viem.sh/docs/ens/utilities/normalize) function for this.
 *
 * @param client - Client to use
 * @param parameters - {@link GetEnsTextParameters}
 * @returns Address for ENS resolver. {@link GetEnsTextReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getEnsText, normalize } from 'viem/ens'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const twitterRecord = await getEnsText(client, {
 *   name: normalize('wevm.eth'),
 *   key: 'com.twitter',
 * })
 * // 'wevm_dev'
 */
async function getEnsText(client, parameters) {
    const { blockNumber, blockTag, key, name, gatewayUrls, strict } = parameters;
    const { chain } = client;
    const universalResolverAddress = (() => {
        if (parameters.universalResolverAddress)
            return parameters.universalResolverAddress;
        if (!chain)
            throw new Error('client chain not configured. universalResolverAddress is required.');
        return getChainContractAddress({
            blockNumber,
            chain,
            contract: 'ensUniversalResolver',
        });
    })();
    const tlds = chain?.ensTlds;
    if (tlds && !tlds.some((tld) => name.endsWith(tld)))
        return null;
    try {
        const readContractParameters = {
            address: universalResolverAddress,
            abi: universalResolverResolveAbi,
            args: [
                toHex(packetToBytes(name)),
                encodeFunctionData({
                    abi: textResolverAbi,
                    functionName: 'text',
                    args: [namehash(name), key],
                }),
                gatewayUrls ?? [localBatchGatewayUrl],
            ],
            functionName: 'resolveWithGateways',
            blockNumber,
            blockTag,
        };
        const readContractAction = getAction(client, readContract, 'readContract');
        const res = await readContractAction(readContractParameters);
        if (res[0] === '0x')
            return null;
        const record = decodeFunctionResult({
            abi: textResolverAbi,
            functionName: 'text',
            data: res[0],
        });
        return record === '' ? null : record;
    }
    catch (err) {
        if (strict)
            throw err;
        if (isNullUniversalResolverError(err))
            return null;
        throw err;
    }
}

/**
 * Gets the avatar of an ENS name.
 *
 * - Docs: https://viem.sh/docs/ens/actions/getEnsAvatar
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens
 *
 * Calls [`getEnsText`](https://viem.sh/docs/ens/actions/getEnsText) with `key` set to `'avatar'`.
 *
 * Since ENS names prohibit certain forbidden characters (e.g. underscore) and have other validation rules, you likely want to [normalize ENS names](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) with [UTS-46 normalization](https://unicode.org/reports/tr46) before passing them to `getEnsAddress`. You can use the built-in [`normalize`](https://viem.sh/docs/ens/utilities/normalize) function for this.
 *
 * @param client - Client to use
 * @param parameters - {@link GetEnsAvatarParameters}
 * @returns Avatar URI or `null` if not found. {@link GetEnsAvatarReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getEnsAvatar, normalize } from 'viem/ens'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const ensAvatar = await getEnsAvatar(client, {
 *   name: normalize('wevm.eth'),
 * })
 * // 'https://ipfs.io/ipfs/Qma8mnp6xV3J2cRNf3mTth5C8nV11CAnceVinc3y8jSbio'
 */
async function getEnsAvatar(client, { blockNumber, blockTag, assetGatewayUrls, name, gatewayUrls, strict, universalResolverAddress, }) {
    const record = await getAction(client, getEnsText, 'getEnsText')({
        blockNumber,
        blockTag,
        key: 'avatar',
        name,
        universalResolverAddress,
        gatewayUrls,
        strict,
    });
    if (!record)
        return null;
    try {
        return await parseAvatarRecord(client, {
            record,
            gatewayUrls: assetGatewayUrls,
        });
    }
    catch {
        return null;
    }
}

/**
 * Gets primary name for specified address.
 *
 * - Docs: https://viem.sh/docs/ens/actions/getEnsName
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens
 *
 * Calls `reverse(bytes)` on ENS Universal Resolver Contract to "reverse resolve" the address to the primary ENS name.
 *
 * @param client - Client to use
 * @param parameters - {@link GetEnsNameParameters}
 * @returns Name or `null` if not found. {@link GetEnsNameReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getEnsName } from 'viem/ens'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const ensName = await getEnsName(client, {
 *   address: '0xd2135CfB216b74109775236E36d4b433F1DF507B',
 * })
 * // 'wevm.eth'
 */
async function getEnsName(client, parameters) {
    const { address, blockNumber, blockTag, coinType = 60n, gatewayUrls, strict, } = parameters;
    const { chain } = client;
    const universalResolverAddress = (() => {
        if (parameters.universalResolverAddress)
            return parameters.universalResolverAddress;
        if (!chain)
            throw new Error('client chain not configured. universalResolverAddress is required.');
        return getChainContractAddress({
            blockNumber,
            chain,
            contract: 'ensUniversalResolver',
        });
    })();
    try {
        const readContractParameters = {
            address: universalResolverAddress,
            abi: universalResolverReverseAbi,
            args: [address, coinType, gatewayUrls ?? [localBatchGatewayUrl]],
            functionName: 'reverseWithGateways',
            blockNumber,
            blockTag,
        };
        const readContractAction = getAction(client, readContract, 'readContract');
        const [name] = await readContractAction(readContractParameters);
        return name || null;
    }
    catch (err) {
        if (strict)
            throw err;
        if (isNullUniversalResolverError(err))
            return null;
        throw err;
    }
}

/**
 * Gets resolver for ENS name.
 *
 * - Docs: https://viem.sh/docs/ens/actions/getEnsResolver
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens
 *
 * Calls `findResolver(bytes)` on ENS Universal Resolver Contract to retrieve the resolver of an ENS name.
 *
 * Since ENS names prohibit certain forbidden characters (e.g. underscore) and have other validation rules, you likely want to [normalize ENS names](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) with [UTS-46 normalization](https://unicode.org/reports/tr46) before passing them to `getEnsAddress`. You can use the built-in [`normalize`](https://viem.sh/docs/ens/utilities/normalize) function for this.
 *
 * @param client - Client to use
 * @param parameters - {@link GetEnsResolverParameters}
 * @returns Address for ENS resolver. {@link GetEnsResolverReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getEnsResolver, normalize } from 'viem/ens'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const resolverAddress = await getEnsResolver(client, {
 *   name: normalize('wevm.eth'),
 * })
 * // '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41'
 */
async function getEnsResolver(client, parameters) {
    const { blockNumber, blockTag, name } = parameters;
    const { chain } = client;
    const universalResolverAddress = (() => {
        if (parameters.universalResolverAddress)
            return parameters.universalResolverAddress;
        if (!chain)
            throw new Error('client chain not configured. universalResolverAddress is required.');
        return getChainContractAddress({
            blockNumber,
            chain,
            contract: 'ensUniversalResolver',
        });
    })();
    const tlds = chain?.ensTlds;
    if (tlds && !tlds.some((tld) => name.endsWith(tld)))
        throw new Error(`${name} is not a valid ENS TLD (${tlds?.join(', ')}) for chain "${chain.name}" (id: ${chain.id}).`);
    const [resolverAddress] = await getAction(client, readContract, 'readContract')({
        address: universalResolverAddress,
        abi: [
            {
                inputs: [{ type: 'bytes' }],
                name: 'findResolver',
                outputs: [
                    { type: 'address' },
                    { type: 'bytes32' },
                    { type: 'uint256' },
                ],
                stateMutability: 'view',
                type: 'function',
            },
        ],
        functionName: 'findResolver',
        args: [toHex(packetToBytes(name))],
        blockNumber,
        blockTag,
    });
    return resolverAddress;
}

/**
 * Creates an EIP-2930 access list.
 *
 * - Docs: https://viem.sh/docs/actions/public/createAccessList
 * - JSON-RPC Methods: `eth_createAccessList`
 *
 * @param client - Client to use
 * @param parameters - {@link CreateAccessListParameters}
 * @returns The access list. {@link CreateAccessListReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createAccessList } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const data = await createAccessList(client, {
 *   account: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
 *   data: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
 *   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 * })
 */
async function createAccessList(client, args) {
    const { account: account_ = client.account, blockNumber, blockTag = 'latest', blobs, data, gas, gasPrice, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, to, value, ...rest } = args;
    const account = account_ ? parseAccount(account_) : undefined;
    try {
        assertRequest(args);
        const blockNumberHex = typeof blockNumber === 'bigint' ? numberToHex(blockNumber) : undefined;
        const block = blockNumberHex || blockTag;
        const chainFormat = client.chain?.formatters?.transactionRequest?.format;
        const format = chainFormat || formatTransactionRequest;
        const request = format({
            // Pick out extra data that might exist on the chain's transaction request type.
            ...extract$1(rest, { format: chainFormat }),
            account,
            blobs,
            data,
            gas,
            gasPrice,
            maxFeePerBlobGas,
            maxFeePerGas,
            maxPriorityFeePerGas,
            to,
            value,
        }, 'createAccessList');
        const response = await client.request({
            method: 'eth_createAccessList',
            params: [request, block],
        });
        return {
            accessList: response.accessList,
            gasUsed: BigInt(response.gasUsed),
        };
    }
    catch (err) {
        throw getCallError(err, {
            ...args,
            account,
            chain: client.chain,
        });
    }
}

/**
 * Creates a [`Filter`](https://viem.sh/docs/glossary/types#filter) to listen for new block hashes that can be used with [`getFilterChanges`](https://viem.sh/docs/actions/public/getFilterChanges).
 *
 * - Docs: https://viem.sh/docs/actions/public/createBlockFilter
 * - JSON-RPC Methods: [`eth_newBlockFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newBlockFilter)
 *
 * @param client - Client to use
 * @returns [`Filter`](https://viem.sh/docs/glossary/types#filter). {@link CreateBlockFilterReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createBlockFilter } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const filter = await createBlockFilter(client)
 * // { id: "0x345a6572337856574a76364e457a4366", type: 'block' }
 */
async function createBlockFilter(client) {
    const getRequest = createFilterRequestScope(client, {
        method: 'eth_newBlockFilter',
    });
    const id = await client.request({
        method: 'eth_newBlockFilter',
    });
    return { id, request: getRequest(id), type: 'block' };
}

/**
 * Creates a [`Filter`](https://viem.sh/docs/glossary/types#filter) to listen for new events that can be used with [`getFilterChanges`](https://viem.sh/docs/actions/public/getFilterChanges).
 *
 * - Docs: https://viem.sh/docs/actions/public/createEventFilter
 * - JSON-RPC Methods: [`eth_newFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newfilter)
 *
 * @param client - Client to use
 * @param parameters - {@link CreateEventFilterParameters}
 * @returns [`Filter`](https://viem.sh/docs/glossary/types#filter). {@link CreateEventFilterReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createEventFilter } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const filter = await createEventFilter(client, {
 *   address: '0xfba3912ca04dd458c843e2ee08967fc04f3579c2',
 * })
 */
async function createEventFilter(client, { address, args, event, events: events_, fromBlock, strict, toBlock, } = {}) {
    const events = events_ ?? (event ? [event] : undefined);
    const getRequest = createFilterRequestScope(client, {
        method: 'eth_newFilter',
    });
    let topics = [];
    if (events) {
        const encoded = events.flatMap((event) => encodeEventTopics({
            abi: [event],
            eventName: event.name,
            args,
        }));
        // TODO: Clean up type casting
        topics = [encoded];
        if (event)
            topics = topics[0];
    }
    const id = await client.request({
        method: 'eth_newFilter',
        params: [
            {
                address,
                fromBlock: typeof fromBlock === 'bigint' ? numberToHex(fromBlock) : fromBlock,
                toBlock: typeof toBlock === 'bigint' ? numberToHex(toBlock) : toBlock,
                ...(topics.length ? { topics } : {}),
            },
        ],
    });
    return {
        abi: events,
        args,
        eventName: event ? event.name : undefined,
        fromBlock,
        id,
        request: getRequest(id),
        strict: Boolean(strict),
        toBlock,
        type: 'event',
    };
}

/**
 * Creates a Filter to listen for new pending transaction hashes that can be used with [`getFilterChanges`](https://viem.sh/docs/actions/public/getFilterChanges).
 *
 * - Docs: https://viem.sh/docs/actions/public/createPendingTransactionFilter
 * - JSON-RPC Methods: [`eth_newPendingTransactionFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newpendingtransactionfilter)
 *
 * @param client - Client to use
 * @returns [`Filter`](https://viem.sh/docs/glossary/types#filter). {@link CreateBlockFilterReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createPendingTransactionFilter } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const filter = await createPendingTransactionFilter(client)
 * // { id: "0x345a6572337856574a76364e457a4366", type: 'transaction' }
 */
async function createPendingTransactionFilter(client) {
    const getRequest = createFilterRequestScope(client, {
        method: 'eth_newPendingTransactionFilter',
    });
    const id = await client.request({
        method: 'eth_newPendingTransactionFilter',
    });
    return { id, request: getRequest(id), type: 'transaction' };
}

/**
 * Returns the balance of an address in wei.
 *
 * - Docs: https://viem.sh/docs/actions/public/getBalance
 * - JSON-RPC Methods: [`eth_getBalance`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getbalance)
 *
 * You can convert the balance to ether units with [`formatEther`](https://viem.sh/docs/utilities/formatEther).
 *
 * ```ts
 * const balance = await getBalance(client, {
 *   address: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   blockTag: 'safe'
 * })
 * const balanceAsEther = formatEther(balance)
 * // "6.942"
 * ```
 *
 * @param client - Client to use
 * @param parameters - {@link GetBalanceParameters}
 * @returns The balance of the address in wei. {@link GetBalanceReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getBalance } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const balance = await getBalance(client, {
 *   address: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 * })
 * // 10000000000000000000000n (wei)
 */
async function getBalance(client, { address, blockNumber, blockTag = client.experimental_blockTag ?? 'latest', }) {
    if (client.batch?.multicall && client.chain?.contracts?.multicall3) {
        const multicall3Address = client.chain.contracts.multicall3.address;
        const calldata = encodeFunctionData({
            abi: multicall3Abi,
            functionName: 'getEthBalance',
            args: [address],
        });
        const { data } = await getAction(client, call, 'call')({
            to: multicall3Address,
            data: calldata,
            blockNumber,
            blockTag,
        });
        return decodeFunctionResult({
            abi: multicall3Abi,
            functionName: 'getEthBalance',
            args: [address],
            data: data || '0x',
        });
    }
    const blockNumberHex = typeof blockNumber === 'bigint' ? numberToHex(blockNumber) : undefined;
    const balance = await client.request({
        method: 'eth_getBalance',
        params: [address, blockNumberHex || blockTag],
    });
    return BigInt(balance);
}

/**
 * Returns the base fee per blob gas in wei.
 *
 * - Docs: https://viem.sh/docs/actions/public/getBlobBaseFee
 * - JSON-RPC Methods: [`eth_blobBaseFee`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blobBaseFee)
 *
 * @param client - Client to use
 * @returns The blob base fee (in wei). {@link GetBlobBaseFeeReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getBlobBaseFee } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const blobBaseFee = await getBlobBaseFee(client)
 */
async function getBlobBaseFee(client) {
    const baseFee = await client.request({
        method: 'eth_blobBaseFee',
    });
    return BigInt(baseFee);
}

/**
 * Returns the number of Transactions at a block number, hash, or tag.
 *
 * - Docs: https://viem.sh/docs/actions/public/getBlockTransactionCount
 * - JSON-RPC Methods:
 *   - Calls [`eth_getBlockTransactionCountByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblocktransactioncountbynumber) for `blockNumber` & `blockTag`.
 *   - Calls [`eth_getBlockTransactionCountByHash`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblocktransactioncountbyhash) for `blockHash`.
 *
 * @param client - Client to use
 * @param parameters - {@link GetBlockTransactionCountParameters}
 * @returns The block transaction count. {@link GetBlockTransactionCountReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getBlockTransactionCount } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const count = await getBlockTransactionCount(client)
 */
async function getBlockTransactionCount(client, { blockHash, blockNumber, blockTag = 'latest', } = {}) {
    const blockNumberHex = blockNumber !== undefined ? numberToHex(blockNumber) : undefined;
    let count;
    if (blockHash) {
        count = await client.request({
            method: 'eth_getBlockTransactionCountByHash',
            params: [blockHash],
        }, { dedupe: true });
    }
    else {
        count = await client.request({
            method: 'eth_getBlockTransactionCountByNumber',
            params: [blockNumberHex || blockTag],
        }, { dedupe: Boolean(blockNumberHex) });
    }
    return hexToNumber$1(count);
}

/**
 * Retrieves the bytecode at an address.
 *
 * - Docs: https://viem.sh/docs/contract/getCode
 * - JSON-RPC Methods: [`eth_getCode`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getcode)
 *
 * @param client - Client to use
 * @param parameters - {@link GetCodeParameters}
 * @returns The contract's bytecode. {@link GetCodeReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getCode } from 'viem/contract'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const code = await getCode(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 * })
 */
async function getCode(client, { address, blockNumber, blockTag = 'latest' }) {
    const blockNumberHex = blockNumber !== undefined ? numberToHex(blockNumber) : undefined;
    const hex = await client.request({
        method: 'eth_getCode',
        params: [address, blockNumberHex || blockTag],
    }, { dedupe: Boolean(blockNumberHex) });
    if (hex === '0x')
        return undefined;
    return hex;
}

/**
 * Returns the address that an account has delegated to via EIP-7702.
 *
 * - Docs: https://viem.sh/docs/actions/public/getDelegation
 *
 * @param client - Client to use
 * @param parameters - {@link GetDelegationParameters}
 * @returns The delegated address, or undefined if not delegated. {@link GetDelegationReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getDelegation } from 'viem/actions'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const delegation = await getDelegation(client, {
 *   address: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 * })
 */
async function getDelegation(client, { address, blockNumber, blockTag = 'latest' }) {
    const code = await getCode(client, {
        address,
        ...(blockNumber !== undefined ? { blockNumber } : { blockTag }),
    });
    if (!code)
        return undefined;
    // EIP-7702 delegation designator: 0xef0100 prefix (3 bytes) + address (20 bytes) = 23 bytes
    if (size$3(code) !== 23)
        return undefined;
    // Check for EIP-7702 delegation designator prefix
    if (!code.startsWith('0xef0100'))
        return undefined;
    // Extract the delegated address (bytes 3-23) and checksum it
    return getAddress(slice$2(code, 3, 23));
}

class Eip712DomainNotFoundError extends BaseError$1 {
    constructor({ address }) {
        super(`No EIP-712 domain found on contract "${address}".`, {
            metaMessages: [
                'Ensure that:',
                `- The contract is deployed at the address "${address}".`,
                '- `eip712Domain()` function exists on the contract.',
                '- `eip712Domain()` function matches signature to ERC-5267 specification.',
            ],
            name: 'Eip712DomainNotFoundError',
        });
    }
}

/**
 * Reads the EIP-712 domain from a contract, based on the ERC-5267 specification.
 *
 * @param client - A {@link Client} instance.
 * @param parameters - The parameters of the action. {@link GetEip712DomainParameters}
 * @returns The EIP-712 domain, fields, and extensions. {@link GetEip712DomainReturnType}
 *
 * @example
 * ```ts
 * import { createPublicClient, http, getEip712Domain } from 'viem'
 * import { mainnet } from 'viem/chains'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 *
 * const domain = await getEip712Domain(client, {
 *   address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 * })
 * // {
 * //   domain: {
 * //     name: 'ExampleContract',
 * //     version: '1',
 * //     chainId: 1,
 * //     verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 * //   },
 * //   fields: '0x0f',
 * //   extensions: [],
 * // }
 * ```
 */
async function getEip712Domain(client, parameters) {
    const { address, factory, factoryData } = parameters;
    try {
        const [fields, name, version, chainId, verifyingContract, salt, extensions,] = await getAction(client, readContract, 'readContract')({
            abi,
            address,
            functionName: 'eip712Domain',
            factory,
            factoryData,
        });
        return {
            domain: {
                name,
                version,
                chainId: Number(chainId),
                verifyingContract,
                salt,
            },
            extensions,
            fields,
        };
    }
    catch (e) {
        const error = e;
        if (error.name === 'ContractFunctionExecutionError' &&
            error.cause.name === 'ContractFunctionZeroDataError') {
            throw new Eip712DomainNotFoundError({ address });
        }
        throw error;
    }
}
const abi = [
    {
        inputs: [],
        name: 'eip712Domain',
        outputs: [
            { name: 'fields', type: 'bytes1' },
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
            { name: 'salt', type: 'bytes32' },
            { name: 'extensions', type: 'uint256[]' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
];

function formatFeeHistory(feeHistory) {
    return {
        baseFeePerGas: feeHistory.baseFeePerGas.map((value) => BigInt(value)),
        gasUsedRatio: feeHistory.gasUsedRatio,
        oldestBlock: BigInt(feeHistory.oldestBlock),
        reward: feeHistory.reward?.map((reward) => reward.map((value) => BigInt(value))),
    };
}

/**
 * Returns a collection of historical gas information.
 *
 * - Docs: https://viem.sh/docs/actions/public/getFeeHistory
 * - JSON-RPC Methods: [`eth_feeHistory`](https://docs.alchemy.com/reference/eth-feehistory)
 *
 * @param client - Client to use
 * @param parameters - {@link GetFeeHistoryParameters}
 * @returns The gas estimate (in wei). {@link GetFeeHistoryReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getFeeHistory } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const feeHistory = await getFeeHistory(client, {
 *   blockCount: 4,
 *   rewardPercentiles: [25, 75],
 * })
 */
async function getFeeHistory(client, { blockCount, blockNumber, blockTag = 'latest', rewardPercentiles, }) {
    const blockNumberHex = typeof blockNumber === 'bigint' ? numberToHex(blockNumber) : undefined;
    const feeHistory = await client.request({
        method: 'eth_feeHistory',
        params: [
            numberToHex(blockCount),
            blockNumberHex || blockTag,
            rewardPercentiles,
        ],
    }, { dedupe: Boolean(blockNumberHex) });
    return formatFeeHistory(feeHistory);
}

/**
 * Returns a list of event logs since the filter was created.
 *
 * - Docs: https://viem.sh/docs/actions/public/getFilterLogs
 * - JSON-RPC Methods: [`eth_getFilterLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getfilterlogs)
 *
 * `getFilterLogs` is only compatible with **event filters**.
 *
 * @param client - Client to use
 * @param parameters - {@link GetFilterLogsParameters}
 * @returns A list of event logs. {@link GetFilterLogsReturnType}
 *
 * @example
 * import { createPublicClient, http, parseAbiItem } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createEventFilter, getFilterLogs } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const filter = await createEventFilter(client, {
 *   address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
 *   event: parseAbiItem('event Transfer(address indexed, address indexed, uint256)'),
 * })
 * const logs = await getFilterLogs(client, { filter })
 */
async function getFilterLogs(_client, { filter, }) {
    const strict = filter.strict ?? false;
    const logs = await filter.request({
        method: 'eth_getFilterLogs',
        params: [filter.id],
    });
    const formattedLogs = logs.map((log) => formatLog(log));
    if (!filter.abi)
        return formattedLogs;
    return parseEventLogs({
        abi: filter.abi,
        logs: formattedLogs,
        strict,
    });
}

/**
 * Verify that an Authorization object was signed by the provided address.
 *
 * - Docs {@link https://viem.sh/docs/utilities/verifyAuthorization}
 *
 * @param parameters - {@link VerifyAuthorizationParameters}
 * @returns Whether or not the signature is valid. {@link VerifyAuthorizationReturnType}
 */
async function verifyAuthorization({ address, authorization, signature, }) {
    return isAddressEqual(getAddress(address), await recoverAuthorizationAddress({
        authorization,
        signature,
    }));
}

/** @internal */
const promiseCache = /*#__PURE__*/ new LruMap$1(8192);
/** Deduplicates in-flight promises. */
function withDedupe(fn, { enabled = true, id }) {
    if (!enabled || !id)
        return fn();
    if (promiseCache.get(id))
        return promiseCache.get(id);
    const promise = fn().finally(() => promiseCache.delete(id));
    promiseCache.set(id, promise);
    return promise;
}

function buildRequest(request, options = {}) {
    return async (args, overrideOptions = {}) => {
        const { dedupe = false, methods, retryDelay = 150, retryCount = 3, uid, } = {
            ...options,
            ...overrideOptions,
        };
        const { method } = args;
        if (methods?.exclude?.includes(method))
            throw new MethodNotSupportedRpcError(new Error('method not supported'), {
                method,
            });
        if (methods?.include && !methods.include.includes(method))
            throw new MethodNotSupportedRpcError(new Error('method not supported'), {
                method,
            });
        const requestId = dedupe
            ? stringToHex(`${uid}.${stringify$1(args)}`)
            : undefined;
        return withDedupe(() => withRetry(async () => {
            try {
                return await request(args);
            }
            catch (err_) {
                const err = err_;
                switch (err.code) {
                    // -32700
                    case ParseRpcError.code:
                        throw new ParseRpcError(err);
                    // -32600
                    case InvalidRequestRpcError.code:
                        throw new InvalidRequestRpcError(err);
                    // -32601
                    case MethodNotFoundRpcError.code:
                        throw new MethodNotFoundRpcError(err, { method: args.method });
                    // -32602
                    case InvalidParamsRpcError.code:
                        throw new InvalidParamsRpcError(err);
                    // -32603
                    case InternalRpcError.code:
                        throw new InternalRpcError(err);
                    // -32000
                    case InvalidInputRpcError.code:
                        throw new InvalidInputRpcError(err);
                    // -32001
                    case ResourceNotFoundRpcError.code:
                        throw new ResourceNotFoundRpcError(err);
                    // -32002
                    case ResourceUnavailableRpcError.code:
                        throw new ResourceUnavailableRpcError(err);
                    // -32003
                    case TransactionRejectedRpcError.code:
                        throw new TransactionRejectedRpcError(err);
                    // -32004
                    case MethodNotSupportedRpcError.code:
                        throw new MethodNotSupportedRpcError(err, {
                            method: args.method,
                        });
                    // -32005
                    case LimitExceededRpcError.code:
                        throw new LimitExceededRpcError(err);
                    // -32006
                    case JsonRpcVersionUnsupportedError.code:
                        throw new JsonRpcVersionUnsupportedError(err);
                    // 4001
                    case UserRejectedRequestError.code:
                        throw new UserRejectedRequestError(err);
                    // 4100
                    case UnauthorizedProviderError.code:
                        throw new UnauthorizedProviderError(err);
                    // 4200
                    case UnsupportedProviderMethodError.code:
                        throw new UnsupportedProviderMethodError(err);
                    // 4900
                    case ProviderDisconnectedError.code:
                        throw new ProviderDisconnectedError(err);
                    // 4901
                    case ChainDisconnectedError.code:
                        throw new ChainDisconnectedError(err);
                    // 4902
                    case SwitchChainError.code:
                        throw new SwitchChainError(err);
                    // 5700
                    case UnsupportedNonOptionalCapabilityError.code:
                        throw new UnsupportedNonOptionalCapabilityError(err);
                    // 5710
                    case UnsupportedChainIdError.code:
                        throw new UnsupportedChainIdError(err);
                    // 5720
                    case DuplicateIdError.code:
                        throw new DuplicateIdError(err);
                    // 5730
                    case UnknownBundleIdError.code:
                        throw new UnknownBundleIdError(err);
                    // 5740
                    case BundleTooLargeError.code:
                        throw new BundleTooLargeError(err);
                    // 5750
                    case AtomicReadyWalletRejectedUpgradeError.code:
                        throw new AtomicReadyWalletRejectedUpgradeError(err);
                    // 5760
                    case AtomicityNotSupportedError.code:
                        throw new AtomicityNotSupportedError(err);
                    // CAIP-25: User Rejected Error
                    // https://docs.walletconnect.com/2.0/specs/clients/sign/error-codes#rejected-caip-25
                    case 5000:
                        throw new UserRejectedRequestError(err);
                    // WalletConnect: Session Settlement Failed
                    // https://docs.walletconnect.com/2.0/specs/clients/sign/error-codes
                    case WalletConnectSessionSettlementError.code:
                        throw new WalletConnectSessionSettlementError(err);
                    default:
                        if (err_ instanceof BaseError$1)
                            throw err_;
                        throw new UnknownRpcError(err);
                }
            }
        }, {
            delay: ({ count, error }) => {
                // If we find a Retry-After header, let's retry after the given time.
                if (error && error instanceof HttpRequestError) {
                    const retryAfter = error?.headers?.get('Retry-After');
                    if (retryAfter?.match(/\d/))
                        return Number.parseInt(retryAfter, 10) * 1000;
                }
                // Otherwise, let's retry with an exponential backoff.
                return ~~(1 << count) * retryDelay;
            },
            retryCount,
            shouldRetry: ({ error }) => shouldRetry(error),
        }), { enabled: dedupe, id: requestId });
    };
}
/** @internal */
function shouldRetry(error) {
    if ('code' in error && typeof error.code === 'number') {
        if (error.code === -1)
            return true; // Unknown error
        if (error.code === LimitExceededRpcError.code)
            return true;
        if (error.code === InternalRpcError.code)
            return true;
        return false;
    }
    if (error instanceof HttpRequestError && error.status) {
        // Forbidden
        if (error.status === 403)
            return true;
        // Request Timeout
        if (error.status === 408)
            return true;
        // Request Entity Too Large
        if (error.status === 413)
            return true;
        // Too Many Requests
        if (error.status === 429)
            return true;
        // Internal Server Error
        if (error.status === 500)
            return true;
        // Bad Gateway
        if (error.status === 502)
            return true;
        // Service Unavailable
        if (error.status === 503)
            return true;
        // Gateway Timeout
        if (error.status === 504)
            return true;
        return false;
    }
    return true;
}

class OffchainLookupError extends BaseError$1 {
    constructor({ callbackSelector, cause, data, extraData, sender, urls, }) {
        super(cause.shortMessage ||
            'An error occurred while fetching for an offchain result.', {
            cause,
            metaMessages: [
                ...(cause.metaMessages || []),
                cause.metaMessages?.length ? '' : [],
                'Offchain Gateway Call:',
                urls && [
                    '  Gateway URL(s):',
                    ...urls.map((url) => `    ${getUrl(url)}`),
                ],
                `  Sender: ${sender}`,
                `  Data: ${data}`,
                `  Callback selector: ${callbackSelector}`,
                `  Extra data: ${extraData}`,
            ].flat(),
            name: 'OffchainLookupError',
        });
    }
}
class OffchainLookupResponseMalformedError extends BaseError$1 {
    constructor({ result, url }) {
        super('Offchain gateway response is malformed. Response data must be a hex value.', {
            metaMessages: [
                `Gateway URL: ${getUrl(url)}`,
                `Response: ${stringify$1(result)}`,
            ],
            name: 'OffchainLookupResponseMalformedError',
        });
    }
}
class OffchainLookupSenderMismatchError extends BaseError$1 {
    constructor({ sender, to }) {
        super('Reverted sender address does not match target contract address (`to`).', {
            metaMessages: [
                `Contract address: ${to}`,
                `OffchainLookup sender address: ${sender}`,
            ],
            name: 'OffchainLookupSenderMismatchError',
        });
    }
}

const offchainLookupSignature = '0x556f1830';
const offchainLookupAbiItem = {
    name: 'OffchainLookup',
    type: 'error',
    inputs: [
        {
            name: 'sender',
            type: 'address',
        },
        {
            name: 'urls',
            type: 'string[]',
        },
        {
            name: 'callData',
            type: 'bytes',
        },
        {
            name: 'callbackFunction',
            type: 'bytes4',
        },
        {
            name: 'extraData',
            type: 'bytes',
        },
    ],
};
async function offchainLookup(client, { blockNumber, blockTag, data, to, }) {
    const { args } = decodeErrorResult({
        data,
        abi: [offchainLookupAbiItem],
    });
    const [sender, urls, callData, callbackSelector, extraData] = args;
    const { ccipRead } = client;
    const ccipRequest_ = ccipRead && typeof ccipRead?.request === 'function'
        ? ccipRead.request
        : ccipRequest;
    try {
        if (!isAddressEqual(to, sender))
            throw new OffchainLookupSenderMismatchError({ sender, to });
        const result = urls.includes(localBatchGatewayUrl)
            ? await localBatchGatewayRequest({
                data: callData,
                ccipRequest: ccipRequest_,
            })
            : await ccipRequest_({ data: callData, sender, urls });
        const { data: data_ } = await call(client, {
            blockNumber,
            blockTag,
            data: concat$1([
                callbackSelector,
                encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes' }], [result, extraData]),
            ]),
            to,
        });
        return data_;
    }
    catch (err) {
        throw new OffchainLookupError({
            callbackSelector,
            cause: err,
            data,
            extraData,
            sender,
            urls,
        });
    }
}
async function ccipRequest({ data, sender, urls, }) {
    let error = new Error('An unknown error occurred.');
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const method = url.includes('{data}') ? 'GET' : 'POST';
        const body = method === 'POST' ? { data, sender } : undefined;
        const headers = method === 'POST' ? { 'Content-Type': 'application/json' } : {};
        try {
            const response = await fetch(url.replace('{sender}', sender.toLowerCase()).replace('{data}', data), {
                body: JSON.stringify(body),
                headers,
                method,
            });
            let result;
            if (response.headers.get('Content-Type')?.startsWith('application/json')) {
                result = (await response.json()).data;
            }
            else {
                result = (await response.text());
            }
            if (!response.ok) {
                error = new HttpRequestError({
                    body,
                    details: result?.error
                        ? stringify$1(result.error)
                        : response.statusText,
                    headers: response.headers,
                    status: response.status,
                    url,
                });
                continue;
            }
            if (!isHex(result)) {
                error = new OffchainLookupResponseMalformedError({
                    result,
                    url,
                });
                continue;
            }
            return result;
        }
        catch (err) {
            error = new HttpRequestError({
                body,
                details: err.message,
                url,
            });
        }
    }
    throw error;
}

var ccip = /*#__PURE__*/Object.freeze({
  __proto__: null,
  ccipRequest: ccipRequest,
  offchainLookup: offchainLookup,
  offchainLookupAbiItem: offchainLookupAbiItem,
  offchainLookupSignature: offchainLookupSignature
});

function defineChain(chain) {
    const chainInstance = {
        formatters: undefined,
        fees: undefined,
        serializers: undefined,
        ...chain,
    };
    function extend(base) {
        return (fnOrExtended) => {
            const properties = (typeof fnOrExtended === 'function' ? fnOrExtended(base) : fnOrExtended);
            const combined = { ...base, ...properties };
            return Object.assign(combined, { extend: extend(combined) });
        };
    }
    return Object.assign(chainInstance, {
        extend: extend(chainInstance),
    });
}

function withTimeout(fn, { errorInstance = new Error('timed out'), timeout, signal, }) {
    return new Promise((resolve, reject) => {
        (async () => {
            let timeoutId;
            try {
                const controller = new AbortController();
                if (timeout > 0) {
                    timeoutId = setTimeout(() => {
                        if (signal) {
                            controller.abort();
                        }
                        else {
                            reject(errorInstance);
                        }
                    }, timeout); // need to cast because bun globals.d.ts overrides @types/node
                }
                resolve(await fn({ signal: controller?.signal || null }));
            }
            catch (err) {
                if (err?.name === 'AbortError')
                    reject(errorInstance);
                reject(err);
            }
            finally {
                clearTimeout(timeoutId);
            }
        })();
    });
}

function createIdStore() {
    return {
        current: 0,
        take() {
            return this.current++;
        },
        reset() {
            this.current = 0;
        },
    };
}
const idCache = /*#__PURE__*/ createIdStore();

function getHttpRpcClient(url_, options = {}) {
    const { url, headers: headers_url } = parseUrl(url_);
    return {
        async request(params) {
            const { body, fetchFn = options.fetchFn ?? fetch, onRequest = options.onRequest, onResponse = options.onResponse, timeout = options.timeout ?? 10_000, } = params;
            const fetchOptions = {
                ...(options.fetchOptions ?? {}),
                ...(params.fetchOptions ?? {}),
            };
            const { headers, method, signal: signal_ } = fetchOptions;
            try {
                const response = await withTimeout(async ({ signal }) => {
                    const init = {
                        ...fetchOptions,
                        body: Array.isArray(body)
                            ? stringify$1(body.map((body) => ({
                                jsonrpc: '2.0',
                                id: body.id ?? idCache.take(),
                                ...body,
                            })))
                            : stringify$1({
                                jsonrpc: '2.0',
                                id: body.id ?? idCache.take(),
                                ...body,
                            }),
                        headers: {
                            ...headers_url,
                            'Content-Type': 'application/json',
                            ...headers,
                        },
                        method: method || 'POST',
                        signal: signal_ || (timeout > 0 ? signal : null),
                    };
                    const request = new Request(url, init);
                    const args = (await onRequest?.(request, init)) ?? { ...init, url };
                    const response = await fetchFn(args.url ?? url, args);
                    return response;
                }, {
                    errorInstance: new TimeoutError({ body, url }),
                    timeout,
                    signal: true,
                });
                if (onResponse)
                    await onResponse(response);
                let data;
                if (response.headers.get('Content-Type')?.startsWith('application/json'))
                    data = await response.json();
                else {
                    data = await response.text();
                    try {
                        data = JSON.parse(data || '{}');
                    }
                    catch (err) {
                        if (response.ok)
                            throw err;
                        data = { error: data };
                    }
                }
                if (!response.ok) {
                    throw new HttpRequestError({
                        body,
                        details: stringify$1(data.error) || response.statusText,
                        headers: response.headers,
                        status: response.status,
                        url,
                    });
                }
                return data;
            }
            catch (err) {
                if (err instanceof HttpRequestError)
                    throw err;
                if (err instanceof TimeoutError)
                    throw err;
                throw new HttpRequestError({
                    body,
                    cause: err,
                    url,
                });
            }
        },
    };
}
/** @internal */
function parseUrl(url_) {
    try {
        const url = new URL(url_);
        const result = (() => {
            // Handle Basic authentication credentials
            if (url.username) {
                const credentials = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
                url.username = '';
                url.password = '';
                return {
                    url: url.toString(),
                    headers: { Authorization: `Basic ${btoa(credentials)}` },
                };
            }
            return;
        })();
        return { url: url.toString(), ...result };
    }
    catch {
        return { url: url_ };
    }
}

const presignMessagePrefix = '\x19Ethereum Signed Message:\n';

function toPrefixedMessage(message_) {
    const message = (() => {
        if (typeof message_ === 'string')
            return stringToHex(message_);
        if (typeof message_.raw === 'string')
            return message_.raw;
        return bytesToHex$1(message_.raw);
    })();
    const prefix = stringToHex(`${presignMessagePrefix}${size$3(message)}`);
    return concat$1([prefix, message]);
}

function hashMessage(message, to_) {
    return keccak256$1(toPrefixedMessage(message), to_);
}

class InvalidDomainError extends BaseError$1 {
    constructor({ domain }) {
        super(`Invalid domain "${stringify$1(domain)}".`, {
            metaMessages: ['Must be a valid EIP-712 domain.'],
        });
    }
}
class InvalidPrimaryTypeError extends BaseError$1 {
    constructor({ primaryType, types, }) {
        super(`Invalid primary type \`${primaryType}\` must be one of \`${JSON.stringify(Object.keys(types))}\`.`, {
            docsPath: '/api/glossary/Errors#typeddatainvalidprimarytypeerror',
            metaMessages: ['Check that the primary type is a key in `types`.'],
        });
    }
}
class InvalidStructTypeError extends BaseError$1 {
    constructor({ type }) {
        super(`Struct type "${type}" is invalid.`, {
            metaMessages: ['Struct type must not be a Solidity type.'],
            name: 'InvalidStructTypeError',
        });
    }
}

function serializeTypedData(parameters) {
    const { domain: domain_, message: message_, primaryType, types, } = parameters;
    const normalizeData = (struct, data_) => {
        const data = { ...data_ };
        for (const param of struct) {
            const { name, type } = param;
            if (type === 'address')
                data[name] = data[name].toLowerCase();
        }
        return data;
    };
    const domain = (() => {
        if (!types.EIP712Domain)
            return {};
        if (!domain_)
            return {};
        return normalizeData(types.EIP712Domain, domain_);
    })();
    const message = (() => {
        if (primaryType === 'EIP712Domain')
            return undefined;
        return normalizeData(types[primaryType], message_);
    })();
    return stringify$1({ domain, message, primaryType, types });
}
function validateTypedData(parameters) {
    const { domain, message, primaryType, types } = parameters;
    const validateData = (struct, data) => {
        for (const param of struct) {
            const { name, type } = param;
            const value = data[name];
            const integerMatch = type.match(integerRegex$1);
            if (integerMatch &&
                (typeof value === 'number' || typeof value === 'bigint')) {
                const [_type, base, size_] = integerMatch;
                // If number cannot be cast to a sized hex value, it is out of range
                // and will throw.
                numberToHex(value, {
                    signed: base === 'int',
                    size: Number.parseInt(size_, 10) / 8,
                });
            }
            if (type === 'address' && typeof value === 'string' && !isAddress(value))
                throw new InvalidAddressError$1({ address: value });
            const bytesMatch = type.match(bytesRegex$1);
            if (bytesMatch) {
                const [_type, size_] = bytesMatch;
                if (size_ && size$3(value) !== Number.parseInt(size_, 10))
                    throw new BytesSizeMismatchError$1({
                        expectedSize: Number.parseInt(size_, 10),
                        givenSize: size$3(value),
                    });
            }
            const struct = types[type];
            if (struct) {
                validateReference(type);
                validateData(struct, value);
            }
        }
    };
    // Validate domain types.
    if (types.EIP712Domain && domain) {
        if (typeof domain !== 'object')
            throw new InvalidDomainError({ domain });
        validateData(types.EIP712Domain, domain);
    }
    // Validate message types.
    if (primaryType !== 'EIP712Domain') {
        if (types[primaryType])
            validateData(types[primaryType], message);
        else
            throw new InvalidPrimaryTypeError({ primaryType, types });
    }
}
function getTypesForEIP712Domain({ domain, }) {
    return [
        typeof domain?.name === 'string' && { name: 'name', type: 'string' },
        domain?.version && { name: 'version', type: 'string' },
        (typeof domain?.chainId === 'number' ||
            typeof domain?.chainId === 'bigint') && {
            name: 'chainId',
            type: 'uint256',
        },
        domain?.verifyingContract && {
            name: 'verifyingContract',
            type: 'address',
        },
        domain?.salt && { name: 'salt', type: 'bytes32' },
    ].filter(Boolean);
}
/** @internal */
function validateReference(type) {
    // Struct type must not be a Solidity type.
    if (type === 'address' ||
        type === 'bool' ||
        type === 'string' ||
        type.startsWith('bytes') ||
        type.startsWith('uint') ||
        type.startsWith('int'))
        throw new InvalidStructTypeError({ type });
}

// Implementation forked and adapted from https://github.com/MetaMask/eth-sig-util/blob/main/src/sign-typed-data.ts
function hashTypedData(parameters) {
    const { domain = {}, message, primaryType, } = parameters;
    const types = {
        EIP712Domain: getTypesForEIP712Domain({ domain }),
        ...parameters.types,
    };
    // Need to do a runtime validation check on addresses, byte ranges, integer ranges, etc
    // as we can't statically check this with TypeScript.
    validateTypedData({
        domain,
        message,
        primaryType,
        types,
    });
    const parts = ['0x1901'];
    if (domain)
        parts.push(hashDomain({
            domain,
            types: types,
        }));
    if (primaryType !== 'EIP712Domain')
        parts.push(hashStruct({
            data: message,
            primaryType,
            types: types,
        }));
    return keccak256$1(concat$1(parts));
}
function hashDomain({ domain, types, }) {
    return hashStruct({
        data: domain,
        primaryType: 'EIP712Domain',
        types: types,
    });
}
function hashStruct({ data, primaryType, types, }) {
    const encoded = encodeData$1({
        data: data,
        primaryType,
        types: types,
    });
    return keccak256$1(encoded);
}
function encodeData$1({ data, primaryType, types, }) {
    const encodedTypes = [{ type: 'bytes32' }];
    const encodedValues = [hashType({ primaryType, types })];
    for (const field of types[primaryType]) {
        const [type, value] = encodeField({
            types,
            name: field.name,
            type: field.type,
            value: data[field.name],
        });
        encodedTypes.push(type);
        encodedValues.push(value);
    }
    return encodeAbiParameters(encodedTypes, encodedValues);
}
function hashType({ primaryType, types, }) {
    const encodedHashType = toHex(encodeType({ primaryType, types }));
    return keccak256$1(encodedHashType);
}
function encodeType({ primaryType, types, }) {
    let result = '';
    const unsortedDeps = findTypeDependencies({ primaryType, types });
    unsortedDeps.delete(primaryType);
    const deps = [primaryType, ...Array.from(unsortedDeps).sort()];
    for (const type of deps) {
        result += `${type}(${types[type]
            .map(({ name, type: t }) => `${t} ${name}`)
            .join(',')})`;
    }
    return result;
}
function findTypeDependencies({ primaryType: primaryType_, types, }, results = new Set()) {
    const match = primaryType_.match(/^\w*/u);
    const primaryType = match?.[0];
    if (results.has(primaryType) || types[primaryType] === undefined) {
        return results;
    }
    results.add(primaryType);
    for (const field of types[primaryType]) {
        findTypeDependencies({ primaryType: field.type, types }, results);
    }
    return results;
}
function encodeField({ types, name, type, value, }) {
    if (types[type] !== undefined) {
        return [
            { type: 'bytes32' },
            keccak256$1(encodeData$1({ data: value, primaryType: type, types })),
        ];
    }
    if (type === 'bytes')
        return [{ type: 'bytes32' }, keccak256$1(value)];
    if (type === 'string')
        return [{ type: 'bytes32' }, keccak256$1(toHex(value))];
    if (type.lastIndexOf(']') === type.length - 1) {
        const parsedType = type.slice(0, type.lastIndexOf('['));
        const typeValuePairs = value.map((item) => encodeField({
            name,
            type: parsedType,
            types,
            value: item,
        }));
        return [
            { type: 'bytes32' },
            keccak256$1(encodeAbiParameters(typeValuePairs.map(([t]) => t), typeValuePairs.map(([, v]) => v))),
        ];
    }
    return [{ type }, value];
}

/**
 * @internal
 *
 * Map with a LRU (Least recently used) policy.
 * @see https://en.wikipedia.org/wiki/Cache_replacement_policies#LRU
 */
class LruMap extends Map {
    constructor(size) {
        super();
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.maxSize = size;
    }
    get(key) {
        const value = super.get(key);
        if (super.has(key) && value !== undefined) {
            this.delete(key);
            super.set(key, value);
        }
        return value;
    }
    set(key, value) {
        super.set(key, value);
        if (this.maxSize && this.size > this.maxSize) {
            const firstKey = this.keys().next().value;
            if (firstKey)
                this.delete(firstKey);
        }
        return this;
    }
}

const caches = {
    checksum: /*#__PURE__*/ new LruMap(8192),
};
const checksum$1 = caches.checksum;

/**
 * Utilities for hex, bytes, CSPRNG.
 * @module
 */
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
// node.js versions earlier than v19 don't declare it in global scope.
// For node.js, package.json#exports field mapping rewrites import
// from `crypto` to `cryptoNode`, which imports native module.
// Makes the utils un-importable in browsers without a bundler.
// Once node.js 18 is deprecated (2025-04-30), we can just drop the import.
/** Checks if something is Uint8Array. Be careful: nodejs Buffer will return true. */
function isBytes$1(a) {
    return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
}
/** Asserts something is positive integer. */
function anumber(n) {
    if (!Number.isSafeInteger(n) || n < 0)
        throw new Error('positive integer expected, got ' + n);
}
/** Asserts something is Uint8Array. */
function abytes$1(b, ...lengths) {
    if (!isBytes$1(b))
        throw new Error('Uint8Array expected');
    if (lengths.length > 0 && !lengths.includes(b.length))
        throw new Error('Uint8Array expected of length ' + lengths + ', got length=' + b.length);
}
/** Asserts a hash instance has not been destroyed / finished */
function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
        throw new Error('Hash instance has been destroyed');
    if (checkFinished && instance.finished)
        throw new Error('Hash#digest() has already been called');
}
/** Asserts output is properly-sized byte array */
function aoutput(out, instance) {
    abytes$1(out);
    const min = instance.outputLen;
    if (out.length < min) {
        throw new Error('digestInto() expects output buffer of length at least ' + min);
    }
}
/** Cast u8 / u16 / u32 to u32. */
function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
/** Zeroize a byte array. Warning: JS provides no guarantees. */
function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
        arrays[i].fill(0);
    }
}
/** Is current platform little-endian? Most are. Big-Endian platform: IBM */
const isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();
/** The byte swap operation for uint32 */
function byteSwap(word) {
    return (((word << 24) & 0xff000000) |
        ((word << 8) & 0xff0000) |
        ((word >>> 8) & 0xff00) |
        ((word >>> 24) & 0xff));
}
/** In place byte swap for Uint32Array */
function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = byteSwap(arr[i]);
    }
    return arr;
}
const swap32IfBE = isLE
    ? (u) => u
    : byteSwap32;
/**
 * Converts string to bytes using UTF8 encoding.
 * @example utf8ToBytes('abc') // Uint8Array.from([97, 98, 99])
 */
function utf8ToBytes(str) {
    if (typeof str !== 'string')
        throw new Error('string expected');
    return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
}
/**
 * Normalizes (non-hex) string or Uint8Array to Uint8Array.
 * Warning: when Uint8Array is passed, it would NOT get copied.
 * Keep in mind for future mutable operations.
 */
function toBytes(data) {
    if (typeof data === 'string')
        data = utf8ToBytes(data);
    abytes$1(data);
    return data;
}
/** For runtime check if class implements interface */
class Hash {
}
/** Wraps hash function, creating an interface on top of it */
function createHasher(hashCons) {
    const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
    const tmp = hashCons();
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = () => hashCons();
    return hashC;
}

/**
 * Internal helpers for u64. BigUint64Array is too slow as per 2025, so we implement it using Uint32Array.
 * @todo re-check https://issues.chromium.org/issues/42212588
 * @module
 */
const U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
const _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
    if (le)
        return { h: Number(n & U32_MASK64), l: Number((n >> _32n) & U32_MASK64) };
    return { h: Number((n >> _32n) & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i = 0; i < len; i++) {
        const { h, l } = fromBig(lst[i], le);
        [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
}
// Left rotate for Shift in [1, 32)
const rotlSH = (h, l, s) => (h << s) | (l >>> (32 - s));
const rotlSL = (h, l, s) => (l << s) | (h >>> (32 - s));
// Left rotate for Shift in (32, 64), NOTE: 32 is special case.
const rotlBH = (h, l, s) => (l << (s - 32)) | (h >>> (64 - s));
const rotlBL = (h, l, s) => (h << (s - 32)) | (l >>> (64 - s));

/**
 * SHA3 (keccak) hash function, based on a new "Sponge function" design.
 * Different from older hashes, the internal state is bigger than output size.
 *
 * Check out [FIPS-202](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf),
 * [Website](https://keccak.team/keccak.html),
 * [the differences between SHA-3 and Keccak](https://crypto.stackexchange.com/questions/15727/what-are-the-key-differences-between-the-draft-sha-3-standard-and-the-keccak-sub).
 *
 * Check out `sha3-addons` module for cSHAKE, k12, and others.
 * @module
 */
// No __PURE__ annotations in sha3 header:
// EVERYTHING is in fact used on every export.
// Various per round constants calculations
const _0n$5 = BigInt(0);
const _1n$5 = BigInt(1);
const _2n$2 = BigInt(2);
const _7n = BigInt(7);
const _256n = BigInt(256);
const _0x71n = BigInt(0x71);
const SHA3_PI = [];
const SHA3_ROTL = [];
const _SHA3_IOTA = [];
for (let round = 0, R = _1n$5, x = 1, y = 0; round < 24; round++) {
    // Pi
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI.push(2 * (5 * y + x));
    // Rotational
    SHA3_ROTL.push((((round + 1) * (round + 2)) / 2) % 64);
    // Iota
    let t = _0n$5;
    for (let j = 0; j < 7; j++) {
        R = ((R << _1n$5) ^ ((R >> _7n) * _0x71n)) % _256n;
        if (R & _2n$2)
            t ^= _1n$5 << ((_1n$5 << /* @__PURE__ */ BigInt(j)) - _1n$5);
    }
    _SHA3_IOTA.push(t);
}
const IOTAS = split(_SHA3_IOTA, true);
const SHA3_IOTA_H = IOTAS[0];
const SHA3_IOTA_L = IOTAS[1];
// Left rotation (without 0, 32, 64)
const rotlH = (h, l, s) => (s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s));
const rotlL = (h, l, s) => (s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s));
/** `keccakf1600` internal function, additionally allows to adjust round count. */
function keccakP(s, rounds = 24) {
    const B = new Uint32Array(5 * 2);
    // NOTE: all indices are x2 since we store state as u32 instead of u64 (bigints to slow in js)
    for (let round = 24 - rounds; round < 24; round++) {
        // Theta θ
        for (let x = 0; x < 10; x++)
            B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
        for (let x = 0; x < 10; x += 2) {
            const idx1 = (x + 8) % 10;
            const idx0 = (x + 2) % 10;
            const B0 = B[idx0];
            const B1 = B[idx0 + 1];
            const Th = rotlH(B0, B1, 1) ^ B[idx1];
            const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
            for (let y = 0; y < 50; y += 10) {
                s[x + y] ^= Th;
                s[x + y + 1] ^= Tl;
            }
        }
        // Rho (ρ) and Pi (π)
        let curH = s[2];
        let curL = s[3];
        for (let t = 0; t < 24; t++) {
            const shift = SHA3_ROTL[t];
            const Th = rotlH(curH, curL, shift);
            const Tl = rotlL(curH, curL, shift);
            const PI = SHA3_PI[t];
            curH = s[PI];
            curL = s[PI + 1];
            s[PI] = Th;
            s[PI + 1] = Tl;
        }
        // Chi (χ)
        for (let y = 0; y < 50; y += 10) {
            for (let x = 0; x < 10; x++)
                B[x] = s[y + x];
            for (let x = 0; x < 10; x++)
                s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
        }
        // Iota (ι)
        s[0] ^= SHA3_IOTA_H[round];
        s[1] ^= SHA3_IOTA_L[round];
    }
    clean(B);
}
/** Keccak sponge function. */
class Keccak extends Hash {
    // NOTE: we accept arguments in bytes instead of bits here.
    constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        super();
        this.pos = 0;
        this.posOut = 0;
        this.finished = false;
        this.destroyed = false;
        this.enableXOF = false;
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.rounds = rounds;
        // Can be passed from user as dkLen
        anumber(outputLen);
        // 1600 = 5x5 matrix of 64bit.  1600 bits === 200 bytes
        // 0 < blockLen < 200
        if (!(0 < blockLen && blockLen < 200))
            throw new Error('only keccak-f1600 function is supported');
        this.state = new Uint8Array(200);
        this.state32 = u32(this.state);
    }
    clone() {
        return this._cloneInto();
    }
    keccak() {
        swap32IfBE(this.state32);
        keccakP(this.state32, this.rounds);
        swap32IfBE(this.state32);
        this.posOut = 0;
        this.pos = 0;
    }
    update(data) {
        aexists(this);
        data = toBytes(data);
        abytes$1(data);
        const { blockLen, state } = this;
        const len = data.length;
        for (let pos = 0; pos < len;) {
            const take = Math.min(blockLen - this.pos, len - pos);
            for (let i = 0; i < take; i++)
                state[this.pos++] ^= data[pos++];
            if (this.pos === blockLen)
                this.keccak();
        }
        return this;
    }
    finish() {
        if (this.finished)
            return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        // Do the padding
        state[pos] ^= suffix;
        if ((suffix & 0x80) !== 0 && pos === blockLen - 1)
            this.keccak();
        state[blockLen - 1] ^= 0x80;
        this.keccak();
    }
    writeInto(out) {
        aexists(this, false);
        abytes$1(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len;) {
            if (this.posOut >= blockLen)
                this.keccak();
            const take = Math.min(blockLen - this.posOut, len - pos);
            out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
            this.posOut += take;
            pos += take;
        }
        return out;
    }
    xofInto(out) {
        // Sha3/Keccak usage with XOF is probably mistake, only SHAKE instances can do XOF
        if (!this.enableXOF)
            throw new Error('XOF is not possible for this instance');
        return this.writeInto(out);
    }
    xof(bytes) {
        anumber(bytes);
        return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
        aoutput(out, this);
        if (this.finished)
            throw new Error('digest() was already called');
        this.writeInto(out);
        this.destroy();
        return out;
    }
    digest() {
        return this.digestInto(new Uint8Array(this.outputLen));
    }
    destroy() {
        this.destroyed = true;
        clean(this.state);
    }
    _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to || (to = new Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        // Suffix can change in cSHAKE
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        to.destroyed = this.destroyed;
        return to;
    }
}
const gen = (suffix, blockLen, outputLen) => createHasher(() => new Keccak(blockLen, suffix, outputLen));
/** keccak-256 hash function. Different from SHA3-256. */
const keccak_256 = /* @__PURE__ */ (() => gen(0x01, 136, 256 / 8))();

/**
 * Calculates the [Keccak256](https://en.wikipedia.org/wiki/SHA-3) hash of a {@link ox#Bytes.Bytes} or {@link ox#Hex.Hex} value.
 *
 * This function is a re-export of `keccak_256` from [`@noble/hashes`](https://github.com/paulmillr/noble-hashes), an audited & minimal JS hashing library.
 *
 * @example
 * ```ts twoslash
 * import { Hash } from 'ox'
 *
 * Hash.keccak256('0xdeadbeef')
 * // @log: '0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1'
 * ```
 *
 * @example
 * ### Calculate Hash of a String
 *
 * ```ts twoslash
 * import { Hash, Hex } from 'ox'
 *
 * Hash.keccak256(Hex.fromString('hello world'))
 * // @log: '0x3ea2f1d0abf3fc66cf29eebb70cbd4e7fe762ef8a09bcc06c8edf641230afec0'
 * ```
 *
 * @example
 * ### Configure Return Type
 *
 * ```ts twoslash
 * import { Hash } from 'ox'
 *
 * Hash.keccak256('0xdeadbeef', { as: 'Bytes' })
 * // @log: Uint8Array [...]
 * ```
 *
 * @param value - {@link ox#Bytes.Bytes} or {@link ox#Hex.Hex} value.
 * @param options - Options.
 * @returns Keccak256 hash.
 */
function keccak256(value, options = {}) {
    const { as = typeof value === 'string' ? 'Hex' : 'Bytes' } = options;
    const bytes = keccak_256(from$7(value));
    if (as === 'Bytes')
        return bytes;
    return fromBytes$1(bytes);
}

const addressRegex = /^0x[a-fA-F0-9]{40}$/;
/**
 * Asserts that the given value is a valid {@link ox#Address.Address}.
 *
 * @example
 * ```ts twoslash
 * import { Address } from 'ox'
 *
 * Address.assert('0xA0Cf798816D4b9b9866b5330EEa46a18382f251e')
 * ```
 *
 * @example
 * ```ts twoslash
 * import { Address } from 'ox'
 *
 * Address.assert('0xdeadbeef')
 * // @error: InvalidAddressError: Address "0xdeadbeef" is invalid.
 * ```
 *
 * @param value - Value to assert if it is a valid address.
 * @param options - Assertion options.
 */
function assert$3(value, options = {}) {
    const { strict = true } = options;
    if (!addressRegex.test(value))
        throw new InvalidAddressError({
            address: value,
            cause: new InvalidInputError(),
        });
    if (strict) {
        if (value.toLowerCase() === value)
            return;
        if (checksum(value) !== value)
            throw new InvalidAddressError({
                address: value,
                cause: new InvalidChecksumError(),
            });
    }
}
/**
 * Computes the checksum address for the given {@link ox#Address.Address}.
 *
 * @example
 * ```ts twoslash
 * import { Address } from 'ox'
 *
 * Address.checksum('0xa0cf798816d4b9b9866b5330eea46a18382f251e')
 * // @log: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e'
 * ```
 *
 * @param address - The address to compute the checksum for.
 * @returns The checksummed address.
 */
function checksum(address) {
    if (checksum$1.has(address))
        return checksum$1.get(address);
    assert$3(address, { strict: false });
    const hexAddress = address.substring(2).toLowerCase();
    const hash = keccak256(fromString$1(hexAddress), { as: 'Bytes' });
    const characters = hexAddress.split('');
    for (let i = 0; i < 40; i += 2) {
        if (hash[i >> 1] >> 4 >= 8 && characters[i]) {
            characters[i] = characters[i].toUpperCase();
        }
        if ((hash[i >> 1] & 0x0f) >= 8 && characters[i + 1]) {
            characters[i + 1] = characters[i + 1].toUpperCase();
        }
    }
    const result = `0x${characters.join('')}`;
    checksum$1.set(address, result);
    return result;
}
/**
 * Checks if the given address is a valid {@link ox#Address.Address}.
 *
 * @example
 * ```ts twoslash
 * import { Address } from 'ox'
 *
 * Address.validate('0xA0Cf798816D4b9b9866b5330EEa46a18382f251e')
 * // @log: true
 * ```
 *
 * @example
 * ```ts twoslash
 * import { Address } from 'ox'
 *
 * Address.validate('0xdeadbeef')
 * // @log: false
 * ```
 *
 * @param address - Value to check if it is a valid address.
 * @param options - Check options.
 * @returns Whether the address is a valid address.
 */
function validate$2(address, options = {}) {
    const { strict = true } = options ?? {};
    try {
        assert$3(address, { strict });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Thrown when an address is invalid.
 *
 * @example
 * ```ts twoslash
 * import { Address } from 'ox'
 *
 * Address.from('0x123')
 * // @error: Address.InvalidAddressError: Address `0x123` is invalid.
 * ```
 */
class InvalidAddressError extends BaseError {
    constructor({ address, cause }) {
        super(`Address "${address}" is invalid.`, {
            cause,
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Address.InvalidAddressError'
        });
    }
}
/** Thrown when an address is not a 20 byte (40 hexadecimal character) value. */
class InvalidInputError extends BaseError {
    constructor() {
        super('Address is not a 20 byte (40 hexadecimal character) value.');
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Address.InvalidInputError'
        });
    }
}
/** Thrown when an address does not match its checksum counterpart. */
class InvalidChecksumError extends BaseError {
    constructor() {
        super('Address does not match its checksum counterpart.');
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Address.InvalidChecksumError'
        });
    }
}

const arrayRegex = /^(.*)\[([0-9]*)\]$/;
// `bytes<M>`: binary type of `M` bytes, `0 < M <= 32`
// https://regexr.com/6va55
const bytesRegex = /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/;
// `(u)int<M>`: (un)signed integer type of `M` bits, `0 < M <= 256`, `M % 8 == 0`
// https://regexr.com/6v8hp
const integerRegex = /^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;
const maxUint256 = 2n ** 256n - 1n;

/** @internal */
function decodeParameter(cursor, param, options) {
    const { checksumAddress, staticPosition } = options;
    const arrayComponents = getArrayComponents(param.type);
    if (arrayComponents) {
        const [length, type] = arrayComponents;
        return decodeArray(cursor, { ...param, type }, { checksumAddress, length, staticPosition });
    }
    if (param.type === 'tuple')
        return decodeTuple(cursor, param, {
            checksumAddress,
            staticPosition,
        });
    if (param.type === 'address')
        return decodeAddress(cursor, { checksum: checksumAddress });
    if (param.type === 'bool')
        return decodeBool(cursor);
    if (param.type.startsWith('bytes'))
        return decodeBytes(cursor, param, { staticPosition });
    if (param.type.startsWith('uint') || param.type.startsWith('int'))
        return decodeNumber(cursor, param);
    if (param.type === 'string')
        return decodeString(cursor, { staticPosition });
    throw new InvalidTypeError(param.type);
}
const sizeOfLength = 32;
const sizeOfOffset = 32;
/** @internal */
function decodeAddress(cursor, options = {}) {
    const { checksum: checksum$1 = false } = options;
    const value = cursor.readBytes(32);
    const wrap = (address) => checksum$1 ? checksum(address) : address;
    return [wrap(fromBytes$1(slice$1(value, -20))), 32];
}
/** @internal */
function decodeArray(cursor, param, options) {
    const { checksumAddress, length, staticPosition } = options;
    // If the length of the array is not known in advance (dynamic array),
    // this means we will need to wonder off to the pointer and decode.
    if (!length) {
        // Dealing with a dynamic type, so get the offset of the array data.
        const offset = toNumber$1(cursor.readBytes(sizeOfOffset));
        // Start is the static position of current slot + offset.
        const start = staticPosition + offset;
        const startOfData = start + sizeOfLength;
        // Get the length of the array from the offset.
        cursor.setPosition(start);
        const length = toNumber$1(cursor.readBytes(sizeOfLength));
        // Check if the array has any dynamic children.
        const dynamicChild = hasDynamicChild(param);
        let consumed = 0;
        const value = [];
        for (let i = 0; i < length; ++i) {
            // If any of the children is dynamic, then all elements will be offset pointer, thus size of one slot (32 bytes).
            // Otherwise, elements will be the size of their encoding (consumed bytes).
            cursor.setPosition(startOfData + (dynamicChild ? i * 32 : consumed));
            const [data, consumed_] = decodeParameter(cursor, param, {
                checksumAddress,
                staticPosition: startOfData,
            });
            consumed += consumed_;
            value.push(data);
        }
        // As we have gone wondering, restore to the original position + next slot.
        cursor.setPosition(staticPosition + 32);
        return [value, 32];
    }
    // If the length of the array is known in advance,
    // and the length of an element deeply nested in the array is not known,
    // we need to decode the offset of the array data.
    if (hasDynamicChild(param)) {
        // Dealing with dynamic types, so get the offset of the array data.
        const offset = toNumber$1(cursor.readBytes(sizeOfOffset));
        // Start is the static position of current slot + offset.
        const start = staticPosition + offset;
        const value = [];
        for (let i = 0; i < length; ++i) {
            // Move cursor along to the next slot (next offset pointer).
            cursor.setPosition(start + i * 32);
            const [data] = decodeParameter(cursor, param, {
                checksumAddress,
                staticPosition: start,
            });
            value.push(data);
        }
        // As we have gone wondering, restore to the original position + next slot.
        cursor.setPosition(staticPosition + 32);
        return [value, 32];
    }
    // If the length of the array is known in advance and the array is deeply static,
    // then we can just decode each element in sequence.
    let consumed = 0;
    const value = [];
    for (let i = 0; i < length; ++i) {
        const [data, consumed_] = decodeParameter(cursor, param, {
            checksumAddress,
            staticPosition: staticPosition + consumed,
        });
        consumed += consumed_;
        value.push(data);
    }
    return [value, consumed];
}
/** @internal */
function decodeBool(cursor) {
    return [toBoolean(cursor.readBytes(32), { size: 32 }), 32];
}
/** @internal */
function decodeBytes(cursor, param, { staticPosition }) {
    const [_, size] = param.type.split('bytes');
    if (!size) {
        // Dealing with dynamic types, so get the offset of the bytes data.
        const offset = toNumber$1(cursor.readBytes(32));
        // Set position of the cursor to start of bytes data.
        cursor.setPosition(staticPosition + offset);
        const length = toNumber$1(cursor.readBytes(32));
        // If there is no length, we have zero data.
        if (length === 0) {
            // As we have gone wondering, restore to the original position + next slot.
            cursor.setPosition(staticPosition + 32);
            return ['0x', 32];
        }
        const data = cursor.readBytes(length);
        // As we have gone wondering, restore to the original position + next slot.
        cursor.setPosition(staticPosition + 32);
        return [fromBytes$1(data), 32];
    }
    const value = fromBytes$1(cursor.readBytes(Number.parseInt(size, 10), 32));
    return [value, 32];
}
/** @internal */
function decodeNumber(cursor, param) {
    const signed = param.type.startsWith('int');
    const size = Number.parseInt(param.type.split('int')[1] || '256', 10);
    const value = cursor.readBytes(32);
    return [
        size > 48
            ? toBigInt$1(value, { signed })
            : toNumber$1(value, { signed }),
        32,
    ];
}
/** @internal */
function decodeTuple(cursor, param, options) {
    const { checksumAddress, staticPosition } = options;
    // Tuples can have unnamed components (i.e. they are arrays), so we must
    // determine whether the tuple is named or unnamed. In the case of a named
    // tuple, the value will be an object where each property is the name of the
    // component. In the case of an unnamed tuple, the value will be an array.
    const hasUnnamedChild = param.components.length === 0 || param.components.some(({ name }) => !name);
    // Initialize the value to an object or an array, depending on whether the
    // tuple is named or unnamed.
    const value = hasUnnamedChild ? [] : {};
    let consumed = 0;
    // If the tuple has a dynamic child, we must first decode the offset to the
    // tuple data.
    if (hasDynamicChild(param)) {
        // Dealing with dynamic types, so get the offset of the tuple data.
        const offset = toNumber$1(cursor.readBytes(sizeOfOffset));
        // Start is the static position of referencing slot + offset.
        const start = staticPosition + offset;
        for (let i = 0; i < param.components.length; ++i) {
            const component = param.components[i];
            cursor.setPosition(start + consumed);
            const [data, consumed_] = decodeParameter(cursor, component, {
                checksumAddress,
                staticPosition: start,
            });
            consumed += consumed_;
            value[hasUnnamedChild ? i : component?.name] = data;
        }
        // As we have gone wondering, restore to the original position + next slot.
        cursor.setPosition(staticPosition + 32);
        return [value, 32];
    }
    // If the tuple has static children, we can just decode each component
    // in sequence.
    for (let i = 0; i < param.components.length; ++i) {
        const component = param.components[i];
        const [data, consumed_] = decodeParameter(cursor, component, {
            checksumAddress,
            staticPosition,
        });
        value[hasUnnamedChild ? i : component?.name] = data;
        consumed += consumed_;
    }
    return [value, consumed];
}
/** @internal */
function decodeString(cursor, { staticPosition }) {
    // Get offset to start of string data.
    const offset = toNumber$1(cursor.readBytes(32));
    // Start is the static position of current slot + offset.
    const start = staticPosition + offset;
    cursor.setPosition(start);
    const length = toNumber$1(cursor.readBytes(32));
    // If there is no length, we have zero data (empty string).
    if (length === 0) {
        cursor.setPosition(staticPosition + 32);
        return ['', 32];
    }
    const data = cursor.readBytes(length, 32);
    const value = toString(trimLeft(data));
    // As we have gone wondering, restore to the original position + next slot.
    cursor.setPosition(staticPosition + 32);
    return [value, 32];
}
/** @internal */
function prepareParameters({ checksumAddress, parameters, values, }) {
    const preparedParameters = [];
    for (let i = 0; i < parameters.length; i++) {
        preparedParameters.push(prepareParameter({
            checksumAddress,
            parameter: parameters[i],
            value: values[i],
        }));
    }
    return preparedParameters;
}
/** @internal */
function prepareParameter({ checksumAddress = false, parameter: parameter_, value, }) {
    const parameter = parameter_;
    const arrayComponents = getArrayComponents(parameter.type);
    if (arrayComponents) {
        const [length, type] = arrayComponents;
        return encodeArray(value, {
            checksumAddress,
            length,
            parameter: {
                ...parameter,
                type,
            },
        });
    }
    if (parameter.type === 'tuple') {
        return encodeTuple(value, {
            checksumAddress,
            parameter: parameter,
        });
    }
    if (parameter.type === 'address') {
        return encodeAddress(value, {
            checksum: checksumAddress,
        });
    }
    if (parameter.type === 'bool') {
        return encodeBoolean(value);
    }
    if (parameter.type.startsWith('uint') || parameter.type.startsWith('int')) {
        const signed = parameter.type.startsWith('int');
        const [, , size = '256'] = integerRegex.exec(parameter.type) ?? [];
        return encodeNumber(value, {
            signed,
            size: Number(size),
        });
    }
    if (parameter.type.startsWith('bytes')) {
        return encodeBytes(value, { type: parameter.type });
    }
    if (parameter.type === 'string') {
        return encodeString(value);
    }
    throw new InvalidTypeError(parameter.type);
}
/** @internal */
function encode$2(preparedParameters) {
    // 1. Compute the size of the static part of the parameters.
    let staticSize = 0;
    for (let i = 0; i < preparedParameters.length; i++) {
        const { dynamic, encoded } = preparedParameters[i];
        if (dynamic)
            staticSize += 32;
        else
            staticSize += size$1(encoded);
    }
    // 2. Split the parameters into static and dynamic parts.
    const staticParameters = [];
    const dynamicParameters = [];
    let dynamicSize = 0;
    for (let i = 0; i < preparedParameters.length; i++) {
        const { dynamic, encoded } = preparedParameters[i];
        if (dynamic) {
            staticParameters.push(fromNumber(staticSize + dynamicSize, { size: 32 }));
            dynamicParameters.push(encoded);
            dynamicSize += size$1(encoded);
        }
        else {
            staticParameters.push(encoded);
        }
    }
    // 3. Concatenate static and dynamic parts.
    return concat(...staticParameters, ...dynamicParameters);
}
/** @internal */
function encodeAddress(value, options) {
    const { checksum = false } = options;
    assert$3(value, { strict: checksum });
    return {
        dynamic: false,
        encoded: padLeft(value.toLowerCase()),
    };
}
/** @internal */
function encodeArray(value, options) {
    const { checksumAddress, length, parameter } = options;
    const dynamic = length === null;
    if (!Array.isArray(value))
        throw new InvalidArrayError(value);
    if (!dynamic && value.length !== length)
        throw new ArrayLengthMismatchError({
            expectedLength: length,
            givenLength: value.length,
            type: `${parameter.type}[${length}]`,
        });
    let dynamicChild = false;
    const preparedParameters = [];
    for (let i = 0; i < value.length; i++) {
        const preparedParam = prepareParameter({
            checksumAddress,
            parameter,
            value: value[i],
        });
        if (preparedParam.dynamic)
            dynamicChild = true;
        preparedParameters.push(preparedParam);
    }
    if (dynamic || dynamicChild) {
        const data = encode$2(preparedParameters);
        if (dynamic) {
            const length = fromNumber(preparedParameters.length, { size: 32 });
            return {
                dynamic: true,
                encoded: preparedParameters.length > 0 ? concat(length, data) : length,
            };
        }
        if (dynamicChild)
            return { dynamic: true, encoded: data };
    }
    return {
        dynamic: false,
        encoded: concat(...preparedParameters.map(({ encoded }) => encoded)),
    };
}
/** @internal */
function encodeBytes(value, { type }) {
    const [, parametersize] = type.split('bytes');
    const bytesSize = size$1(value);
    if (!parametersize) {
        let value_ = value;
        // If the size is not divisible by 32 bytes, pad the end
        // with empty bytes to the ceiling 32 bytes.
        if (bytesSize % 32 !== 0)
            value_ = padRight(value_, Math.ceil((value.length - 2) / 2 / 32) * 32);
        return {
            dynamic: true,
            encoded: concat(padLeft(fromNumber(bytesSize, { size: 32 })), value_),
        };
    }
    if (bytesSize !== Number.parseInt(parametersize, 10))
        throw new BytesSizeMismatchError({
            expectedSize: Number.parseInt(parametersize, 10),
            value,
        });
    return { dynamic: false, encoded: padRight(value) };
}
/** @internal */
function encodeBoolean(value) {
    if (typeof value !== 'boolean')
        throw new BaseError(`Invalid boolean value: "${value}" (type: ${typeof value}). Expected: \`true\` or \`false\`.`);
    return { dynamic: false, encoded: padLeft(fromBoolean(value)) };
}
/** @internal */
function encodeNumber(value, { signed, size }) {
    if (typeof size === 'number') {
        const max = 2n ** (BigInt(size) - (signed ? 1n : 0n)) - 1n;
        const min = signed ? -max - 1n : 0n;
        if (value > max || value < min)
            throw new IntegerOutOfRangeError({
                max: max.toString(),
                min: min.toString(),
                signed,
                size: size / 8,
                value: value.toString(),
            });
    }
    return {
        dynamic: false,
        encoded: fromNumber(value, {
            size: 32,
            signed,
        }),
    };
}
/** @internal */
function encodeString(value) {
    const hexValue = fromString(value);
    const partsLength = Math.ceil(size$1(hexValue) / 32);
    const parts = [];
    for (let i = 0; i < partsLength; i++) {
        parts.push(padRight(slice(hexValue, i * 32, (i + 1) * 32)));
    }
    return {
        dynamic: true,
        encoded: concat(padRight(fromNumber(size$1(hexValue), { size: 32 })), ...parts),
    };
}
/** @internal */
function encodeTuple(value, options) {
    const { checksumAddress, parameter } = options;
    let dynamic = false;
    const preparedParameters = [];
    for (let i = 0; i < parameter.components.length; i++) {
        const param_ = parameter.components[i];
        const index = Array.isArray(value) ? i : param_.name;
        const preparedParam = prepareParameter({
            checksumAddress,
            parameter: param_,
            value: value[index],
        });
        preparedParameters.push(preparedParam);
        if (preparedParam.dynamic)
            dynamic = true;
    }
    return {
        dynamic,
        encoded: dynamic
            ? encode$2(preparedParameters)
            : concat(...preparedParameters.map(({ encoded }) => encoded)),
    };
}
/** @internal */
function getArrayComponents(type) {
    const matches = type.match(/^(.*)\[(\d+)?\]$/);
    return matches
        ? // Return `null` if the array is dynamic.
            [matches[2] ? Number(matches[2]) : null, matches[1]]
        : undefined;
}
/** @internal */
function hasDynamicChild(param) {
    const { type } = param;
    if (type === 'string')
        return true;
    if (type === 'bytes')
        return true;
    if (type.endsWith('[]'))
        return true;
    if (type === 'tuple')
        return param.components?.some(hasDynamicChild);
    const arrayComponents = getArrayComponents(param.type);
    if (arrayComponents &&
        hasDynamicChild({
            ...param,
            type: arrayComponents[1],
        }))
        return true;
    return false;
}

const staticCursor = {
    bytes: new Uint8Array(),
    dataView: new DataView(new ArrayBuffer(0)),
    position: 0,
    positionReadCount: new Map(),
    recursiveReadCount: 0,
    recursiveReadLimit: Number.POSITIVE_INFINITY,
    assertReadLimit() {
        if (this.recursiveReadCount >= this.recursiveReadLimit)
            throw new RecursiveReadLimitExceededError({
                count: this.recursiveReadCount + 1,
                limit: this.recursiveReadLimit,
            });
    },
    assertPosition(position) {
        if (position < 0 || position > this.bytes.length - 1)
            throw new PositionOutOfBoundsError({
                length: this.bytes.length,
                position,
            });
    },
    decrementPosition(offset) {
        if (offset < 0)
            throw new NegativeOffsetError({ offset });
        const position = this.position - offset;
        this.assertPosition(position);
        this.position = position;
    },
    getReadCount(position) {
        return this.positionReadCount.get(position || this.position) || 0;
    },
    incrementPosition(offset) {
        if (offset < 0)
            throw new NegativeOffsetError({ offset });
        const position = this.position + offset;
        this.assertPosition(position);
        this.position = position;
    },
    inspectByte(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position);
        return this.bytes[position];
    },
    inspectBytes(length, position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + length - 1);
        return this.bytes.subarray(position, position + length);
    },
    inspectUint8(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position);
        return this.bytes[position];
    },
    inspectUint16(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + 1);
        return this.dataView.getUint16(position);
    },
    inspectUint24(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + 2);
        return ((this.dataView.getUint16(position) << 8) +
            this.dataView.getUint8(position + 2));
    },
    inspectUint32(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + 3);
        return this.dataView.getUint32(position);
    },
    pushByte(byte) {
        this.assertPosition(this.position);
        this.bytes[this.position] = byte;
        this.position++;
    },
    pushBytes(bytes) {
        this.assertPosition(this.position + bytes.length - 1);
        this.bytes.set(bytes, this.position);
        this.position += bytes.length;
    },
    pushUint8(value) {
        this.assertPosition(this.position);
        this.bytes[this.position] = value;
        this.position++;
    },
    pushUint16(value) {
        this.assertPosition(this.position + 1);
        this.dataView.setUint16(this.position, value);
        this.position += 2;
    },
    pushUint24(value) {
        this.assertPosition(this.position + 2);
        this.dataView.setUint16(this.position, value >> 8);
        this.dataView.setUint8(this.position + 2, value & ~4294967040);
        this.position += 3;
    },
    pushUint32(value) {
        this.assertPosition(this.position + 3);
        this.dataView.setUint32(this.position, value);
        this.position += 4;
    },
    readByte() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectByte();
        this.position++;
        return value;
    },
    readBytes(length, size) {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectBytes(length);
        this.position += size ?? length;
        return value;
    },
    readUint8() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint8();
        this.position += 1;
        return value;
    },
    readUint16() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint16();
        this.position += 2;
        return value;
    },
    readUint24() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint24();
        this.position += 3;
        return value;
    },
    readUint32() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint32();
        this.position += 4;
        return value;
    },
    get remaining() {
        return this.bytes.length - this.position;
    },
    setPosition(position) {
        const oldPosition = this.position;
        this.assertPosition(position);
        this.position = position;
        return () => (this.position = oldPosition);
    },
    _touch() {
        if (this.recursiveReadLimit === Number.POSITIVE_INFINITY)
            return;
        const count = this.getReadCount();
        this.positionReadCount.set(this.position, count + 1);
        if (count > 0)
            this.recursiveReadCount++;
    },
};
/** @internal */
function create(bytes, { recursiveReadLimit = 8_192 } = {}) {
    const cursor = Object.create(staticCursor);
    cursor.bytes = bytes;
    cursor.dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    cursor.positionReadCount = new Map();
    cursor.recursiveReadLimit = recursiveReadLimit;
    return cursor;
}
/** @internal */
class NegativeOffsetError extends BaseError {
    constructor({ offset }) {
        super(`Offset \`${offset}\` cannot be negative.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Cursor.NegativeOffsetError'
        });
    }
}
/** @internal */
class PositionOutOfBoundsError extends BaseError {
    constructor({ length, position }) {
        super(`Position \`${position}\` is out of bounds (\`0 < position < ${length}\`).`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Cursor.PositionOutOfBoundsError'
        });
    }
}
/** @internal */
class RecursiveReadLimitExceededError extends BaseError {
    constructor({ count, limit }) {
        super(`Recursive read limit of \`${limit}\` exceeded (recursive read count: \`${count}\`).`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Cursor.RecursiveReadLimitExceededError'
        });
    }
}

// eslint-disable-next-line jsdoc/require-jsdoc
function decode(parameters, data, options = {}) {
    const { as = 'Array', checksumAddress = false } = options;
    const bytes = typeof data === 'string' ? fromHex$1(data) : data;
    const cursor = create(bytes);
    if (size$2(bytes) === 0 && parameters.length > 0)
        throw new ZeroDataError();
    if (size$2(bytes) && size$2(bytes) < 32)
        throw new DataSizeTooSmallError({
            data: typeof data === 'string' ? data : fromBytes$1(data),
            parameters: parameters,
            size: size$2(bytes),
        });
    let consumed = 0;
    const values = as === 'Array' ? [] : {};
    for (let i = 0; i < parameters.length; ++i) {
        const param = parameters[i];
        cursor.setPosition(consumed);
        const [data, consumed_] = decodeParameter(cursor, param, {
            checksumAddress,
            staticPosition: 0,
        });
        consumed += consumed_;
        if (as === 'Array')
            values.push(data);
        else
            values[param.name ?? i] = data;
    }
    return values;
}
/**
 * Encodes primitive values into ABI encoded data as per the [Application Binary Interface (ABI) Specification](https://docs.soliditylang.org/en/latest/abi-spec).
 *
 * @example
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 *
 * const data = AbiParameters.encode(
 *   AbiParameters.from(['string', 'uint', 'bool']),
 *   ['wagmi', 420n, true],
 * )
 * ```
 *
 * @example
 * ### JSON Parameters
 *
 * Specify **JSON ABI** Parameters as schema:
 *
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 *
 * const data = AbiParameters.encode(
 *   [
 *     { type: 'string', name: 'name' },
 *     { type: 'uint', name: 'age' },
 *     { type: 'bool', name: 'isOwner' },
 *   ],
 *   ['wagmi', 420n, true],
 * )
 * ```
 *
 * @param parameters - The set of ABI parameters to encode, in the shape of the `inputs` or `outputs` attribute of an ABI Item. These parameters must include valid [ABI types](https://docs.soliditylang.org/en/latest/types.html).
 * @param values - The set of primitive values that correspond to the ABI types defined in `parameters`.
 * @returns ABI encoded data.
 */
function encode$1(parameters, values, options) {
    const { checksumAddress = false } = {};
    if (parameters.length !== values.length)
        throw new LengthMismatchError({
            expectedLength: parameters.length,
            givenLength: values.length,
        });
    // Prepare the parameters to determine dynamic types to encode.
    const preparedParameters = prepareParameters({
        checksumAddress,
        parameters: parameters,
        values: values,
    });
    const data = encode$2(preparedParameters);
    if (data.length === 0)
        return '0x';
    return data;
}
/**
 * Encodes an array of primitive values to a [packed ABI encoding](https://docs.soliditylang.org/en/latest/abi-spec.html#non-standard-packed-mode).
 *
 * @example
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 *
 * const encoded = AbiParameters.encodePacked(
 *   ['address', 'string'],
 *   ['0xd8da6bf26964af9d7eed9e03e53415d37aa96045', 'hello world'],
 * )
 * // @log: '0xd8da6bf26964af9d7eed9e03e53415d37aa9604568656c6c6f20776f726c64'
 * ```
 *
 * @param types - Set of ABI types to pack encode.
 * @param values - The set of primitive values that correspond to the ABI types defined in `types`.
 * @returns The encoded packed data.
 */
function encodePacked(types, values) {
    if (types.length !== values.length)
        throw new LengthMismatchError({
            expectedLength: types.length,
            givenLength: values.length,
        });
    const data = [];
    for (let i = 0; i < types.length; i++) {
        const type = types[i];
        const value = values[i];
        data.push(encodePacked.encode(type, value));
    }
    return concat(...data);
}
(function (encodePacked) {
    // eslint-disable-next-line jsdoc/require-jsdoc
    function encode(type, value, isArray = false) {
        if (type === 'address') {
            const address = value;
            assert$3(address);
            return padLeft(address.toLowerCase(), isArray ? 32 : 0);
        }
        if (type === 'string')
            return fromString(value);
        if (type === 'bytes')
            return value;
        if (type === 'bool')
            return padLeft(fromBoolean(value), isArray ? 32 : 1);
        const intMatch = type.match(integerRegex);
        if (intMatch) {
            const [_type, baseType, bits = '256'] = intMatch;
            const size = Number.parseInt(bits, 10) / 8;
            return fromNumber(value, {
                size: isArray ? 32 : size,
                signed: baseType === 'int',
            });
        }
        const bytesMatch = type.match(bytesRegex);
        if (bytesMatch) {
            const [_type, size] = bytesMatch;
            if (Number.parseInt(size, 10) !== (value.length - 2) / 2)
                throw new BytesSizeMismatchError({
                    expectedSize: Number.parseInt(size, 10),
                    value: value,
                });
            return padRight(value, isArray ? 32 : 0);
        }
        const arrayMatch = type.match(arrayRegex);
        if (arrayMatch && Array.isArray(value)) {
            const [_type, childType] = arrayMatch;
            const data = [];
            for (let i = 0; i < value.length; i++) {
                data.push(encode(childType, value[i], true));
            }
            if (data.length === 0)
                return '0x';
            return concat(...data);
        }
        throw new InvalidTypeError(type);
    }
    encodePacked.encode = encode;
})(encodePacked || (encodePacked = {}));
/**
 * Parses arbitrary **JSON ABI Parameters** or **Human Readable ABI Parameters** into typed {@link ox#AbiParameters.AbiParameters}.
 *
 * @example
 * ### JSON Parameters
 *
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 *
 * const parameters = AbiParameters.from([
 *   {
 *     name: 'spender',
 *     type: 'address',
 *   },
 *   {
 *     name: 'amount',
 *     type: 'uint256',
 *   },
 * ])
 *
 * parameters
 * //^?
 *
 *
 *
 *
 *
 *
 *
 * ```
 *
 * @example
 * ### Human Readable Parameters
 *
 * Human Readable ABI Parameters can be parsed into a typed {@link ox#AbiParameters.AbiParameters}:
 *
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 *
 * const parameters = AbiParameters.from('address spender, uint256 amount')
 *
 * parameters
 * //^?
 *
 *
 *
 *
 *
 *
 *
 * ```
 *
 * @example
 * It is possible to specify `struct`s along with your definitions:
 *
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 *
 * const parameters = AbiParameters.from([
 *   'struct Foo { address spender; uint256 amount; }', // [!code hl]
 *   'Foo foo, address bar',
 * ])
 *
 * parameters
 * //^?
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * ```
 *
 *
 *
 * @param parameters - The ABI Parameters to parse.
 * @returns The typed ABI Parameters.
 */
function from$5(parameters) {
    if (Array.isArray(parameters) && typeof parameters[0] === 'string')
        return parseAbiParameters(parameters);
    if (typeof parameters === 'string')
        return parseAbiParameters(parameters);
    return parameters;
}
/**
 * Throws when the data size is too small for the given parameters.
 *
 * @example
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 *
 * AbiParameters.decode([{ type: 'uint256' }], '0x010f')
 * //                                             ↑ ❌ 2 bytes
 * // @error: AbiParameters.DataSizeTooSmallError: Data size of 2 bytes is too small for given parameters.
 * // @error: Params: (uint256)
 * // @error: Data:   0x010f (2 bytes)
 * ```
 *
 * ### Solution
 *
 * Pass a valid data size.
 *
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 *
 * AbiParameters.decode([{ type: 'uint256' }], '0x00000000000000000000000000000000000000000000000000000000000010f')
 * //                                             ↑ ✅ 32 bytes
 * ```
 */
class DataSizeTooSmallError extends BaseError {
    constructor({ data, parameters, size, }) {
        super(`Data size of ${size} bytes is too small for given parameters.`, {
            metaMessages: [
                `Params: (${formatAbiParameters(parameters)})`,
                `Data:   ${data} (${size} bytes)`,
            ],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'AbiParameters.DataSizeTooSmallError'
        });
    }
}
/**
 * Throws when zero data is provided, but data is expected.
 *
 * @example
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 *
 * AbiParameters.decode([{ type: 'uint256' }], '0x')
 * //                                           ↑ ❌ zero data
 * // @error: AbiParameters.DataSizeTooSmallError: Data size of 2 bytes is too small for given parameters.
 * // @error: Params: (uint256)
 * // @error: Data:   0x010f (2 bytes)
 * ```
 *
 * ### Solution
 *
 * Pass valid data.
 *
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 *
 * AbiParameters.decode([{ type: 'uint256' }], '0x00000000000000000000000000000000000000000000000000000000000010f')
 * //                                             ↑ ✅ 32 bytes
 * ```
 */
class ZeroDataError extends BaseError {
    constructor() {
        super('Cannot decode zero data ("0x") with ABI parameters.');
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'AbiParameters.ZeroDataError'
        });
    }
}
/**
 * The length of the array value does not match the length specified in the corresponding ABI parameter.
 *
 * ### Example
 *
 * ```ts twoslash
 * // @noErrors
 * import { AbiParameters } from 'ox'
 * // ---cut---
 * AbiParameters.encode(AbiParameters.from('uint256[3]'), [[69n, 420n]])
 * //                                               ↑ expected: 3  ↑ ❌ length: 2
 * // @error: AbiParameters.ArrayLengthMismatchError: ABI encoding array length mismatch
 * // @error: for type `uint256[3]`. Expected: `3`. Given: `2`.
 * ```
 *
 * ### Solution
 *
 * Pass an array of the correct length.
 *
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 * // ---cut---
 * AbiParameters.encode(AbiParameters.from(['uint256[3]']), [[69n, 420n, 69n]])
 * //                                                         ↑ ✅ length: 3
 * ```
 */
class ArrayLengthMismatchError extends BaseError {
    constructor({ expectedLength, givenLength, type, }) {
        super(`Array length mismatch for type \`${type}\`. Expected: \`${expectedLength}\`. Given: \`${givenLength}\`.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'AbiParameters.ArrayLengthMismatchError'
        });
    }
}
/**
 * The size of the bytes value does not match the size specified in the corresponding ABI parameter.
 *
 * ### Example
 *
 * ```ts twoslash
 * // @noErrors
 * import { AbiParameters } from 'ox'
 * // ---cut---
 * AbiParameters.encode(AbiParameters.from('bytes8'), [['0xdeadbeefdeadbeefdeadbeef']])
 * //                                            ↑ expected: 8 bytes  ↑ ❌ size: 12 bytes
 * // @error: BytesSizeMismatchError: Size of bytes "0xdeadbeefdeadbeefdeadbeef"
 * // @error: (bytes12) does not match expected size (bytes8).
 * ```
 *
 * ### Solution
 *
 * Pass a bytes value of the correct size.
 *
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 * // ---cut---
 * AbiParameters.encode(AbiParameters.from(['bytes8']), ['0xdeadbeefdeadbeef'])
 * //                                                       ↑ ✅ size: 8 bytes
 * ```
 */
class BytesSizeMismatchError extends BaseError {
    constructor({ expectedSize, value, }) {
        super(`Size of bytes "${value}" (bytes${size$1(value)}) does not match expected size (bytes${expectedSize}).`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'AbiParameters.BytesSizeMismatchError'
        });
    }
}
/**
 * The length of the values to encode does not match the length of the ABI parameters.
 *
 * ### Example
 *
 * ```ts twoslash
 * // @noErrors
 * import { AbiParameters } from 'ox'
 * // ---cut---
 * AbiParameters.encode(AbiParameters.from(['string', 'uint256']), ['hello'])
 * // @error: LengthMismatchError: ABI encoding params/values length mismatch.
 * // @error: Expected length (params): 2
 * // @error: Given length (values): 1
 * ```
 *
 * ### Solution
 *
 * Pass the correct number of values to encode.
 *
 * ### Solution
 *
 * Pass a [valid ABI type](https://docs.soliditylang.org/en/develop/abi-spec.html#types).
 */
class LengthMismatchError extends BaseError {
    constructor({ expectedLength, givenLength, }) {
        super([
            'ABI encoding parameters/values length mismatch.',
            `Expected length (parameters): ${expectedLength}`,
            `Given length (values): ${givenLength}`,
        ].join('\n'));
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'AbiParameters.LengthMismatchError'
        });
    }
}
/**
 * The value provided is not a valid array as specified in the corresponding ABI parameter.
 *
 * ### Example
 *
 * ```ts twoslash
 * // @noErrors
 * import { AbiParameters } from 'ox'
 * // ---cut---
 * AbiParameters.encode(AbiParameters.from(['uint256[3]']), [69])
 * ```
 *
 * ### Solution
 *
 * Pass an array value.
 */
class InvalidArrayError extends BaseError {
    constructor(value) {
        super(`Value \`${value}\` is not a valid array.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'AbiParameters.InvalidArrayError'
        });
    }
}
/**
 * Throws when the ABI parameter type is invalid.
 *
 * @example
 * ```ts twoslash
 * import { AbiParameters } from 'ox'
 *
 * AbiParameters.decode([{ type: 'lol' }], '0x00000000000000000000000000000000000000000000000000000000000010f')
 * //                             ↑ ❌ invalid type
 * // @error: AbiParameters.InvalidTypeError: Type `lol` is not a valid ABI Type.
 * ```
 */
class InvalidTypeError extends BaseError {
    constructor(type) {
        super(`Type \`${type}\` is not a valid ABI Type.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'AbiParameters.InvalidTypeError'
        });
    }
}

/**
 * Asserts that a Signature is valid.
 *
 * @example
 * ```ts twoslash
 * import { Signature } from 'ox'
 *
 * Signature.assert({
 *   r: -49782753348462494199823712700004552394425719014458918871452329774910450607807n,
 *   s: 33726695977844476214676913201140481102225469284307016937915595756355928419768n,
 *   yParity: 1,
 * })
 * // @error: InvalidSignatureRError:
 * // @error: Value `-549...n` is an invalid r value.
 * // @error: r must be a positive integer less than 2^256.
 * ```
 *
 * @param signature - The signature object to assert.
 */
function assert$2(signature, options = {}) {
    const { recovered } = options;
    if (typeof signature.r === 'undefined')
        throw new MissingPropertiesError({ signature });
    if (typeof signature.s === 'undefined')
        throw new MissingPropertiesError({ signature });
    if (recovered && typeof signature.yParity === 'undefined')
        throw new MissingPropertiesError({ signature });
    if (signature.r < 0n || signature.r > maxUint256)
        throw new InvalidRError({ value: signature.r });
    if (signature.s < 0n || signature.s > maxUint256)
        throw new InvalidSError({ value: signature.s });
    if (typeof signature.yParity === 'number' &&
        signature.yParity !== 0 &&
        signature.yParity !== 1)
        throw new InvalidYParityError({ value: signature.yParity });
}
/**
 * Deserializes a {@link ox#Bytes.Bytes} signature into a structured {@link ox#Signature.Signature}.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { Signature } from 'ox'
 *
 * Signature.fromBytes(new Uint8Array([128, 3, 131, ...]))
 * // @log: { r: 5231...n, s: 3522...n, yParity: 0 }
 * ```
 *
 * @param signature - The serialized signature.
 * @returns The deserialized {@link ox#Signature.Signature}.
 */
function fromBytes(signature) {
    return fromHex(fromBytes$1(signature));
}
/**
 * Deserializes a {@link ox#Hex.Hex} signature into a structured {@link ox#Signature.Signature}.
 *
 * @example
 * ```ts twoslash
 * import { Signature } from 'ox'
 *
 * Signature.fromHex('0x6e100a352ec6ad1b70802290e18aeed190704973570f3b8ed42cb9808e2ea6bf4a90a229a244495b41890987806fcbd2d5d23fc0dbe5f5256c2613c039d76db81c')
 * // @log: { r: 5231...n, s: 3522...n, yParity: 0 }
 * ```
 *
 * @param serialized - The serialized signature.
 * @returns The deserialized {@link ox#Signature.Signature}.
 */
function fromHex(signature) {
    if (signature.length !== 130 && signature.length !== 132)
        throw new InvalidSerializedSizeError({ signature });
    const r = BigInt(slice(signature, 0, 32));
    const s = BigInt(slice(signature, 32, 64));
    const yParity = (() => {
        const yParity = Number(`0x${signature.slice(130)}`);
        if (Number.isNaN(yParity))
            return undefined;
        try {
            return vToYParity(yParity);
        }
        catch {
            throw new InvalidYParityError({ value: yParity });
        }
    })();
    if (typeof yParity === 'undefined')
        return {
            r,
            s,
        };
    return {
        r,
        s,
        yParity,
    };
}
/**
 * Extracts a {@link ox#Signature.Signature} from an arbitrary object that may include signature properties.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { Signature } from 'ox'
 *
 * Signature.extract({
 *   baz: 'barry',
 *   foo: 'bar',
 *   r: 49782753348462494199823712700004552394425719014458918871452329774910450607807n,
 *   s: 33726695977844476214676913201140481102225469284307016937915595756355928419768n,
 *   yParity: 1,
 *   zebra: 'stripes',
 * })
 * // @log: {
 * // @log:   r: 49782753348462494199823712700004552394425719014458918871452329774910450607807n,
 * // @log:   s: 33726695977844476214676913201140481102225469284307016937915595756355928419768n,
 * // @log:   yParity: 1
 * // @log: }
 * ```
 *
 * @param value - The arbitrary object to extract the signature from.
 * @returns The extracted {@link ox#Signature.Signature}.
 */
function extract(value) {
    if (typeof value.r === 'undefined')
        return undefined;
    if (typeof value.s === 'undefined')
        return undefined;
    return from$4(value);
}
/**
 * Instantiates a typed {@link ox#Signature.Signature} object from a {@link ox#Signature.Signature}, {@link ox#Signature.Legacy}, {@link ox#Bytes.Bytes}, or {@link ox#Hex.Hex}.
 *
 * @example
 * ```ts twoslash
 * import { Signature } from 'ox'
 *
 * Signature.from({
 *   r: 49782753348462494199823712700004552394425719014458918871452329774910450607807n,
 *   s: 33726695977844476214676913201140481102225469284307016937915595756355928419768n,
 *   yParity: 1,
 * })
 * // @log: {
 * // @log:   r: 49782753348462494199823712700004552394425719014458918871452329774910450607807n,
 * // @log:   s: 33726695977844476214676913201140481102225469284307016937915595756355928419768n,
 * // @log:   yParity: 1
 * // @log: }
 * ```
 *
 * @example
 * ### From Serialized
 *
 * ```ts twoslash
 * import { Signature } from 'ox'
 *
 * Signature.from('0x6e100a352ec6ad1b70802290e18aeed190704973570f3b8ed42cb9808e2ea6bf4a90a229a244495b41890987806fcbd2d5d23fc0dbe5f5256c2613c039d76db801')
 * // @log: {
 * // @log:   r: 49782753348462494199823712700004552394425719014458918871452329774910450607807n,
 * // @log:   s: 33726695977844476214676913201140481102225469284307016937915595756355928419768n,
 * // @log:   yParity: 1,
 * // @log: }
 * ```
 *
 * @example
 * ### From Legacy
 *
 * ```ts twoslash
 * import { Signature } from 'ox'
 *
 * Signature.from({
 *   r: 47323457007453657207889730243826965761922296599680473886588287015755652701072n,
 *   s: 57228803202727131502949358313456071280488184270258293674242124340113824882788n,
 *   v: 27,
 * })
 * // @log: {
 * // @log:   r: 47323457007453657207889730243826965761922296599680473886588287015755652701072n,
 * // @log:   s: 57228803202727131502949358313456071280488184270258293674242124340113824882788n,
 * // @log:   yParity: 0
 * // @log: }
 * ```
 *
 * @param signature - The signature value to instantiate.
 * @returns The instantiated {@link ox#Signature.Signature}.
 */
function from$4(signature) {
    const signature_ = (() => {
        if (typeof signature === 'string')
            return fromHex(signature);
        if (signature instanceof Uint8Array)
            return fromBytes(signature);
        if (typeof signature.r === 'string')
            return fromRpc$1(signature);
        if (signature.v)
            return fromLegacy(signature);
        return {
            r: signature.r,
            s: signature.s,
            ...(typeof signature.yParity !== 'undefined'
                ? { yParity: signature.yParity }
                : {}),
        };
    })();
    assert$2(signature_);
    return signature_;
}
/**
 * Converts a {@link ox#Signature.Legacy} into a {@link ox#Signature.Signature}.
 *
 * @example
 * ```ts twoslash
 * import { Signature } from 'ox'
 *
 * const legacy = Signature.fromLegacy({ r: 1n, s: 2n, v: 28 })
 * // @log: { r: 1n, s: 2n, yParity: 1 }
 * ```
 *
 * @param signature - The {@link ox#Signature.Legacy} to convert.
 * @returns The converted {@link ox#Signature.Signature}.
 */
function fromLegacy(signature) {
    return {
        r: signature.r,
        s: signature.s,
        yParity: vToYParity(signature.v),
    };
}
/**
 * Converts a {@link ox#Signature.Rpc} into a {@link ox#Signature.Signature}.
 *
 * @example
 * ```ts twoslash
 * import { Signature } from 'ox'
 *
 * const signature = Signature.fromRpc({
 *   r: '0x635dc2033e60185bb36709c29c75d64ea51dfbd91c32ef4be198e4ceb169fb4d',
 *   s: '0x50c2667ac4c771072746acfdcf1f1483336dcca8bd2df47cd83175dbe60f0540',
 *   yParity: '0x0',
 * })
 * ```
 *
 * @param signature - The {@link ox#Signature.Rpc} to convert.
 * @returns The converted {@link ox#Signature.Signature}.
 */
function fromRpc$1(signature) {
    const yParity = (() => {
        const v = signature.v ? Number(signature.v) : undefined;
        let yParity = signature.yParity ? Number(signature.yParity) : undefined;
        if (typeof v === 'number' && typeof yParity !== 'number')
            yParity = vToYParity(v);
        if (typeof yParity !== 'number')
            throw new InvalidYParityError({ value: signature.yParity });
        return yParity;
    })();
    return {
        r: BigInt(signature.r),
        s: BigInt(signature.s),
        yParity,
    };
}
/**
 * Converts a ECDSA `v` value to a `yParity` value.
 *
 * @example
 * ```ts twoslash
 * import { Signature } from 'ox'
 *
 * const yParity = Signature.vToYParity(28)
 * // @log: 1
 * ```
 *
 * @param v - The ECDSA `v` value to convert.
 * @returns The `yParity` value.
 */
function vToYParity(v) {
    if (v === 0 || v === 27)
        return 0;
    if (v === 1 || v === 28)
        return 1;
    if (v >= 35)
        return v % 2 === 0 ? 1 : 0;
    throw new InvalidVError({ value: v });
}
/** Thrown when the serialized signature is of an invalid size. */
class InvalidSerializedSizeError extends BaseError {
    constructor({ signature }) {
        super(`Value \`${signature}\` is an invalid signature size.`, {
            metaMessages: [
                'Expected: 64 bytes or 65 bytes.',
                `Received ${size$1(from$6(signature))} bytes.`,
            ],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Signature.InvalidSerializedSizeError'
        });
    }
}
/** Thrown when the signature is missing either an `r`, `s`, or `yParity` property. */
class MissingPropertiesError extends BaseError {
    constructor({ signature }) {
        super(`Signature \`${stringify(signature)}\` is missing either an \`r\`, \`s\`, or \`yParity\` property.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Signature.MissingPropertiesError'
        });
    }
}
/** Thrown when the signature has an invalid `r` value. */
class InvalidRError extends BaseError {
    constructor({ value }) {
        super(`Value \`${value}\` is an invalid r value. r must be a positive integer less than 2^256.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Signature.InvalidRError'
        });
    }
}
/** Thrown when the signature has an invalid `s` value. */
class InvalidSError extends BaseError {
    constructor({ value }) {
        super(`Value \`${value}\` is an invalid s value. s must be a positive integer less than 2^256.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Signature.InvalidSError'
        });
    }
}
/** Thrown when the signature has an invalid `yParity` value. */
class InvalidYParityError extends BaseError {
    constructor({ value }) {
        super(`Value \`${value}\` is an invalid y-parity value. Y-parity must be 0 or 1.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Signature.InvalidYParityError'
        });
    }
}
/** Thrown when the signature has an invalid `v` value. */
class InvalidVError extends BaseError {
    constructor({ value }) {
        super(`Value \`${value}\` is an invalid v value. v must be 27, 28 or >=35.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'Signature.InvalidVError'
        });
    }
}

/**
 * Converts an [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) Authorization object into a typed {@link ox#Authorization.Authorization}.
 *
 * @example
 * An Authorization can be instantiated from an [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) Authorization tuple in object format.
 *
 * ```ts twoslash
 * import { Authorization } from 'ox'
 *
 * const authorization = Authorization.from({
 *   address: '0x1234567890abcdef1234567890abcdef12345678',
 *   chainId: 1,
 *   nonce: 69n,
 * })
 * ```
 *
 * @example
 * ### Attaching Signatures
 *
 * A {@link ox#Signature.Signature} can be attached with the `signature` option. The example below demonstrates signing
 * an Authorization with {@link ox#Secp256k1.(sign:function)}.
 *
 * ```ts twoslash
 * import { Authorization, Secp256k1 } from 'ox'
 *
 * const authorization = Authorization.from({
 *   address: '0xbe95c3f554e9fc85ec51be69a3d807a0d55bcf2c',
 *   chainId: 1,
 *   nonce: 40n,
 * })
 *
 * const signature = Secp256k1.sign({
 *   payload: Authorization.getSignPayload(authorization),
 *   privateKey: '0x...',
 * })
 *
 * const authorization_signed = Authorization.from(authorization, { signature }) // [!code focus]
 * ```
 *
 * @param authorization - An [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) Authorization tuple in object format.
 * @param options - Authorization options.
 * @returns The {@link ox#Authorization.Authorization}.
 */
function from$3(authorization, options = {}) {
    if (typeof authorization.chainId === 'string')
        return fromRpc(authorization);
    return { ...authorization, ...options.signature };
}
/**
 * Converts an {@link ox#Authorization.Rpc} to an {@link ox#Authorization.Authorization}.
 *
 * @example
 * ```ts twoslash
 * import { Authorization } from 'ox'
 *
 * const authorization = Authorization.fromRpc({
 *   address: '0x0000000000000000000000000000000000000000',
 *   chainId: '0x1',
 *   nonce: '0x1',
 *   r: '0x635dc2033e60185bb36709c29c75d64ea51dfbd91c32ef4be198e4ceb169fb4d',
 *   s: '0x50c2667ac4c771072746acfdcf1f1483336dcca8bd2df47cd83175dbe60f0540',
 *   yParity: '0x0',
 * })
 * ```
 *
 * @param authorization - The RPC-formatted Authorization.
 * @returns A signed {@link ox#Authorization.Authorization}.
 */
function fromRpc(authorization) {
    const { address, chainId, nonce } = authorization;
    const signature = extract(authorization);
    return {
        address,
        chainId: Number(chainId),
        nonce: BigInt(nonce),
        ...signature,
    };
}

/**
 * Magic bytes used to identify ERC-8010 wrapped signatures.
 */
const magicBytes$1 = '0x8010801080108010801080108010801080108010801080108010801080108010';
/** Suffix ABI parameters for the ERC-8010 wrapped signature. */
const suffixParameters = from$5('(uint256 chainId, address delegation, uint256 nonce, uint8 yParity, uint256 r, uint256 s), address to, bytes data');
/**
 * Asserts that the wrapped signature is valid.
 *
 * @example
 * ```ts twoslash
 * import { SignatureErc8010 } from 'ox/erc8010'
 *
 * SignatureErc8010.assert('0xdeadbeef')
 * // @error: InvalidWrappedSignatureError: Value `0xdeadbeef` is an invalid ERC-8010 wrapped signature.
 * ```
 *
 * @param value - The value to assert.
 */
function assert$1(value) {
    if (typeof value === 'string') {
        if (slice(value, -32) !== magicBytes$1)
            throw new InvalidWrappedSignatureError$1(value);
    }
    else
        assert$2(value.authorization);
}
/**
 * Unwraps an [ERC-8010 wrapped signature](https://github.com/jxom/ERCs/blob/16f7e3891fff2e1e9c25dea0485497739db8a816/ERCS/erc-8010.md) into its constituent parts.
 *
 * @example
 * ```ts twoslash
 * import { SignatureErc8010 } from 'ox/erc8010'
 *
 * const { authorization, data, signature } = SignatureErc8010.unwrap('0x...')
 * ```
 *
 * @param wrapped - Wrapped signature to unwrap.
 * @returns Unwrapped signature.
 */
function unwrap(wrapped) {
    assert$1(wrapped);
    const suffixLength = toNumber(slice(wrapped, -64, -32));
    const suffix = slice(wrapped, -suffixLength - 64, -64);
    const signature = slice(wrapped, 0, -suffixLength - 64);
    const [auth, to, data] = decode(suffixParameters, suffix);
    const authorization = from$3({
        address: auth.delegation,
        chainId: Number(auth.chainId),
        nonce: auth.nonce,
        yParity: auth.yParity,
        r: auth.r,
        s: auth.s,
    });
    return {
        authorization,
        signature,
        ...(data && data !== '0x' ? { data, to } : {}),
    };
}
/**
 * Validates a wrapped signature. Returns `true` if the wrapped signature is valid, `false` otherwise.
 *
 * @example
 * ```ts twoslash
 * import { SignatureErc8010 } from 'ox/erc8010'
 *
 * const valid = SignatureErc8010.validate('0xdeadbeef')
 * // @log: false
 * ```
 *
 * @param value - The value to validate.
 * @returns `true` if the value is valid, `false` otherwise.
 */
function validate$1(value) {
    try {
        assert$1(value);
        return true;
    }
    catch {
        return false;
    }
}
/** Thrown when the ERC-8010 wrapped signature is invalid. */
let InvalidWrappedSignatureError$1 = class InvalidWrappedSignatureError extends BaseError {
    constructor(wrapped) {
        super(`Value \`${wrapped}\` is an invalid ERC-8010 wrapped signature.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'SignatureErc8010.InvalidWrappedSignatureError'
        });
    }
};

function formatStorageProof(storageProof) {
    return storageProof.map((proof) => ({
        ...proof,
        value: BigInt(proof.value),
    }));
}
function formatProof(proof) {
    return {
        ...proof,
        balance: proof.balance ? BigInt(proof.balance) : undefined,
        nonce: proof.nonce ? hexToNumber$1(proof.nonce) : undefined,
        storageProof: proof.storageProof
            ? formatStorageProof(proof.storageProof)
            : undefined,
    };
}

/**
 * Returns the account and storage values of the specified account including the Merkle-proof.
 *
 * - Docs: https://viem.sh/docs/actions/public/getProof
 * - JSON-RPC Methods:
 *   - Calls [`eth_getProof`](https://eips.ethereum.org/EIPS/eip-1186)
 *
 * @param client - Client to use
 * @param parameters - {@link GetProofParameters}
 * @returns Proof data. {@link GetProofReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getProof } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const block = await getProof(client, {
 *  address: '0x...',
 *  storageKeys: ['0x...'],
 * })
 */
async function getProof(client, { address, blockNumber, blockTag: blockTag_, storageKeys, }) {
    const blockTag = blockTag_ ?? 'latest';
    const blockNumberHex = blockNumber !== undefined ? numberToHex(blockNumber) : undefined;
    const proof = await client.request({
        method: 'eth_getProof',
        params: [address, storageKeys, blockNumberHex || blockTag],
    });
    return formatProof(proof);
}

/**
 * Returns the value from a storage slot at a given address.
 *
 * - Docs: https://viem.sh/docs/contract/getStorageAt
 * - JSON-RPC Methods: [`eth_getStorageAt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getstorageat)
 *
 * @param client - Client to use
 * @param parameters - {@link GetStorageAtParameters}
 * @returns The value of the storage slot. {@link GetStorageAtReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getStorageAt } from 'viem/contract'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const code = await getStorageAt(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *   slot: toHex(0),
 * })
 */
async function getStorageAt(client, { address, blockNumber, blockTag = 'latest', slot }) {
    const blockNumberHex = blockNumber !== undefined ? numberToHex(blockNumber) : undefined;
    const data = await client.request({
        method: 'eth_getStorageAt',
        params: [address, slot, blockNumberHex || blockTag],
    });
    return data;
}

/**
 * Returns information about a [Transaction](https://viem.sh/docs/glossary/terms#transaction) given a hash or block identifier.
 *
 * - Docs: https://viem.sh/docs/actions/public/getTransaction
 * - Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_fetching-transactions
 * - JSON-RPC Methods: [`eth_getTransactionByHash`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionByHash)
 *
 * @param client - Client to use
 * @param parameters - {@link GetTransactionParameters}
 * @returns The transaction information. {@link GetTransactionReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getTransaction } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const transaction = await getTransaction(client, {
 *   hash: '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d',
 * })
 */
async function getTransaction(client, { blockHash, blockNumber, blockTag: blockTag_, hash, index, sender, nonce, }) {
    const blockTag = blockTag_ || 'latest';
    const blockNumberHex = blockNumber !== undefined ? numberToHex(blockNumber) : undefined;
    let transaction = null;
    if (hash) {
        transaction = await client.request({
            method: 'eth_getTransactionByHash',
            params: [hash],
        }, { dedupe: true });
    }
    else if (blockHash) {
        transaction = await client.request({
            method: 'eth_getTransactionByBlockHashAndIndex',
            params: [blockHash, numberToHex(index)],
        }, { dedupe: true });
    }
    else if ((blockNumberHex || blockTag) && typeof index === 'number') {
        transaction = await client.request({
            method: 'eth_getTransactionByBlockNumberAndIndex',
            params: [blockNumberHex || blockTag, numberToHex(index)],
        }, { dedupe: Boolean(blockNumberHex) });
    }
    else if (sender && typeof nonce === 'number') {
        transaction = await client.request({
            method: 'eth_getTransactionBySenderAndNonce',
            params: [sender, numberToHex(nonce)],
        }, { dedupe: true });
    }
    if (!transaction)
        throw new TransactionNotFoundError({
            blockHash,
            blockNumber,
            blockTag,
            hash,
            index,
        });
    const format = client.chain?.formatters?.transaction?.format || formatTransaction;
    return format(transaction, 'getTransaction');
}

/**
 * Returns the number of blocks passed (confirmations) since the transaction was processed on a block.
 *
 * - Docs: https://viem.sh/docs/actions/public/getTransactionConfirmations
 * - Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_fetching-transactions
 * - JSON-RPC Methods: [`eth_getTransactionConfirmations`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionConfirmations)
 *
 * @param client - Client to use
 * @param parameters - {@link GetTransactionConfirmationsParameters}
 * @returns The number of blocks passed since the transaction was processed. If confirmations is 0, then the Transaction has not been confirmed & processed yet. {@link GetTransactionConfirmationsReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getTransactionConfirmations } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const confirmations = await getTransactionConfirmations(client, {
 *   hash: '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d',
 * })
 */
async function getTransactionConfirmations(client, { hash, transactionReceipt }) {
    const [blockNumber, transaction] = await Promise.all([
        getAction(client, getBlockNumber, 'getBlockNumber')({}),
        hash
            ? getAction(client, getTransaction, 'getTransaction')({ hash })
            : undefined,
    ]);
    const transactionBlockNumber = transactionReceipt?.blockNumber || transaction?.blockNumber;
    if (!transactionBlockNumber)
        return 0n;
    return blockNumber - transactionBlockNumber + 1n;
}

/**
 * Returns the [Transaction Receipt](https://viem.sh/docs/glossary/terms#transaction-receipt) given a [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash.
 *
 * - Docs: https://viem.sh/docs/actions/public/getTransactionReceipt
 * - Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_fetching-transactions
 * - JSON-RPC Methods: [`eth_getTransactionReceipt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactionreceipt)
 *
 * @param client - Client to use
 * @param parameters - {@link GetTransactionReceiptParameters}
 * @returns The transaction receipt. {@link GetTransactionReceiptReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getTransactionReceipt } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const transactionReceipt = await getTransactionReceipt(client, {
 *   hash: '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d',
 * })
 */
async function getTransactionReceipt(client, { hash }) {
    const receipt = await client.request({
        method: 'eth_getTransactionReceipt',
        params: [hash],
    }, { dedupe: true });
    if (!receipt)
        throw new TransactionReceiptNotFoundError({ hash });
    const format = client.chain?.formatters?.transactionReceipt?.format ||
        formatTransactionReceipt;
    return format(receipt, 'getTransactionReceipt');
}

/**
 * Similar to [`readContract`](https://viem.sh/docs/contract/readContract), but batches up multiple functions on a contract in a single RPC call via the [`multicall3` contract](https://github.com/mds1/multicall).
 *
 * - Docs: https://viem.sh/docs/contract/multicall
 *
 * @param client - Client to use
 * @param parameters - {@link MulticallParameters}
 * @returns An array of results with accompanying status. {@link MulticallReturnType}
 *
 * @example
 * import { createPublicClient, http, parseAbi } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { multicall } from 'viem/contract'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const abi = parseAbi([
 *   'function balanceOf(address) view returns (uint256)',
 *   'function totalSupply() view returns (uint256)',
 * ])
 * const results = await multicall(client, {
 *   contracts: [
 *     {
 *       address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *       abi,
 *       functionName: 'balanceOf',
 *       args: ['0xA0Cf798816D4b9b9866b5330EEa46a18382f251e'],
 *     },
 *     {
 *       address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *       abi,
 *       functionName: 'totalSupply',
 *     },
 *   ],
 * })
 * // [{ result: 424122n, status: 'success' }, { result: 1000000n, status: 'success' }]
 */
async function multicall(client, parameters) {
    const { account, authorizationList, allowFailure = true, blockNumber, blockOverrides, blockTag, stateOverride, } = parameters;
    const contracts = parameters.contracts;
    const { batchSize = parameters.batchSize ?? 1024, deployless = parameters.deployless ?? false, } = typeof client.batch?.multicall === 'object' ? client.batch.multicall : {};
    const multicallAddress = (() => {
        if (parameters.multicallAddress)
            return parameters.multicallAddress;
        if (deployless)
            return null;
        if (client.chain) {
            return getChainContractAddress({
                blockNumber,
                chain: client.chain,
                contract: 'multicall3',
            });
        }
        throw new Error('client chain not configured. multicallAddress is required.');
    })();
    const chunkedCalls = [[]];
    let currentChunk = 0;
    let currentChunkSize = 0;
    for (let i = 0; i < contracts.length; i++) {
        const { abi, address, args, functionName } = contracts[i];
        try {
            const callData = encodeFunctionData({ abi, args, functionName });
            currentChunkSize += (callData.length - 2) / 2;
            // Check to see if we need to create a new chunk.
            if (
            // Check if batching is enabled.
            batchSize > 0 &&
                // Check if the current size of the batch exceeds the size limit.
                currentChunkSize > batchSize &&
                // Check if the current chunk is not already empty.
                chunkedCalls[currentChunk].length > 0) {
                currentChunk++;
                currentChunkSize = (callData.length - 2) / 2;
                chunkedCalls[currentChunk] = [];
            }
            chunkedCalls[currentChunk] = [
                ...chunkedCalls[currentChunk],
                {
                    allowFailure: true,
                    callData,
                    target: address,
                },
            ];
        }
        catch (err) {
            const error = getContractError(err, {
                abi,
                address,
                args,
                docsPath: '/docs/contract/multicall',
                functionName,
                sender: account,
            });
            if (!allowFailure)
                throw error;
            chunkedCalls[currentChunk] = [
                ...chunkedCalls[currentChunk],
                {
                    allowFailure: true,
                    callData: '0x',
                    target: address,
                },
            ];
        }
    }
    const aggregate3Results = await Promise.allSettled(chunkedCalls.map((calls) => getAction(client, readContract, 'readContract')({
        ...(multicallAddress === null
            ? { code: multicall3Bytecode }
            : { address: multicallAddress }),
        abi: multicall3Abi,
        account,
        args: [calls],
        authorizationList,
        blockNumber,
        blockOverrides,
        blockTag,
        functionName: 'aggregate3',
        stateOverride,
    })));
    const results = [];
    for (let i = 0; i < aggregate3Results.length; i++) {
        const result = aggregate3Results[i];
        // If an error occurred in a `readContract` invocation (ie. network error),
        // then append the failure reason to each contract result.
        if (result.status === 'rejected') {
            if (!allowFailure)
                throw result.reason;
            for (let j = 0; j < chunkedCalls[i].length; j++) {
                results.push({
                    status: 'failure',
                    error: result.reason,
                    result: undefined,
                });
            }
            continue;
        }
        // If the `readContract` call was successful, then decode the results.
        const aggregate3Result = result.value;
        for (let j = 0; j < aggregate3Result.length; j++) {
            // Extract the response from `readContract`
            const { returnData, success } = aggregate3Result[j];
            // Extract the request call data from the original call.
            const { callData } = chunkedCalls[i][j];
            // Extract the contract config for this call from the `contracts` argument
            // for decoding.
            const { abi, address, functionName, args } = contracts[results.length];
            try {
                if (callData === '0x')
                    throw new AbiDecodingZeroDataError();
                if (!success)
                    throw new RawContractError({ data: returnData });
                const result = decodeFunctionResult({
                    abi,
                    args,
                    data: returnData,
                    functionName,
                });
                results.push(allowFailure ? { result, status: 'success' } : result);
            }
            catch (err) {
                const error = getContractError(err, {
                    abi,
                    address,
                    args,
                    docsPath: '/docs/contract/multicall',
                    functionName,
                });
                if (!allowFailure)
                    throw error;
                results.push({ error, result: undefined, status: 'failure' });
            }
        }
    }
    if (results.length !== contracts.length)
        throw new BaseError$1('multicall results mismatch');
    return results;
}

/**
 * Simulates a set of calls on block(s) with optional block and state overrides.
 *
 * @example
 * ```ts
 * import { createClient, http, parseEther } from 'viem'
 * import { simulate } from 'viem/actions'
 * import { mainnet } from 'viem/chains'
 *
 * const client = createClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 *
 * const result = await simulate(client, {
 *   blocks: [{
 *     blockOverrides: {
 *       number: 69420n,
 *     },
 *     calls: [{
 *       {
 *         account: '0x5a0b54d5dc17e482fe8b0bdca5320161b95fb929',
 *         data: '0xdeadbeef',
 *         to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *       },
 *       {
 *         account: '0x5a0b54d5dc17e482fe8b0bdca5320161b95fb929',
 *         to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *         value: parseEther('1'),
 *       },
 *     }],
 *     stateOverrides: [{
 *       address: '0x5a0b54d5dc17e482fe8b0bdca5320161b95fb929',
 *       balance: parseEther('10'),
 *     }],
 *   }]
 * })
 * ```
 *
 * @param client - Client to use.
 * @param parameters - {@link SimulateBlocksParameters}
 * @returns Simulated blocks. {@link SimulateBlocksReturnType}
 */
async function simulateBlocks(client, parameters) {
    const { blockNumber, blockTag = client.experimental_blockTag ?? 'latest', blocks, returnFullTransactions, traceTransfers, validation, } = parameters;
    try {
        const blockStateCalls = [];
        for (const block of blocks) {
            const blockOverrides = block.blockOverrides
                ? toRpc(block.blockOverrides)
                : undefined;
            const calls = block.calls.map((call_) => {
                const call = call_;
                const account = call.account ? parseAccount(call.account) : undefined;
                const data = call.abi ? encodeFunctionData(call) : call.data;
                const request = {
                    ...call,
                    account,
                    data: call.dataSuffix
                        ? concat$1([data || '0x', call.dataSuffix])
                        : data,
                    from: call.from ?? account?.address,
                };
                assertRequest(request);
                return formatTransactionRequest(request);
            });
            const stateOverrides = block.stateOverrides
                ? serializeStateOverride(block.stateOverrides)
                : undefined;
            blockStateCalls.push({
                blockOverrides,
                calls,
                stateOverrides,
            });
        }
        const blockNumberHex = typeof blockNumber === 'bigint' ? numberToHex(blockNumber) : undefined;
        const block = blockNumberHex || blockTag;
        const result = await client.request({
            method: 'eth_simulateV1',
            params: [
                { blockStateCalls, returnFullTransactions, traceTransfers, validation },
                block,
            ],
        });
        return result.map((block, i) => ({
            ...formatBlock(block),
            calls: block.calls.map((call, j) => {
                const { abi, args, functionName, to } = blocks[i].calls[j];
                const data = call.error?.data ?? call.returnData;
                const gasUsed = BigInt(call.gasUsed);
                const logs = call.logs?.map((log) => formatLog(log));
                const status = call.status === '0x1' ? 'success' : 'failure';
                const result = abi && status === 'success' && data !== '0x'
                    ? decodeFunctionResult({
                        abi,
                        data,
                        functionName,
                    })
                    : null;
                const error = (() => {
                    if (status === 'success')
                        return undefined;
                    let error;
                    if (data === '0x')
                        error = new AbiDecodingZeroDataError();
                    else if (data)
                        error = new RawContractError({ data });
                    if (!error)
                        return undefined;
                    return getContractError(error, {
                        abi: (abi ?? []),
                        address: to ?? '0x',
                        args,
                        functionName: functionName ?? '<unknown>',
                    });
                })();
                return {
                    data,
                    gasUsed,
                    logs,
                    status,
                    ...(status === 'success'
                        ? {
                            result,
                        }
                        : {
                            error,
                        }),
                };
            }),
        }));
    }
    catch (e) {
        const cause = e;
        const error = getNodeError(cause, {});
        if (error instanceof UnknownNodeError)
            throw cause;
        throw error;
    }
}

/** @internal */
function normalizeSignature(signature) {
    let active = true;
    let current = '';
    let level = 0;
    let result = '';
    let valid = false;
    for (let i = 0; i < signature.length; i++) {
        const char = signature[i];
        // If the character is a separator, we want to reactivate.
        if (['(', ')', ','].includes(char))
            active = true;
        // If the character is a "level" token, we want to increment/decrement.
        if (char === '(')
            level++;
        if (char === ')')
            level--;
        // If we aren't active, we don't want to mutate the result.
        if (!active)
            continue;
        // If level === 0, we are at the definition level.
        if (level === 0) {
            if (char === ' ' && ['event', 'function', 'error', ''].includes(result))
                result = '';
            else {
                result += char;
                // If we are at the end of the definition, we must be finished.
                if (char === ')') {
                    valid = true;
                    break;
                }
            }
            continue;
        }
        // Ignore spaces
        if (char === ' ') {
            // If the previous character is a separator, and the current section isn't empty, we want to deactivate.
            if (signature[i - 1] !== ',' && current !== ',' && current !== ',(') {
                current = '';
                active = false;
            }
            continue;
        }
        result += char;
        current += char;
    }
    if (!valid)
        throw new BaseError('Unable to normalize signature.');
    return result;
}
/** @internal */
function isArgOfType(arg, abiParameter) {
    const argType = typeof arg;
    const abiParameterType = abiParameter.type;
    switch (abiParameterType) {
        case 'address':
            return validate$2(arg, { strict: false });
        case 'bool':
            return argType === 'boolean';
        case 'function':
            return argType === 'string';
        case 'string':
            return argType === 'string';
        default: {
            if (abiParameterType === 'tuple' && 'components' in abiParameter)
                return Object.values(abiParameter.components).every((component, index) => {
                    return isArgOfType(Object.values(arg)[index], component);
                });
            // `(u)int<M>`: (un)signed integer type of `M` bits, `0 < M <= 256`, `M % 8 == 0`
            // https://regexr.com/6v8hp
            if (/^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/.test(abiParameterType))
                return argType === 'number' || argType === 'bigint';
            // `bytes<M>`: binary type of `M` bytes, `0 < M <= 32`
            // https://regexr.com/6va55
            if (/^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/.test(abiParameterType))
                return argType === 'string' || arg instanceof Uint8Array;
            // fixed-length (`<type>[M]`) and dynamic (`<type>[]`) arrays
            // https://regexr.com/6va6i
            if (/[a-z]+[1-9]{0,3}(\[[0-9]{0,}\])+$/.test(abiParameterType)) {
                return (Array.isArray(arg) &&
                    arg.every((x) => isArgOfType(x, {
                        ...abiParameter,
                        // Pop off `[]` or `[M]` from end of type
                        type: abiParameterType.replace(/(\[[0-9]{0,}\])$/, ''),
                    })));
            }
            return false;
        }
    }
}
/** @internal */
function getAmbiguousTypes(sourceParameters, targetParameters, args) {
    for (const parameterIndex in sourceParameters) {
        const sourceParameter = sourceParameters[parameterIndex];
        const targetParameter = targetParameters[parameterIndex];
        if (sourceParameter.type === 'tuple' &&
            targetParameter.type === 'tuple' &&
            'components' in sourceParameter &&
            'components' in targetParameter)
            return getAmbiguousTypes(sourceParameter.components, targetParameter.components, args[parameterIndex]);
        const types = [sourceParameter.type, targetParameter.type];
        const ambiguous = (() => {
            if (types.includes('address') && types.includes('bytes20'))
                return true;
            if (types.includes('address') && types.includes('string'))
                return validate$2(args[parameterIndex], {
                    strict: false,
                });
            if (types.includes('address') && types.includes('bytes'))
                return validate$2(args[parameterIndex], {
                    strict: false,
                });
            return false;
        })();
        if (ambiguous)
            return types;
    }
    return;
}

/**
 * Parses an arbitrary **JSON ABI Item** or **Human Readable ABI Item** into a typed {@link ox#AbiItem.AbiItem}.
 *
 * @example
 * ### JSON ABIs
 *
 * ```ts twoslash
 * import { AbiItem } from 'ox'
 *
 * const abiItem = AbiItem.from({
 *   type: 'function',
 *   name: 'approve',
 *   stateMutability: 'nonpayable',
 *   inputs: [
 *     {
 *       name: 'spender',
 *       type: 'address',
 *     },
 *     {
 *       name: 'amount',
 *       type: 'uint256',
 *     },
 *   ],
 *   outputs: [{ type: 'bool' }],
 * })
 *
 * abiItem
 * //^?
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * ```
 *
 * @example
 * ### Human Readable ABIs
 *
 * A Human Readable ABI can be parsed into a typed ABI object:
 *
 * ```ts twoslash
 * import { AbiItem } from 'ox'
 *
 * const abiItem = AbiItem.from(
 *   'function approve(address spender, uint256 amount) returns (bool)' // [!code hl]
 * )
 *
 * abiItem
 * //^?
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * ```
 *
 * @example
 * It is possible to specify `struct`s along with your definitions:
 *
 * ```ts twoslash
 * import { AbiItem } from 'ox'
 *
 * const abiItem = AbiItem.from([
 *   'struct Foo { address spender; uint256 amount; }', // [!code hl]
 *   'function approve(Foo foo) returns (bool)',
 * ])
 *
 * abiItem
 * //^?
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * ```
 *
 *
 *
 * @param abiItem - The ABI Item to parse.
 * @returns The typed ABI Item.
 */
function from$2(abiItem, options = {}) {
    const { prepare = true } = options;
    const item = (() => {
        if (Array.isArray(abiItem))
            return parseAbiItem(abiItem);
        if (typeof abiItem === 'string')
            return parseAbiItem(abiItem);
        return abiItem;
    })();
    return {
        ...item,
        ...(prepare ? { hash: getSignatureHash(item) } : {}),
    };
}
/**
 * Extracts an {@link ox#AbiItem.AbiItem} from an {@link ox#Abi.Abi} given a name and optional arguments.
 *
 * @example
 * ABI Items can be extracted by their name using the `name` option:
 *
 * ```ts twoslash
 * import { Abi, AbiItem } from 'ox'
 *
 * const abi = Abi.from([
 *   'function foo()',
 *   'event Transfer(address owner, address to, uint256 tokenId)',
 *   'function bar(string a) returns (uint256 x)',
 * ])
 *
 * const item = AbiItem.fromAbi(abi, 'Transfer') // [!code focus]
 * //    ^?
 *
 *
 *
 *
 *
 *
 * ```
 *
 * @example
 * ### Extracting by Selector
 *
 * ABI Items can be extract by their selector when {@link ox#Hex.Hex} is provided to `name`.
 *
 * ```ts twoslash
 * import { Abi, AbiItem } from 'ox'
 *
 * const abi = Abi.from([
 *   'function foo()',
 *   'event Transfer(address owner, address to, uint256 tokenId)',
 *   'function bar(string a) returns (uint256 x)',
 * ])
 * const item = AbiItem.fromAbi(abi, '0x095ea7b3') // [!code focus]
 * //    ^?
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * ```
 *
 * :::note
 *
 * Extracting via a hex selector is useful when extracting an ABI Item from an `eth_call` RPC response,
 * a Transaction `input`, or from Event Log `topics`.
 *
 * :::
 *
 * @param abi - The ABI to extract from.
 * @param name - The name (or selector) of the ABI item to extract.
 * @param options - Extraction options.
 * @returns The ABI item.
 */
function fromAbi$2(abi, name, options) {
    const { args = [], prepare = true } = (options ??
        {});
    const isSelector = validate$3(name, { strict: false });
    const abiItems = abi.filter((abiItem) => {
        if (isSelector) {
            if (abiItem.type === 'function' || abiItem.type === 'error')
                return getSelector$1(abiItem) === slice(name, 0, 4);
            if (abiItem.type === 'event')
                return getSignatureHash(abiItem) === name;
            return false;
        }
        return 'name' in abiItem && abiItem.name === name;
    });
    if (abiItems.length === 0)
        throw new NotFoundError({ name: name });
    if (abiItems.length === 1)
        return {
            ...abiItems[0],
            ...(prepare ? { hash: getSignatureHash(abiItems[0]) } : {}),
        };
    let matchedAbiItem;
    for (const abiItem of abiItems) {
        if (!('inputs' in abiItem))
            continue;
        if (!args || args.length === 0) {
            if (!abiItem.inputs || abiItem.inputs.length === 0)
                return {
                    ...abiItem,
                    ...(prepare ? { hash: getSignatureHash(abiItem) } : {}),
                };
            continue;
        }
        if (!abiItem.inputs)
            continue;
        if (abiItem.inputs.length === 0)
            continue;
        if (abiItem.inputs.length !== args.length)
            continue;
        const matched = args.every((arg, index) => {
            const abiParameter = 'inputs' in abiItem && abiItem.inputs[index];
            if (!abiParameter)
                return false;
            return isArgOfType(arg, abiParameter);
        });
        if (matched) {
            // Check for ambiguity against already matched parameters (e.g. `address` vs `bytes20`).
            if (matchedAbiItem &&
                'inputs' in matchedAbiItem &&
                matchedAbiItem.inputs) {
                const ambiguousTypes = getAmbiguousTypes(abiItem.inputs, matchedAbiItem.inputs, args);
                if (ambiguousTypes)
                    throw new AmbiguityError({
                        abiItem,
                        type: ambiguousTypes[0],
                    }, {
                        abiItem: matchedAbiItem,
                        type: ambiguousTypes[1],
                    });
            }
            matchedAbiItem = abiItem;
        }
    }
    const abiItem = (() => {
        if (matchedAbiItem)
            return matchedAbiItem;
        const [abiItem, ...overloads] = abiItems;
        return { ...abiItem, overloads };
    })();
    if (!abiItem)
        throw new NotFoundError({ name: name });
    return {
        ...abiItem,
        ...(prepare ? { hash: getSignatureHash(abiItem) } : {}),
    };
}
// eslint-disable-next-line jsdoc/require-jsdoc
function getSelector$1(...parameters) {
    const abiItem = (() => {
        if (Array.isArray(parameters[0])) {
            const [abi, name] = parameters;
            return fromAbi$2(abi, name);
        }
        return parameters[0];
    })();
    return slice(getSignatureHash(abiItem), 0, 4);
}
// eslint-disable-next-line jsdoc/require-jsdoc
function getSignature(...parameters) {
    const abiItem = (() => {
        if (Array.isArray(parameters[0])) {
            const [abi, name] = parameters;
            return fromAbi$2(abi, name);
        }
        return parameters[0];
    })();
    const signature = (() => {
        if (typeof abiItem === 'string')
            return abiItem;
        return formatAbiItem$1(abiItem);
    })();
    return normalizeSignature(signature);
}
// eslint-disable-next-line jsdoc/require-jsdoc
function getSignatureHash(...parameters) {
    const abiItem = (() => {
        if (Array.isArray(parameters[0])) {
            const [abi, name] = parameters;
            return fromAbi$2(abi, name);
        }
        return parameters[0];
    })();
    if (typeof abiItem !== 'string' && 'hash' in abiItem && abiItem.hash)
        return abiItem.hash;
    return keccak256(fromString(getSignature(abiItem)));
}
/**
 * Throws when ambiguous types are found on overloaded ABI items.
 *
 * @example
 * ```ts twoslash
 * import { Abi, AbiFunction } from 'ox'
 *
 * const foo = Abi.from(['function foo(address)', 'function foo(bytes20)'])
 * AbiFunction.fromAbi(foo, 'foo', {
 *   args: ['0xA0Cf798816D4b9b9866b5330EEa46a18382f251e'],
 * })
 * // @error: AbiItem.AmbiguityError: Found ambiguous types in overloaded ABI Items.
 * // @error: `bytes20` in `foo(bytes20)`, and
 * // @error: `address` in `foo(address)`
 * // @error: These types encode differently and cannot be distinguished at runtime.
 * // @error: Remove one of the ambiguous items in the ABI.
 * ```
 *
 * ### Solution
 *
 * Remove one of the ambiguous types from the ABI.
 *
 * ```ts twoslash
 * import { Abi, AbiFunction } from 'ox'
 *
 * const foo = Abi.from([
 *   'function foo(address)',
 *   'function foo(bytes20)' // [!code --]
 * ])
 * AbiFunction.fromAbi(foo, 'foo', {
 *   args: ['0xA0Cf798816D4b9b9866b5330EEa46a18382f251e'],
 * })
 * // @error: AbiItem.AmbiguityError: Found ambiguous types in overloaded ABI Items.
 * // @error: `bytes20` in `foo(bytes20)`, and
 * // @error: `address` in `foo(address)`
 * // @error: These types encode differently and cannot be distinguished at runtime.
 * // @error: Remove one of the ambiguous items in the ABI.
 * ```
 */
class AmbiguityError extends BaseError {
    constructor(x, y) {
        super('Found ambiguous types in overloaded ABI Items.', {
            metaMessages: [
                // TODO: abitype to add support for signature-formatted ABI items.
                `\`${x.type}\` in \`${normalizeSignature(formatAbiItem$1(x.abiItem))}\`, and`,
                `\`${y.type}\` in \`${normalizeSignature(formatAbiItem$1(y.abiItem))}\``,
                '',
                'These types encode differently and cannot be distinguished at runtime.',
                'Remove one of the ambiguous items in the ABI.',
            ],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'AbiItem.AmbiguityError'
        });
    }
}
/**
 * Throws when an ABI item is not found in the ABI.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { Abi, AbiFunction } from 'ox'
 *
 * const foo = Abi.from([
 *   'function foo(address)',
 *   'function bar(uint)'
 * ])
 * AbiFunction.fromAbi(foo, 'baz')
 * // @error: AbiItem.NotFoundError: ABI function with name "baz" not found.
 * ```
 *
 * ### Solution
 *
 * Ensure the ABI item exists on the ABI.
 *
 * ```ts twoslash
 * // @noErrors
 * import { Abi, AbiFunction } from 'ox'
 *
 * const foo = Abi.from([
 *   'function foo(address)',
 *   'function bar(uint)',
 *   'function baz(bool)' // [!code ++]
 * ])
 * AbiFunction.fromAbi(foo, 'baz')
 * ```
 */
class NotFoundError extends BaseError {
    constructor({ name, data, type = 'item', }) {
        const selector = (() => {
            if (name)
                return ` with name "${name}"`;
            if (data)
                return ` with data "${data}"`;
            return '';
        })();
        super(`ABI ${type}${selector} not found.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'AbiItem.NotFoundError'
        });
    }
}

// eslint-disable-next-line jsdoc/require-jsdoc
function encode(...parameters) {
    const [abiConstructor, options] = (() => {
        if (Array.isArray(parameters[0])) {
            const [abi, options] = parameters;
            return [fromAbi$1(abi), options];
        }
        return parameters;
    })();
    const { bytecode, args } = options;
    return concat(bytecode, abiConstructor.inputs?.length && args?.length
        ? encode$1(abiConstructor.inputs, args)
        : '0x');
}
/** @internal */
function from$1(abiConstructor) {
    return from$2(abiConstructor);
}
/** @internal */
function fromAbi$1(abi) {
    const item = abi.find((item) => item.type === 'constructor');
    if (!item)
        throw new NotFoundError({ name: 'constructor' });
    return item;
}

// eslint-disable-next-line jsdoc/require-jsdoc
function encodeData(...parameters) {
    const [abiFunction, args = []] = (() => {
        if (Array.isArray(parameters[0])) {
            const [abi, name, args] = parameters;
            return [fromAbi(abi, name, { args }), args];
        }
        const [abiFunction, args] = parameters;
        return [abiFunction, args];
    })();
    const { overloads } = abiFunction;
    const item = overloads
        ? fromAbi([abiFunction, ...overloads], abiFunction.name, {
            args,
        })
        : abiFunction;
    const selector = getSelector(item);
    const data = args.length > 0 ? encode$1(item.inputs, args) : undefined;
    return data ? concat(selector, data) : selector;
}
/**
 * Parses an arbitrary **JSON ABI Function** or **Human Readable ABI Function** into a typed {@link ox#AbiFunction.AbiFunction}.
 *
 * @example
 * ### JSON ABIs
 *
 * ```ts twoslash
 * import { AbiFunction } from 'ox'
 *
 * const approve = AbiFunction.from({
 *   type: 'function',
 *   name: 'approve',
 *   stateMutability: 'nonpayable',
 *   inputs: [
 *     {
 *       name: 'spender',
 *       type: 'address',
 *     },
 *     {
 *       name: 'amount',
 *       type: 'uint256',
 *     },
 *   ],
 *   outputs: [{ type: 'bool' }],
 * })
 *
 * approve
 * //^?
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * ```
 *
 * @example
 * ### Human Readable ABIs
 *
 * A Human Readable ABI can be parsed into a typed ABI object:
 *
 * ```ts twoslash
 * import { AbiFunction } from 'ox'
 *
 * const approve = AbiFunction.from(
 *   'function approve(address spender, uint256 amount) returns (bool)' // [!code hl]
 * )
 *
 * approve
 * //^?
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * ```
 *
 * @example
 * It is possible to specify `struct`s along with your definitions:
 *
 * ```ts twoslash
 * import { AbiFunction } from 'ox'
 *
 * const approve = AbiFunction.from([
 *   'struct Foo { address spender; uint256 amount; }', // [!code hl]
 *   'function approve(Foo foo) returns (bool)',
 * ])
 *
 * approve
 * //^?
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * ```
 *
 *
 *
 * @param abiFunction - The ABI Function to parse.
 * @returns Typed ABI Function.
 */
function from(abiFunction, options = {}) {
    return from$2(abiFunction, options);
}
/**
 * Extracts an {@link ox#AbiFunction.AbiFunction} from an {@link ox#Abi.Abi} given a name and optional arguments.
 *
 * @example
 * ### Extracting by Name
 *
 * ABI Functions can be extracted by their name using the `name` option:
 *
 * ```ts twoslash
 * import { Abi, AbiFunction } from 'ox'
 *
 * const abi = Abi.from([
 *   'function foo()',
 *   'event Transfer(address owner, address to, uint256 tokenId)',
 *   'function bar(string a) returns (uint256 x)',
 * ])
 *
 * const item = AbiFunction.fromAbi(abi, 'foo') // [!code focus]
 * //    ^?
 *
 *
 *
 *
 *
 *
 * ```
 *
 * @example
 * ### Extracting by Selector
 *
 * ABI Functions can be extract by their selector when {@link ox#Hex.Hex} is provided to `name`.
 *
 * ```ts twoslash
 * import { Abi, AbiFunction } from 'ox'
 *
 * const abi = Abi.from([
 *   'function foo()',
 *   'event Transfer(address owner, address to, uint256 tokenId)',
 *   'function bar(string a) returns (uint256 x)',
 * ])
 * const item = AbiFunction.fromAbi(abi, '0x095ea7b3') // [!code focus]
 * //    ^?
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * ```
 *
 * :::note
 *
 * Extracting via a hex selector is useful when extracting an ABI Function from an `eth_call` RPC response or
 * from a Transaction `input`.
 *
 * :::
 *
 * @param abi - The ABI to extract from.
 * @param name - The name (or selector) of the ABI item to extract.
 * @param options - Extraction options.
 * @returns The ABI item.
 */
function fromAbi(abi, name, options) {
    const item = fromAbi$2(abi, name, options);
    if (item.type !== 'function')
        throw new NotFoundError({ name, type: 'function' });
    return item;
}
/**
 * Computes the [4-byte selector](https://solidity-by-example.org/function-selector/) for an {@link ox#AbiFunction.AbiFunction}.
 *
 * Useful for computing function selectors for calldata.
 *
 * @example
 * ```ts twoslash
 * import { AbiFunction } from 'ox'
 *
 * const selector = AbiFunction.getSelector('function ownerOf(uint256 tokenId)')
 * // @log: '0x6352211e'
 * ```
 *
 * @example
 * ```ts twoslash
 * import { AbiFunction } from 'ox'
 *
 * const selector = AbiFunction.getSelector({
 *   inputs: [{ type: 'uint256' }],
 *   name: 'ownerOf',
 *   outputs: [],
 *   stateMutability: 'view',
 *   type: 'function'
 * })
 * // @log: '0x6352211e'
 * ```
 *
 * @param abiItem - The ABI item to compute the selector for.
 * @returns The first 4 bytes of the {@link ox#Hash.(keccak256:function)} hash of the function signature.
 */
function getSelector(abiItem) {
    return getSelector$1(abiItem);
}

const ethAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const zeroAddress = '0x0000000000000000000000000000000000000000';

const getBalanceCode = '0x6080604052348015600e575f80fd5b5061016d8061001c5f395ff3fe608060405234801561000f575f80fd5b5060043610610029575f3560e01c8063f8b2cb4f1461002d575b5f80fd5b610047600480360381019061004291906100db565b61005d565b604051610054919061011e565b60405180910390f35b5f8173ffffffffffffffffffffffffffffffffffffffff16319050919050565b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6100aa82610081565b9050919050565b6100ba816100a0565b81146100c4575f80fd5b50565b5f813590506100d5816100b1565b92915050565b5f602082840312156100f0576100ef61007d565b5b5f6100fd848285016100c7565b91505092915050565b5f819050919050565b61011881610106565b82525050565b5f6020820190506101315f83018461010f565b9291505056fea26469706673582212203b9fe929fe995c7cf9887f0bdba8a36dd78e8b73f149b17d2d9ad7cd09d2dc6264736f6c634300081a0033';
/**
 * Simulates execution of a batch of calls.
 *
 * @param client - Client to use
 * @param parameters - {@link SimulateCallsParameters}
 * @returns Results. {@link SimulateCallsReturnType}
 *
 * @example
 * ```ts
 * import { createPublicClient, http, parseEther } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { simulateCalls } from 'viem/actions'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 *
 * const result = await simulateCalls(client, {
 *   account: '0x5a0b54d5dc17e482fe8b0bdca5320161b95fb929',
 *   calls: [{
 *     {
 *       data: '0xdeadbeef',
 *       to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *     },
 *     {
 *       to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *       value: parseEther('1'),
 *     },
 *   ]
 * })
 * ```
 */
async function simulateCalls(client, parameters) {
    const { blockNumber, blockTag, calls, stateOverrides, traceAssetChanges, traceTransfers, validation, } = parameters;
    const account = parameters.account
        ? parseAccount(parameters.account)
        : undefined;
    if (traceAssetChanges && !account)
        throw new BaseError$1('`account` is required when `traceAssetChanges` is true');
    // Derive bytecode to extract ETH balance via a contract call.
    const getBalanceData = account
        ? encode(from$1('constructor(bytes, bytes)'), {
            bytecode: deploylessCallViaBytecodeBytecode,
            args: [
                getBalanceCode,
                encodeData(from('function getBalance(address)'), [account.address]),
            ],
        })
        : undefined;
    // Fetch ERC20/721 addresses that were "touched" from the calls.
    const assetAddresses = traceAssetChanges
        ? await Promise.all(parameters.calls.map(async (call) => {
            if (!call.data && !call.abi)
                return;
            const { accessList } = await createAccessList(client, {
                account: account.address,
                ...call,
                data: call.abi ? encodeFunctionData(call) : call.data,
            });
            return accessList.map(({ address, storageKeys }) => storageKeys.length > 0 ? address : null);
        })).then((x) => x.flat().filter(Boolean))
        : [];
    const blocks = await simulateBlocks(client, {
        blockNumber,
        blockTag: blockTag,
        blocks: [
            ...(traceAssetChanges
                ? [
                    // ETH pre balances
                    {
                        calls: [{ data: getBalanceData }],
                        stateOverrides,
                    },
                    // Asset pre balances
                    {
                        calls: assetAddresses.map((address, i) => ({
                            abi: [
                                from('function balanceOf(address) returns (uint256)'),
                            ],
                            functionName: 'balanceOf',
                            args: [account.address],
                            to: address,
                            from: zeroAddress,
                            nonce: i,
                        })),
                        stateOverrides: [
                            {
                                address: zeroAddress,
                                nonce: 0,
                            },
                        ],
                    },
                ]
                : []),
            {
                calls: [...calls, {}].map((call) => ({
                    ...call,
                    from: account?.address,
                })),
                stateOverrides,
            },
            ...(traceAssetChanges
                ? [
                    // ETH post balances
                    {
                        calls: [{ data: getBalanceData }],
                    },
                    // Asset post balances
                    {
                        calls: assetAddresses.map((address, i) => ({
                            abi: [
                                from('function balanceOf(address) returns (uint256)'),
                            ],
                            functionName: 'balanceOf',
                            args: [account.address],
                            to: address,
                            from: zeroAddress,
                            nonce: i,
                        })),
                        stateOverrides: [
                            {
                                address: zeroAddress,
                                nonce: 0,
                            },
                        ],
                    },
                    // Decimals
                    {
                        calls: assetAddresses.map((address, i) => ({
                            to: address,
                            abi: [
                                from('function decimals() returns (uint256)'),
                            ],
                            functionName: 'decimals',
                            from: zeroAddress,
                            nonce: i,
                        })),
                        stateOverrides: [
                            {
                                address: zeroAddress,
                                nonce: 0,
                            },
                        ],
                    },
                    // Token URI
                    {
                        calls: assetAddresses.map((address, i) => ({
                            to: address,
                            abi: [
                                from('function tokenURI(uint256) returns (string)'),
                            ],
                            functionName: 'tokenURI',
                            args: [0n],
                            from: zeroAddress,
                            nonce: i,
                        })),
                        stateOverrides: [
                            {
                                address: zeroAddress,
                                nonce: 0,
                            },
                        ],
                    },
                    // Symbols
                    {
                        calls: assetAddresses.map((address, i) => ({
                            to: address,
                            abi: [from('function symbol() returns (string)')],
                            functionName: 'symbol',
                            from: zeroAddress,
                            nonce: i,
                        })),
                        stateOverrides: [
                            {
                                address: zeroAddress,
                                nonce: 0,
                            },
                        ],
                    },
                ]
                : []),
        ],
        traceTransfers,
        validation,
    });
    const block_results = traceAssetChanges ? blocks[2] : blocks[0];
    const [block_ethPre, block_assetsPre, , block_ethPost, block_assetsPost, block_decimals, block_tokenURI, block_symbols,] = traceAssetChanges ? blocks : [];
    // Extract call results from the simulation.
    const { calls: block_calls, ...block } = block_results;
    const results = block_calls.slice(0, -1) ?? [];
    // Extract pre-execution ETH and asset balances.
    const ethPre = block_ethPre?.calls ?? [];
    const assetsPre = block_assetsPre?.calls ?? [];
    const balancesPre = [...ethPre, ...assetsPre].map((call) => call.status === 'success' ? hexToBigInt(call.data) : null);
    // Extract post-execution ETH and asset balances.
    const ethPost = block_ethPost?.calls ?? [];
    const assetsPost = block_assetsPost?.calls ?? [];
    const balancesPost = [...ethPost, ...assetsPost].map((call) => call.status === 'success' ? hexToBigInt(call.data) : null);
    // Extract asset symbols & decimals.
    const decimals = (block_decimals?.calls ?? []).map((x) => x.status === 'success' ? x.result : null);
    const symbols = (block_symbols?.calls ?? []).map((x) => x.status === 'success' ? x.result : null);
    const tokenURI = (block_tokenURI?.calls ?? []).map((x) => x.status === 'success' ? x.result : null);
    const changes = [];
    for (const [i, balancePost] of balancesPost.entries()) {
        const balancePre = balancesPre[i];
        if (typeof balancePost !== 'bigint')
            continue;
        if (typeof balancePre !== 'bigint')
            continue;
        const decimals_ = decimals[i - 1];
        const symbol_ = symbols[i - 1];
        const tokenURI_ = tokenURI[i - 1];
        const token = (() => {
            if (i === 0)
                return {
                    address: ethAddress,
                    decimals: 18,
                    symbol: 'ETH',
                };
            return {
                address: assetAddresses[i - 1],
                decimals: tokenURI_ || decimals_ ? Number(decimals_ ?? 1) : undefined,
                symbol: symbol_ ?? undefined,
            };
        })();
        if (changes.some((change) => change.token.address === token.address))
            continue;
        changes.push({
            token,
            value: {
                pre: balancePre,
                post: balancePost,
                diff: balancePost - balancePre,
            },
        });
    }
    return {
        assetChanges: changes,
        block,
        results,
    };
}

/**
 * Magic bytes used to identify ERC-6492 wrapped signatures.
 */
const magicBytes = '0x6492649264926492649264926492649264926492649264926492649264926492';
/**
 * Asserts that the wrapped signature is valid.
 *
 * @example
 * ```ts twoslash
 * import { SignatureErc6492 } from 'ox/erc6492'
 *
 * SignatureErc6492.assert('0xdeadbeef')
 * // @error: InvalidWrappedSignatureError: Value `0xdeadbeef` is an invalid ERC-6492 wrapped signature.
 * ```
 *
 * @param wrapped - The wrapped signature to assert.
 */
function assert(wrapped) {
    if (slice(wrapped, -32) !== magicBytes)
        throw new InvalidWrappedSignatureError(wrapped);
}
/**
 * Serializes an [ERC-6492 wrapped signature](https://eips.ethereum.org/EIPS/eip-6492#specification).
 *
 * @example
 * ```ts twoslash
 * import { Secp256k1, Signature } from 'ox'
 * import { SignatureErc6492 } from 'ox/erc6492' // [!code focus]
 *
 * const signature = Secp256k1.sign({
 *   payload: '0x...',
 *   privateKey: '0x...',
 * })
 *
 * const wrapped = SignatureErc6492.wrap({ // [!code focus]
 *   data: '0xdeadbeef', // [!code focus]
 *   signature: Signature.toHex(signature), // [!code focus]
 *   to: '0x00000000219ab540356cBB839Cbe05303d7705Fa', // [!code focus]
 * }) // [!code focus]
 * ```
 *
 * @param value - Wrapped signature to serialize.
 * @returns Serialized wrapped signature.
 */
function wrap(value) {
    const { data, signature, to } = value;
    return concat(encode$1(from$5('address, bytes, bytes'), [
        to,
        data,
        signature,
    ]), magicBytes);
}
/**
 * Validates a wrapped signature. Returns `true` if the wrapped signature is valid, `false` otherwise.
 *
 * @example
 * ```ts twoslash
 * import { SignatureErc6492 } from 'ox/erc6492'
 *
 * const valid = SignatureErc6492.validate('0xdeadbeef')
 * // @log: false
 * ```
 *
 * @param wrapped - The wrapped signature to validate.
 * @returns `true` if the wrapped signature is valid, `false` otherwise.
 */
function validate(wrapped) {
    try {
        assert(wrapped);
        return true;
    }
    catch {
        return false;
    }
}
/** Thrown when the ERC-6492 wrapped signature is invalid. */
class InvalidWrappedSignatureError extends BaseError {
    constructor(wrapped) {
        super(`Value \`${wrapped}\` is an invalid ERC-6492 wrapped signature.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'SignatureErc6492.InvalidWrappedSignatureError'
        });
    }
}

/**
 * HMAC: RFC2104 message authentication code.
 * @module
 */
class HMAC extends Hash$1 {
    constructor(hash, _key) {
        super();
        this.finished = false;
        this.destroyed = false;
        ahash(hash);
        const key = toBytes$1(_key);
        this.iHash = hash.create();
        if (typeof this.iHash.update !== 'function')
            throw new Error('Expected instance of class which extends utils.Hash');
        this.blockLen = this.iHash.blockLen;
        this.outputLen = this.iHash.outputLen;
        const blockLen = this.blockLen;
        const pad = new Uint8Array(blockLen);
        // blockLen can be bigger than outputLen
        pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
        for (let i = 0; i < pad.length; i++)
            pad[i] ^= 0x36;
        this.iHash.update(pad);
        // By doing update (processing of first block) of outer hash here we can re-use it between multiple calls via clone
        this.oHash = hash.create();
        // Undo internal XOR && apply outer XOR
        for (let i = 0; i < pad.length; i++)
            pad[i] ^= 0x36 ^ 0x5c;
        this.oHash.update(pad);
        clean$1(pad);
    }
    update(buf) {
        aexists$1(this);
        this.iHash.update(buf);
        return this;
    }
    digestInto(out) {
        aexists$1(this);
        abytes$2(out, this.outputLen);
        this.finished = true;
        this.iHash.digestInto(out);
        this.oHash.update(out);
        this.oHash.digestInto(out);
        this.destroy();
    }
    digest() {
        const out = new Uint8Array(this.oHash.outputLen);
        this.digestInto(out);
        return out;
    }
    _cloneInto(to) {
        // Create new instance without calling constructor since key already in state and we don't know it.
        to || (to = Object.create(Object.getPrototypeOf(this), {}));
        const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
        to = to;
        to.finished = finished;
        to.destroyed = destroyed;
        to.blockLen = blockLen;
        to.outputLen = outputLen;
        to.oHash = oHash._cloneInto(to.oHash);
        to.iHash = iHash._cloneInto(to.iHash);
        return to;
    }
    clone() {
        return this._cloneInto();
    }
    destroy() {
        this.destroyed = true;
        this.oHash.destroy();
        this.iHash.destroy();
    }
}
/**
 * HMAC: RFC2104 message authentication code.
 * @param hash - function that would be used e.g. sha256
 * @param key - message key
 * @param message - message data
 * @example
 * import { hmac } from '@noble/hashes/hmac';
 * import { sha256 } from '@noble/hashes/sha2';
 * const mac1 = hmac(sha256, 'key', 'message');
 */
const hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
hmac.create = (hash, key) => new HMAC(hash, key);

/**
 * Hex, bytes and number utilities.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// 100 lines of code in the file are duplicated from noble-hashes (utils).
// This is OK: `abstract` directory does not use noble-hashes.
// User may opt-in into using different hashing library. This way, noble-hashes
// won't be included into their bundle.
const _0n$4 = /* @__PURE__ */ BigInt(0);
const _1n$4 = /* @__PURE__ */ BigInt(1);
function isBytes(a) {
    return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
}
function abytes(item) {
    if (!isBytes(item))
        throw new Error('Uint8Array expected');
}
function abool(title, value) {
    if (typeof value !== 'boolean')
        throw new Error(title + ' boolean expected, got ' + value);
}
// Used in weierstrass, der
function numberToHexUnpadded(num) {
    const hex = num.toString(16);
    return hex.length & 1 ? '0' + hex : hex;
}
function hexToNumber(hex) {
    if (typeof hex !== 'string')
        throw new Error('hex string expected, got ' + typeof hex);
    return hex === '' ? _0n$4 : BigInt('0x' + hex); // Big Endian
}
// Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
const hasHexBuiltin = 
// @ts-ignore
typeof Uint8Array.from([]).toHex === 'function' && typeof Uint8Array.fromHex === 'function';
// Array where index 0xf0 (240) is mapped to string 'f0'
const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
/**
 * Convert byte array to hex string. Uses built-in function, when available.
 * @example bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])) // 'cafe0123'
 */
function bytesToHex(bytes) {
    abytes(bytes);
    // @ts-ignore
    if (hasHexBuiltin)
        return bytes.toHex();
    // pre-caching improves the speed 6x
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += hexes[bytes[i]];
    }
    return hex;
}
// We use optimized technique to convert hex string to byte array
const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
    if (ch >= asciis._0 && ch <= asciis._9)
        return ch - asciis._0; // '2' => 50-48
    if (ch >= asciis.A && ch <= asciis.F)
        return ch - (asciis.A - 10); // 'B' => 66-(65-10)
    if (ch >= asciis.a && ch <= asciis.f)
        return ch - (asciis.a - 10); // 'b' => 98-(97-10)
    return;
}
/**
 * Convert hex string to byte array. Uses built-in function, when available.
 * @example hexToBytes('cafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 */
function hexToBytes(hex) {
    if (typeof hex !== 'string')
        throw new Error('hex string expected, got ' + typeof hex);
    // @ts-ignore
    if (hasHexBuiltin)
        return Uint8Array.fromHex(hex);
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
        throw new Error('hex string expected, got unpadded hex of length ' + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
        const n1 = asciiToBase16(hex.charCodeAt(hi));
        const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
        if (n1 === undefined || n2 === undefined) {
            const char = hex[hi] + hex[hi + 1];
            throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
        }
        array[ai] = n1 * 16 + n2; // multiply first octet, e.g. 'a3' => 10*16+3 => 160 + 3 => 163
    }
    return array;
}
// BE: Big Endian, LE: Little Endian
function bytesToNumberBE(bytes) {
    return hexToNumber(bytesToHex(bytes));
}
function bytesToNumberLE(bytes) {
    abytes(bytes);
    return hexToNumber(bytesToHex(Uint8Array.from(bytes).reverse()));
}
function numberToBytesBE(n, len) {
    return hexToBytes(n.toString(16).padStart(len * 2, '0'));
}
function numberToBytesLE(n, len) {
    return numberToBytesBE(n, len).reverse();
}
/**
 * Takes hex string or Uint8Array, converts to Uint8Array.
 * Validates output length.
 * Will throw error for other types.
 * @param title descriptive title for an error e.g. 'private key'
 * @param hex hex string or Uint8Array
 * @param expectedLength optional, will compare to result array's length
 * @returns
 */
function ensureBytes(title, hex, expectedLength) {
    let res;
    if (typeof hex === 'string') {
        try {
            res = hexToBytes(hex);
        }
        catch (e) {
            throw new Error(title + ' must be hex string or Uint8Array, cause: ' + e);
        }
    }
    else if (isBytes(hex)) {
        // Uint8Array.from() instead of hash.slice() because node.js Buffer
        // is instance of Uint8Array, and its slice() creates **mutable** copy
        res = Uint8Array.from(hex);
    }
    else {
        throw new Error(title + ' must be hex string or Uint8Array');
    }
    const len = res.length;
    if (typeof expectedLength === 'number' && len !== expectedLength)
        throw new Error(title + ' of length ' + expectedLength + ' expected, got ' + len);
    return res;
}
/**
 * Copies several Uint8Arrays into one.
 */
function concatBytes(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
        const a = arrays[i];
        abytes(a);
        sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const a = arrays[i];
        res.set(a, pad);
        pad += a.length;
    }
    return res;
}
// Is positive bigint
const isPosBig = (n) => typeof n === 'bigint' && _0n$4 <= n;
function inRange(n, min, max) {
    return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
/**
 * Asserts min <= n < max. NOTE: It's < max and not <= max.
 * @example
 * aInRange('x', x, 1n, 256n); // would assume x is in (1n..255n)
 */
function aInRange(title, n, min, max) {
    // Why min <= n < max and not a (min < n < max) OR b (min <= n <= max)?
    // consider P=256n, min=0n, max=P
    // - a for min=0 would require -1:          `inRange('x', x, -1n, P)`
    // - b would commonly require subtraction:  `inRange('x', x, 0n, P - 1n)`
    // - our way is the cleanest:               `inRange('x', x, 0n, P)
    if (!inRange(n, min, max))
        throw new Error('expected valid ' + title + ': ' + min + ' <= n < ' + max + ', got ' + n);
}
// Bit operations
/**
 * Calculates amount of bits in a bigint.
 * Same as `n.toString(2).length`
 * TODO: merge with nLength in modular
 */
function bitLen(n) {
    let len;
    for (len = 0; n > _0n$4; n >>= _1n$4, len += 1)
        ;
    return len;
}
/**
 * Calculate mask for N bits. Not using ** operator with bigints because of old engines.
 * Same as BigInt(`0b${Array(i).fill('1').join('')}`)
 */
const bitMask = (n) => (_1n$4 << BigInt(n)) - _1n$4;
// DRBG
const u8n = (len) => new Uint8Array(len); // creates Uint8Array
const u8fr = (arr) => Uint8Array.from(arr); // another shortcut
/**
 * Minimal HMAC-DRBG from NIST 800-90 for RFC6979 sigs.
 * @returns function that will call DRBG until 2nd arg returns something meaningful
 * @example
 *   const drbg = createHmacDRBG<Key>(32, 32, hmac);
 *   drbg(seed, bytesToKey); // bytesToKey must return Key or undefined
 */
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
    if (typeof hashLen !== 'number' || hashLen < 2)
        throw new Error('hashLen must be a number');
    if (typeof qByteLen !== 'number' || qByteLen < 2)
        throw new Error('qByteLen must be a number');
    if (typeof hmacFn !== 'function')
        throw new Error('hmacFn must be a function');
    // Step B, Step C: set hashLen to 8*ceil(hlen/8)
    let v = u8n(hashLen); // Minimal non-full-spec HMAC-DRBG from NIST 800-90 for RFC6979 sigs.
    let k = u8n(hashLen); // Steps B and C of RFC6979 3.2: set hashLen, in our case always same
    let i = 0; // Iterations counter, will throw when over 1000
    const reset = () => {
        v.fill(1);
        k.fill(0);
        i = 0;
    };
    const h = (...b) => hmacFn(k, v, ...b); // hmac(k)(v, ...values)
    const reseed = (seed = u8n(0)) => {
        // HMAC-DRBG reseed() function. Steps D-G
        k = h(u8fr([0x00]), seed); // k = hmac(k || v || 0x00 || seed)
        v = h(); // v = hmac(k || v)
        if (seed.length === 0)
            return;
        k = h(u8fr([0x01]), seed); // k = hmac(k || v || 0x01 || seed)
        v = h(); // v = hmac(k || v)
    };
    const gen = () => {
        // HMAC-DRBG generate() function
        if (i++ >= 1000)
            throw new Error('drbg: tried 1000 values');
        let len = 0;
        const out = [];
        while (len < qByteLen) {
            v = h();
            const sl = v.slice();
            out.push(sl);
            len += v.length;
        }
        return concatBytes(...out);
    };
    const genUntil = (seed, pred) => {
        reset();
        reseed(seed); // Steps D-G
        let res = undefined; // Step H: grind until k is in [1..n-1]
        while (!(res = pred(gen())))
            reseed();
        reset();
        return res;
    };
    return genUntil;
}
// Validating curves and fields
const validatorFns = {
    bigint: (val) => typeof val === 'bigint',
    function: (val) => typeof val === 'function',
    boolean: (val) => typeof val === 'boolean',
    string: (val) => typeof val === 'string',
    stringOrUint8Array: (val) => typeof val === 'string' || isBytes(val),
    isSafeInteger: (val) => Number.isSafeInteger(val),
    array: (val) => Array.isArray(val),
    field: (val, object) => object.Fp.isValid(val),
    hash: (val) => typeof val === 'function' && Number.isSafeInteger(val.outputLen),
};
// type Record<K extends string | number | symbol, T> = { [P in K]: T; }
function validateObject(object, validators, optValidators = {}) {
    const checkField = (fieldName, type, isOptional) => {
        const checkVal = validatorFns[type];
        if (typeof checkVal !== 'function')
            throw new Error('invalid validator function');
        const val = object[fieldName];
        if (isOptional && val === undefined)
            return;
        if (!checkVal(val, object)) {
            throw new Error('param ' + String(fieldName) + ' is invalid. Expected ' + type + ', got ' + val);
        }
    };
    for (const [fieldName, type] of Object.entries(validators))
        checkField(fieldName, type, false);
    for (const [fieldName, type] of Object.entries(optValidators))
        checkField(fieldName, type, true);
    return object;
}
/**
 * Memoizes (caches) computation result.
 * Uses WeakMap: the value is going auto-cleaned by GC after last reference is removed.
 */
function memoized(fn) {
    const map = new WeakMap();
    return (arg, ...args) => {
        const val = map.get(arg);
        if (val !== undefined)
            return val;
        const computed = fn(arg, ...args);
        map.set(arg, computed);
        return computed;
    };
}

/**
 * Utils for modular division and finite fields.
 * A finite field over 11 is integer number operations `mod 11`.
 * There is no division: it is replaced by modular multiplicative inverse.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// prettier-ignore
const _0n$3 = BigInt(0), _1n$3 = BigInt(1), _2n$1 = /* @__PURE__ */ BigInt(2), _3n$1 = /* @__PURE__ */ BigInt(3);
// prettier-ignore
const _4n$1 = /* @__PURE__ */ BigInt(4), _5n = /* @__PURE__ */ BigInt(5), _8n = /* @__PURE__ */ BigInt(8);
// Calculates a modulo b
function mod(a, b) {
    const result = a % b;
    return result >= _0n$3 ? result : b + result;
}
/** Does `x^(2^power)` mod p. `pow2(30, 4)` == `30^(2^4)` */
function pow2(x, power, modulo) {
    let res = x;
    while (power-- > _0n$3) {
        res *= res;
        res %= modulo;
    }
    return res;
}
/**
 * Inverses number over modulo.
 * Implemented using [Euclidean GCD](https://brilliant.org/wiki/extended-euclidean-algorithm/).
 */
function invert(number, modulo) {
    if (number === _0n$3)
        throw new Error('invert: expected non-zero number');
    if (modulo <= _0n$3)
        throw new Error('invert: expected positive modulus, got ' + modulo);
    // Fermat's little theorem "CT-like" version inv(n) = n^(m-2) mod m is 30x slower.
    let a = mod(number, modulo);
    let b = modulo;
    // prettier-ignore
    let x = _0n$3, u = _1n$3;
    while (a !== _0n$3) {
        // JIT applies optimization if those two lines follow each other
        const q = b / a;
        const r = b % a;
        const m = x - u * q;
        // prettier-ignore
        b = a, a = r, x = u, u = m;
    }
    const gcd = b;
    if (gcd !== _1n$3)
        throw new Error('invert: does not exist');
    return mod(x, modulo);
}
// Not all roots are possible! Example which will throw:
// const NUM =
// n = 72057594037927816n;
// Fp = Field(BigInt('0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab'));
function sqrt3mod4(Fp, n) {
    const p1div4 = (Fp.ORDER + _1n$3) / _4n$1;
    const root = Fp.pow(n, p1div4);
    // Throw if root^2 != n
    if (!Fp.eql(Fp.sqr(root), n))
        throw new Error('Cannot find square root');
    return root;
}
function sqrt5mod8(Fp, n) {
    const p5div8 = (Fp.ORDER - _5n) / _8n;
    const n2 = Fp.mul(n, _2n$1);
    const v = Fp.pow(n2, p5div8);
    const nv = Fp.mul(n, v);
    const i = Fp.mul(Fp.mul(nv, _2n$1), v);
    const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
    if (!Fp.eql(Fp.sqr(root), n))
        throw new Error('Cannot find square root');
    return root;
}
// TODO: Commented-out for now. Provide test vectors.
// Tonelli is too slow for extension fields Fp2.
// That means we can't use sqrt (c1, c2...) even for initialization constants.
// if (P % _16n === _9n) return sqrt9mod16;
// // prettier-ignore
// function sqrt9mod16<T>(Fp: IField<T>, n: T, p7div16?: bigint) {
//   if (p7div16 === undefined) p7div16 = (Fp.ORDER + BigInt(7)) / _16n;
//   const c1 = Fp.sqrt(Fp.neg(Fp.ONE)); //  1. c1 = sqrt(-1) in F, i.e., (c1^2) == -1 in F
//   const c2 = Fp.sqrt(c1);             //  2. c2 = sqrt(c1) in F, i.e., (c2^2) == c1 in F
//   const c3 = Fp.sqrt(Fp.neg(c1));     //  3. c3 = sqrt(-c1) in F, i.e., (c3^2) == -c1 in F
//   const c4 = p7div16;                 //  4. c4 = (q + 7) / 16        # Integer arithmetic
//   let tv1 = Fp.pow(n, c4);            //  1. tv1 = x^c4
//   let tv2 = Fp.mul(c1, tv1);          //  2. tv2 = c1 * tv1
//   const tv3 = Fp.mul(c2, tv1);        //  3. tv3 = c2 * tv1
//   let tv4 = Fp.mul(c3, tv1);          //  4. tv4 = c3 * tv1
//   const e1 = Fp.eql(Fp.sqr(tv2), n);  //  5.  e1 = (tv2^2) == x
//   const e2 = Fp.eql(Fp.sqr(tv3), n);  //  6.  e2 = (tv3^2) == x
//   tv1 = Fp.cmov(tv1, tv2, e1); //  7. tv1 = CMOV(tv1, tv2, e1)  # Select tv2 if (tv2^2) == x
//   tv2 = Fp.cmov(tv4, tv3, e2); //  8. tv2 = CMOV(tv4, tv3, e2)  # Select tv3 if (tv3^2) == x
//   const e3 = Fp.eql(Fp.sqr(tv2), n);  //  9.  e3 = (tv2^2) == x
//   return Fp.cmov(tv1, tv2, e3); // 10.  z = CMOV(tv1, tv2, e3) # Select the sqrt from tv1 and tv2
// }
/**
 * Tonelli-Shanks square root search algorithm.
 * 1. https://eprint.iacr.org/2012/685.pdf (page 12)
 * 2. Square Roots from 1; 24, 51, 10 to Dan Shanks
 * @param P field order
 * @returns function that takes field Fp (created from P) and number n
 */
function tonelliShanks(P) {
    // Initialization (precomputation).
    if (P < BigInt(3))
        throw new Error('sqrt is not defined for small field');
    // Factor P - 1 = Q * 2^S, where Q is odd
    let Q = P - _1n$3;
    let S = 0;
    while (Q % _2n$1 === _0n$3) {
        Q /= _2n$1;
        S++;
    }
    // Find the first quadratic non-residue Z >= 2
    let Z = _2n$1;
    const _Fp = Field(P);
    while (FpLegendre(_Fp, Z) === 1) {
        // Basic primality test for P. After x iterations, chance of
        // not finding quadratic non-residue is 2^x, so 2^1000.
        if (Z++ > 1000)
            throw new Error('Cannot find square root: probably non-prime P');
    }
    // Fast-path; usually done before Z, but we do "primality test".
    if (S === 1)
        return sqrt3mod4;
    // Slow-path
    // TODO: test on Fp2 and others
    let cc = _Fp.pow(Z, Q); // c = z^Q
    const Q1div2 = (Q + _1n$3) / _2n$1;
    return function tonelliSlow(Fp, n) {
        if (Fp.is0(n))
            return n;
        // Check if n is a quadratic residue using Legendre symbol
        if (FpLegendre(Fp, n) !== 1)
            throw new Error('Cannot find square root');
        // Initialize variables for the main loop
        let M = S;
        let c = Fp.mul(Fp.ONE, cc); // c = z^Q, move cc from field _Fp into field Fp
        let t = Fp.pow(n, Q); // t = n^Q, first guess at the fudge factor
        let R = Fp.pow(n, Q1div2); // R = n^((Q+1)/2), first guess at the square root
        // Main loop
        // while t != 1
        while (!Fp.eql(t, Fp.ONE)) {
            if (Fp.is0(t))
                return Fp.ZERO; // if t=0 return R=0
            let i = 1;
            // Find the smallest i >= 1 such that t^(2^i) ≡ 1 (mod P)
            let t_tmp = Fp.sqr(t); // t^(2^1)
            while (!Fp.eql(t_tmp, Fp.ONE)) {
                i++;
                t_tmp = Fp.sqr(t_tmp); // t^(2^2)...
                if (i === M)
                    throw new Error('Cannot find square root');
            }
            // Calculate the exponent for b: 2^(M - i - 1)
            const exponent = _1n$3 << BigInt(M - i - 1); // bigint is important
            const b = Fp.pow(c, exponent); // b = 2^(M - i - 1)
            // Update variables
            M = i;
            c = Fp.sqr(b); // c = b^2
            t = Fp.mul(t, c); // t = (t * b^2)
            R = Fp.mul(R, b); // R = R*b
        }
        return R;
    };
}
/**
 * Square root for a finite field. Will try optimized versions first:
 *
 * 1. P ≡ 3 (mod 4)
 * 2. P ≡ 5 (mod 8)
 * 3. Tonelli-Shanks algorithm
 *
 * Different algorithms can give different roots, it is up to user to decide which one they want.
 * For example there is FpSqrtOdd/FpSqrtEven to choice root based on oddness (used for hash-to-curve).
 */
function FpSqrt(P) {
    // P ≡ 3 (mod 4) => √n = n^((P+1)/4)
    if (P % _4n$1 === _3n$1)
        return sqrt3mod4;
    // P ≡ 5 (mod 8) => Atkin algorithm, page 10 of https://eprint.iacr.org/2012/685.pdf
    if (P % _8n === _5n)
        return sqrt5mod8;
    // P ≡ 9 (mod 16) not implemented, see above
    // Tonelli-Shanks algorithm
    return tonelliShanks(P);
}
// prettier-ignore
const FIELD_FIELDS = [
    'create', 'isValid', 'is0', 'neg', 'inv', 'sqrt', 'sqr',
    'eql', 'add', 'sub', 'mul', 'pow', 'div',
    'addN', 'subN', 'mulN', 'sqrN'
];
function validateField(field) {
    const initial = {
        ORDER: 'bigint',
        MASK: 'bigint',
        BYTES: 'isSafeInteger',
        BITS: 'isSafeInteger',
    };
    const opts = FIELD_FIELDS.reduce((map, val) => {
        map[val] = 'function';
        return map;
    }, initial);
    return validateObject(field, opts);
}
// Generic field functions
/**
 * Same as `pow` but for Fp: non-constant-time.
 * Unsafe in some contexts: uses ladder, so can expose bigint bits.
 */
function FpPow(Fp, num, power) {
    if (power < _0n$3)
        throw new Error('invalid exponent, negatives unsupported');
    if (power === _0n$3)
        return Fp.ONE;
    if (power === _1n$3)
        return num;
    let p = Fp.ONE;
    let d = num;
    while (power > _0n$3) {
        if (power & _1n$3)
            p = Fp.mul(p, d);
        d = Fp.sqr(d);
        power >>= _1n$3;
    }
    return p;
}
/**
 * Efficiently invert an array of Field elements.
 * Exception-free. Will return `undefined` for 0 elements.
 * @param passZero map 0 to 0 (instead of undefined)
 */
function FpInvertBatch(Fp, nums, passZero = false) {
    const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : undefined);
    // Walk from first to last, multiply them by each other MOD p
    const multipliedAcc = nums.reduce((acc, num, i) => {
        if (Fp.is0(num))
            return acc;
        inverted[i] = acc;
        return Fp.mul(acc, num);
    }, Fp.ONE);
    // Invert last element
    const invertedAcc = Fp.inv(multipliedAcc);
    // Walk from last to first, multiply them by inverted each other MOD p
    nums.reduceRight((acc, num, i) => {
        if (Fp.is0(num))
            return acc;
        inverted[i] = Fp.mul(acc, inverted[i]);
        return Fp.mul(acc, num);
    }, invertedAcc);
    return inverted;
}
/**
 * Legendre symbol.
 * Legendre constant is used to calculate Legendre symbol (a | p)
 * which denotes the value of a^((p-1)/2) (mod p).
 *
 * * (a | p) ≡ 1    if a is a square (mod p), quadratic residue
 * * (a | p) ≡ -1   if a is not a square (mod p), quadratic non residue
 * * (a | p) ≡ 0    if a ≡ 0 (mod p)
 */
function FpLegendre(Fp, n) {
    // We can use 3rd argument as optional cache of this value
    // but seems unneeded for now. The operation is very fast.
    const p1mod2 = (Fp.ORDER - _1n$3) / _2n$1;
    const powered = Fp.pow(n, p1mod2);
    const yes = Fp.eql(powered, Fp.ONE);
    const zero = Fp.eql(powered, Fp.ZERO);
    const no = Fp.eql(powered, Fp.neg(Fp.ONE));
    if (!yes && !zero && !no)
        throw new Error('invalid Legendre symbol result');
    return yes ? 1 : zero ? 0 : -1;
}
// CURVE.n lengths
function nLength(n, nBitLength) {
    // Bit size, byte size of CURVE.n
    if (nBitLength !== undefined)
        anumber$1(nBitLength);
    const _nBitLength = nBitLength !== undefined ? nBitLength : n.toString(2).length;
    const nByteLength = Math.ceil(_nBitLength / 8);
    return { nBitLength: _nBitLength, nByteLength };
}
/**
 * Initializes a finite field over prime.
 * Major performance optimizations:
 * * a) denormalized operations like mulN instead of mul
 * * b) same object shape: never add or remove keys
 * * c) Object.freeze
 * Fragile: always run a benchmark on a change.
 * Security note: operations don't check 'isValid' for all elements for performance reasons,
 * it is caller responsibility to check this.
 * This is low-level code, please make sure you know what you're doing.
 * @param ORDER prime positive bigint
 * @param bitLen how many bits the field consumes
 * @param isLE (def: false) if encoding / decoding should be in little-endian
 * @param redef optional faster redefinitions of sqrt and other methods
 */
function Field(ORDER, bitLen, isLE = false, redef = {}) {
    if (ORDER <= _0n$3)
        throw new Error('invalid field: expected ORDER > 0, got ' + ORDER);
    const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, bitLen);
    if (BYTES > 2048)
        throw new Error('invalid field: expected ORDER of <= 2048 bytes');
    let sqrtP; // cached sqrtP
    const f = Object.freeze({
        ORDER,
        isLE,
        BITS,
        BYTES,
        MASK: bitMask(BITS),
        ZERO: _0n$3,
        ONE: _1n$3,
        create: (num) => mod(num, ORDER),
        isValid: (num) => {
            if (typeof num !== 'bigint')
                throw new Error('invalid field element: expected bigint, got ' + typeof num);
            return _0n$3 <= num && num < ORDER; // 0 is valid element, but it's not invertible
        },
        is0: (num) => num === _0n$3,
        isOdd: (num) => (num & _1n$3) === _1n$3,
        neg: (num) => mod(-num, ORDER),
        eql: (lhs, rhs) => lhs === rhs,
        sqr: (num) => mod(num * num, ORDER),
        add: (lhs, rhs) => mod(lhs + rhs, ORDER),
        sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
        mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
        pow: (num, power) => FpPow(f, num, power),
        div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
        // Same as above, but doesn't normalize
        sqrN: (num) => num * num,
        addN: (lhs, rhs) => lhs + rhs,
        subN: (lhs, rhs) => lhs - rhs,
        mulN: (lhs, rhs) => lhs * rhs,
        inv: (num) => invert(num, ORDER),
        sqrt: redef.sqrt ||
            ((n) => {
                if (!sqrtP)
                    sqrtP = FpSqrt(ORDER);
                return sqrtP(f, n);
            }),
        toBytes: (num) => (isLE ? numberToBytesLE(num, BYTES) : numberToBytesBE(num, BYTES)),
        fromBytes: (bytes) => {
            if (bytes.length !== BYTES)
                throw new Error('Field.fromBytes: expected ' + BYTES + ' bytes, got ' + bytes.length);
            return isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
        },
        // TODO: we don't need it here, move out to separate fn
        invertBatch: (lst) => FpInvertBatch(f, lst),
        // We can't move this out because Fp6, Fp12 implement it
        // and it's unclear what to return in there.
        cmov: (a, b, c) => (c ? b : a),
    });
    return Object.freeze(f);
}
/**
 * Returns total number of bytes consumed by the field element.
 * For example, 32 bytes for usual 256-bit weierstrass curve.
 * @param fieldOrder number of field elements, usually CURVE.n
 * @returns byte length of field
 */
function getFieldBytesLength(fieldOrder) {
    if (typeof fieldOrder !== 'bigint')
        throw new Error('field order must be bigint');
    const bitLength = fieldOrder.toString(2).length;
    return Math.ceil(bitLength / 8);
}
/**
 * Returns minimal amount of bytes that can be safely reduced
 * by field order.
 * Should be 2^-128 for 128-bit curve such as P256.
 * @param fieldOrder number of field elements, usually CURVE.n
 * @returns byte length of target hash
 */
function getMinHashLength(fieldOrder) {
    const length = getFieldBytesLength(fieldOrder);
    return length + Math.ceil(length / 2);
}
/**
 * "Constant-time" private key generation utility.
 * Can take (n + n/2) or more bytes of uniform input e.g. from CSPRNG or KDF
 * and convert them into private scalar, with the modulo bias being negligible.
 * Needs at least 48 bytes of input for 32-byte private key.
 * https://research.kudelskisecurity.com/2020/07/28/the-definitive-guide-to-modulo-bias-and-how-to-avoid-it/
 * FIPS 186-5, A.2 https://csrc.nist.gov/publications/detail/fips/186/5/final
 * RFC 9380, https://www.rfc-editor.org/rfc/rfc9380#section-5
 * @param hash hash output from SHA3 or a similar function
 * @param groupOrder size of subgroup - (e.g. secp256k1.CURVE.n)
 * @param isLE interpret hash bytes as LE num
 * @returns valid private scalar
 */
function mapHashToField(key, fieldOrder, isLE = false) {
    const len = key.length;
    const fieldLen = getFieldBytesLength(fieldOrder);
    const minLen = getMinHashLength(fieldOrder);
    // No small numbers: need to understand bias story. No huge numbers: easier to detect JS timings.
    if (len < 16 || len < minLen || len > 1024)
        throw new Error('expected ' + minLen + '-1024 bytes of input, got ' + len);
    const num = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
    // `mod(x, 11)` can sometimes produce 0. `mod(x, 10) + 1` is the same, but no 0
    const reduced = mod(num, fieldOrder - _1n$3) + _1n$3;
    return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}

/**
 * Methods for elliptic curve multiplication by scalars.
 * Contains wNAF, pippenger
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const _0n$2 = BigInt(0);
const _1n$2 = BigInt(1);
function constTimeNegate(condition, item) {
    const neg = item.negate();
    return condition ? neg : item;
}
function validateW(W, bits) {
    if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
        throw new Error('invalid window size, expected [1..' + bits + '], got W=' + W);
}
function calcWOpts(W, scalarBits) {
    validateW(W, scalarBits);
    const windows = Math.ceil(scalarBits / W) + 1; // W=8 33. Not 32, because we skip zero
    const windowSize = 2 ** (W - 1); // W=8 128. Not 256, because we skip zero
    const maxNumber = 2 ** W; // W=8 256
    const mask = bitMask(W); // W=8 255 == mask 0b11111111
    const shiftBy = BigInt(W); // W=8 8
    return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window, wOpts) {
    const { windowSize, mask, maxNumber, shiftBy } = wOpts;
    let wbits = Number(n & mask); // extract W bits.
    let nextN = n >> shiftBy; // shift number by W bits.
    // What actually happens here:
    // const highestBit = Number(mask ^ (mask >> 1n));
    // let wbits2 = wbits - 1; // skip zero
    // if (wbits2 & highestBit) { wbits2 ^= Number(mask); // (~);
    // split if bits > max: +224 => 256-32
    if (wbits > windowSize) {
        // we skip zero, which means instead of `>= size-1`, we do `> size`
        wbits -= maxNumber; // -32, can be maxNumber - wbits, but then we need to set isNeg here.
        nextN += _1n$2; // +256 (carry)
    }
    const offsetStart = window * windowSize;
    const offset = offsetStart + Math.abs(wbits) - 1; // -1 because we skip zero
    const isZero = wbits === 0; // is current window slice a 0?
    const isNeg = wbits < 0; // is current window slice negative?
    const isNegF = window % 2 !== 0; // fake random statement for noise
    const offsetF = offsetStart; // fake offset for noise
    return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
function validateMSMPoints(points, c) {
    if (!Array.isArray(points))
        throw new Error('array expected');
    points.forEach((p, i) => {
        if (!(p instanceof c))
            throw new Error('invalid point at index ' + i);
    });
}
function validateMSMScalars(scalars, field) {
    if (!Array.isArray(scalars))
        throw new Error('array of scalars expected');
    scalars.forEach((s, i) => {
        if (!field.isValid(s))
            throw new Error('invalid scalar at index ' + i);
    });
}
// Since points in different groups cannot be equal (different object constructor),
// we can have single place to store precomputes.
// Allows to make points frozen / immutable.
const pointPrecomputes = new WeakMap();
const pointWindowSizes = new WeakMap();
function getW(P) {
    return pointWindowSizes.get(P) || 1;
}
/**
 * Elliptic curve multiplication of Point by scalar. Fragile.
 * Scalars should always be less than curve order: this should be checked inside of a curve itself.
 * Creates precomputation tables for fast multiplication:
 * - private scalar is split by fixed size windows of W bits
 * - every window point is collected from window's table & added to accumulator
 * - since windows are different, same point inside tables won't be accessed more than once per calc
 * - each multiplication is 'Math.ceil(CURVE_ORDER / 𝑊) + 1' point additions (fixed for any scalar)
 * - +1 window is neccessary for wNAF
 * - wNAF reduces table size: 2x less memory + 2x faster generation, but 10% slower multiplication
 *
 * @todo Research returning 2d JS array of windows, instead of a single window.
 * This would allow windows to be in different memory locations
 */
function wNAF(c, bits) {
    return {
        constTimeNegate,
        hasPrecomputes(elm) {
            return getW(elm) !== 1;
        },
        // non-const time multiplication ladder
        unsafeLadder(elm, n, p = c.ZERO) {
            let d = elm;
            while (n > _0n$2) {
                if (n & _1n$2)
                    p = p.add(d);
                d = d.double();
                n >>= _1n$2;
            }
            return p;
        },
        /**
         * Creates a wNAF precomputation window. Used for caching.
         * Default window size is set by `utils.precompute()` and is equal to 8.
         * Number of precomputed points depends on the curve size:
         * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
         * - 𝑊 is the window size
         * - 𝑛 is the bitlength of the curve order.
         * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
         * @param elm Point instance
         * @param W window size
         * @returns precomputed point tables flattened to a single array
         */
        precomputeWindow(elm, W) {
            const { windows, windowSize } = calcWOpts(W, bits);
            const points = [];
            let p = elm;
            let base = p;
            for (let window = 0; window < windows; window++) {
                base = p;
                points.push(base);
                // i=1, bc we skip 0
                for (let i = 1; i < windowSize; i++) {
                    base = base.add(p);
                    points.push(base);
                }
                p = base.double();
            }
            return points;
        },
        /**
         * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
         * @param W window size
         * @param precomputes precomputed tables
         * @param n scalar (we don't check here, but should be less than curve order)
         * @returns real and fake (for const-time) points
         */
        wNAF(W, precomputes, n) {
            // Smaller version:
            // https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
            // TODO: check the scalar is less than group order?
            // wNAF behavior is undefined otherwise. But have to carefully remove
            // other checks before wNAF. ORDER == bits here.
            // Accumulators
            let p = c.ZERO;
            let f = c.BASE;
            // This code was first written with assumption that 'f' and 'p' will never be infinity point:
            // since each addition is multiplied by 2 ** W, it cannot cancel each other. However,
            // there is negate now: it is possible that negated element from low value
            // would be the same as high element, which will create carry into next window.
            // It's not obvious how this can fail, but still worth investigating later.
            const wo = calcWOpts(W, bits);
            for (let window = 0; window < wo.windows; window++) {
                // (n === _0n) is handled and not early-exited. isEven and offsetF are used for noise
                const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
                n = nextN;
                if (isZero) {
                    // bits are 0: add garbage to fake point
                    // Important part for const-time getPublicKey: add random "noise" point to f.
                    f = f.add(constTimeNegate(isNegF, precomputes[offsetF]));
                }
                else {
                    // bits are 1: add to result point
                    p = p.add(constTimeNegate(isNeg, precomputes[offset]));
                }
            }
            // Return both real and fake points: JIT won't eliminate f.
            // At this point there is a way to F be infinity-point even if p is not,
            // which makes it less const-time: around 1 bigint multiply.
            return { p, f };
        },
        /**
         * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
         * @param W window size
         * @param precomputes precomputed tables
         * @param n scalar (we don't check here, but should be less than curve order)
         * @param acc accumulator point to add result of multiplication
         * @returns point
         */
        wNAFUnsafe(W, precomputes, n, acc = c.ZERO) {
            const wo = calcWOpts(W, bits);
            for (let window = 0; window < wo.windows; window++) {
                if (n === _0n$2)
                    break; // Early-exit, skip 0 value
                const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
                n = nextN;
                if (isZero) {
                    // Window bits are 0: skip processing.
                    // Move to next window.
                    continue;
                }
                else {
                    const item = precomputes[offset];
                    acc = acc.add(isNeg ? item.negate() : item); // Re-using acc allows to save adds in MSM
                }
            }
            return acc;
        },
        getPrecomputes(W, P, transform) {
            // Calculate precomputes on a first run, reuse them after
            let comp = pointPrecomputes.get(P);
            if (!comp) {
                comp = this.precomputeWindow(P, W);
                if (W !== 1)
                    pointPrecomputes.set(P, transform(comp));
            }
            return comp;
        },
        wNAFCached(P, n, transform) {
            const W = getW(P);
            return this.wNAF(W, this.getPrecomputes(W, P, transform), n);
        },
        wNAFCachedUnsafe(P, n, transform, prev) {
            const W = getW(P);
            if (W === 1)
                return this.unsafeLadder(P, n, prev); // For W=1 ladder is ~x2 faster
            return this.wNAFUnsafe(W, this.getPrecomputes(W, P, transform), n, prev);
        },
        // We calculate precomputes for elliptic curve point multiplication
        // using windowed method. This specifies window size and
        // stores precomputed values. Usually only base point would be precomputed.
        setWindowSize(P, W) {
            validateW(W, bits);
            pointWindowSizes.set(P, W);
            pointPrecomputes.delete(P);
        },
    };
}
/**
 * Pippenger algorithm for multi-scalar multiplication (MSM, Pa + Qb + Rc + ...).
 * 30x faster vs naive addition on L=4096, 10x faster than precomputes.
 * For N=254bit, L=1, it does: 1024 ADD + 254 DBL. For L=5: 1536 ADD + 254 DBL.
 * Algorithmically constant-time (for same L), even when 1 point + scalar, or when scalar = 0.
 * @param c Curve Point constructor
 * @param fieldN field over CURVE.N - important that it's not over CURVE.P
 * @param points array of L curve points
 * @param scalars array of L scalars (aka private keys / bigints)
 */
function pippenger(c, fieldN, points, scalars) {
    // If we split scalars by some window (let's say 8 bits), every chunk will only
    // take 256 buckets even if there are 4096 scalars, also re-uses double.
    // TODO:
    // - https://eprint.iacr.org/2024/750.pdf
    // - https://tches.iacr.org/index.php/TCHES/article/view/10287
    // 0 is accepted in scalars
    validateMSMPoints(points, c);
    validateMSMScalars(scalars, fieldN);
    const plength = points.length;
    const slength = scalars.length;
    if (plength !== slength)
        throw new Error('arrays of points and scalars must have equal length');
    // if (plength === 0) throw new Error('array must be of length >= 2');
    const zero = c.ZERO;
    const wbits = bitLen(BigInt(plength));
    let windowSize = 1; // bits
    if (wbits > 12)
        windowSize = wbits - 3;
    else if (wbits > 4)
        windowSize = wbits - 2;
    else if (wbits > 0)
        windowSize = 2;
    const MASK = bitMask(windowSize);
    const buckets = new Array(Number(MASK) + 1).fill(zero); // +1 for zero array
    const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
    let sum = zero;
    for (let i = lastBits; i >= 0; i -= windowSize) {
        buckets.fill(zero);
        for (let j = 0; j < slength; j++) {
            const scalar = scalars[j];
            const wbits = Number((scalar >> BigInt(i)) & MASK);
            buckets[wbits] = buckets[wbits].add(points[j]);
        }
        let resI = zero; // not using this will do small speed-up, but will lose ct
        // Skip first bucket, because it is zero
        for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
            sumI = sumI.add(buckets[j]);
            resI = resI.add(sumI);
        }
        sum = sum.add(resI);
        if (i !== 0)
            for (let j = 0; j < windowSize; j++)
                sum = sum.double();
    }
    return sum;
}
function validateBasic(curve) {
    validateField(curve.Fp);
    validateObject(curve, {
        n: 'bigint',
        h: 'bigint',
        Gx: 'field',
        Gy: 'field',
    }, {
        nBitLength: 'isSafeInteger',
        nByteLength: 'isSafeInteger',
    });
    // Set defaults
    return Object.freeze({
        ...nLength(curve.n, curve.nBitLength),
        ...curve,
        ...{ p: curve.Fp.ORDER },
    });
}

/**
 * Short Weierstrass curve methods. The formula is: y² = x³ + ax + b.
 *
 * ### Parameters
 *
 * To initialize a weierstrass curve, one needs to pass following params:
 *
 * * a: formula param
 * * b: formula param
 * * Fp: finite field of prime characteristic P; may be complex (Fp2). Arithmetics is done in field
 * * n: order of prime subgroup a.k.a total amount of valid curve points
 * * Gx: Base point (x, y) aka generator point. Gx = x coordinate
 * * Gy: ...y coordinate
 * * h: cofactor, usually 1. h*n = curve group order (n is only subgroup order)
 * * lowS: whether to enable (default) or disable "low-s" non-malleable signatures
 *
 * ### Design rationale for types
 *
 * * Interaction between classes from different curves should fail:
 *   `k256.Point.BASE.add(p256.Point.BASE)`
 * * For this purpose we want to use `instanceof` operator, which is fast and works during runtime
 * * Different calls of `curve()` would return different classes -
 *   `curve(params) !== curve(params)`: if somebody decided to monkey-patch their curve,
 *   it won't affect others
 *
 * TypeScript can't infer types for classes created inside a function. Classes is one instance
 * of nominative types in TypeScript and interfaces only check for shape, so it's hard to create
 * unique type for every function call.
 *
 * We can use generic types via some param, like curve opts, but that would:
 *     1. Enable interaction between `curve(params)` and `curve(params)` (curves of same params)
 *     which is hard to debug.
 *     2. Params can be generic and we can't enforce them to be constant value:
 *     if somebody creates curve from non-constant params,
 *     it would be allowed to interact with other curves with non-constant params
 *
 * @todo https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-7.html#unique-symbol
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// prettier-ignore
function validateSigVerOpts(opts) {
    if (opts.lowS !== undefined)
        abool('lowS', opts.lowS);
    if (opts.prehash !== undefined)
        abool('prehash', opts.prehash);
}
function validatePointOpts(curve) {
    const opts = validateBasic(curve);
    validateObject(opts, {
        a: 'field',
        b: 'field',
    }, {
        allowInfinityPoint: 'boolean',
        allowedPrivateKeyLengths: 'array',
        clearCofactor: 'function',
        fromBytes: 'function',
        isTorsionFree: 'function',
        toBytes: 'function',
        wrapPrivateKey: 'boolean',
    });
    const { endo, Fp, a } = opts;
    if (endo) {
        if (!Fp.eql(a, Fp.ZERO)) {
            throw new Error('invalid endo: CURVE.a must be 0');
        }
        if (typeof endo !== 'object' ||
            typeof endo.beta !== 'bigint' ||
            typeof endo.splitScalar !== 'function') {
            throw new Error('invalid endo: expected "beta": bigint and "splitScalar": function');
        }
    }
    return Object.freeze({ ...opts });
}
class DERErr extends Error {
    constructor(m = '') {
        super(m);
    }
}
/**
 * ASN.1 DER encoding utilities. ASN is very complex & fragile. Format:
 *
 *     [0x30 (SEQUENCE), bytelength, 0x02 (INTEGER), intLength, R, 0x02 (INTEGER), intLength, S]
 *
 * Docs: https://letsencrypt.org/docs/a-warm-welcome-to-asn1-and-der/, https://luca.ntop.org/Teaching/Appunti/asn1.html
 */
const DER = {
    // asn.1 DER encoding utils
    Err: DERErr,
    // Basic building block is TLV (Tag-Length-Value)
    _tlv: {
        encode: (tag, data) => {
            const { Err: E } = DER;
            if (tag < 0 || tag > 256)
                throw new E('tlv.encode: wrong tag');
            if (data.length & 1)
                throw new E('tlv.encode: unpadded data');
            const dataLen = data.length / 2;
            const len = numberToHexUnpadded(dataLen);
            if ((len.length / 2) & 128)
                throw new E('tlv.encode: long form length too big');
            // length of length with long form flag
            const lenLen = dataLen > 127 ? numberToHexUnpadded((len.length / 2) | 128) : '';
            const t = numberToHexUnpadded(tag);
            return t + lenLen + len + data;
        },
        // v - value, l - left bytes (unparsed)
        decode(tag, data) {
            const { Err: E } = DER;
            let pos = 0;
            if (tag < 0 || tag > 256)
                throw new E('tlv.encode: wrong tag');
            if (data.length < 2 || data[pos++] !== tag)
                throw new E('tlv.decode: wrong tlv');
            const first = data[pos++];
            const isLong = !!(first & 128); // First bit of first length byte is flag for short/long form
            let length = 0;
            if (!isLong)
                length = first;
            else {
                // Long form: [longFlag(1bit), lengthLength(7bit), length (BE)]
                const lenLen = first & 127;
                if (!lenLen)
                    throw new E('tlv.decode(long): indefinite length not supported');
                if (lenLen > 4)
                    throw new E('tlv.decode(long): byte length is too big'); // this will overflow u32 in js
                const lengthBytes = data.subarray(pos, pos + lenLen);
                if (lengthBytes.length !== lenLen)
                    throw new E('tlv.decode: length bytes not complete');
                if (lengthBytes[0] === 0)
                    throw new E('tlv.decode(long): zero leftmost byte');
                for (const b of lengthBytes)
                    length = (length << 8) | b;
                pos += lenLen;
                if (length < 128)
                    throw new E('tlv.decode(long): not minimal encoding');
            }
            const v = data.subarray(pos, pos + length);
            if (v.length !== length)
                throw new E('tlv.decode: wrong value length');
            return { v, l: data.subarray(pos + length) };
        },
    },
    // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
    // since we always use positive integers here. It must always be empty:
    // - add zero byte if exists
    // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
    _int: {
        encode(num) {
            const { Err: E } = DER;
            if (num < _0n$1)
                throw new E('integer: negative integers are not allowed');
            let hex = numberToHexUnpadded(num);
            // Pad with zero byte if negative flag is present
            if (Number.parseInt(hex[0], 16) & 0b1000)
                hex = '00' + hex;
            if (hex.length & 1)
                throw new E('unexpected DER parsing assertion: unpadded hex');
            return hex;
        },
        decode(data) {
            const { Err: E } = DER;
            if (data[0] & 128)
                throw new E('invalid signature integer: negative');
            if (data[0] === 0x00 && !(data[1] & 128))
                throw new E('invalid signature integer: unnecessary leading zero');
            return bytesToNumberBE(data);
        },
    },
    toSig(hex) {
        // parse DER signature
        const { Err: E, _int: int, _tlv: tlv } = DER;
        const data = ensureBytes('signature', hex);
        const { v: seqBytes, l: seqLeftBytes } = tlv.decode(0x30, data);
        if (seqLeftBytes.length)
            throw new E('invalid signature: left bytes after parsing');
        const { v: rBytes, l: rLeftBytes } = tlv.decode(0x02, seqBytes);
        const { v: sBytes, l: sLeftBytes } = tlv.decode(0x02, rLeftBytes);
        if (sLeftBytes.length)
            throw new E('invalid signature: left bytes after parsing');
        return { r: int.decode(rBytes), s: int.decode(sBytes) };
    },
    hexFromSig(sig) {
        const { _tlv: tlv, _int: int } = DER;
        const rs = tlv.encode(0x02, int.encode(sig.r));
        const ss = tlv.encode(0x02, int.encode(sig.s));
        const seq = rs + ss;
        return tlv.encode(0x30, seq);
    },
};
function numToSizedHex(num, size) {
    return bytesToHex(numberToBytesBE(num, size));
}
// Be friendly to bad ECMAScript parsers by not using bigint literals
// prettier-ignore
const _0n$1 = BigInt(0), _1n$1 = BigInt(1); BigInt(2); const _3n = BigInt(3), _4n = BigInt(4);
function weierstrassPoints(opts) {
    const CURVE = validatePointOpts(opts);
    const { Fp } = CURVE; // All curves has same field / group length as for now, but they can differ
    const Fn = Field(CURVE.n, CURVE.nBitLength);
    const toBytes = CURVE.toBytes ||
        ((_c, point, _isCompressed) => {
            const a = point.toAffine();
            return concatBytes(Uint8Array.from([0x04]), Fp.toBytes(a.x), Fp.toBytes(a.y));
        });
    const fromBytes = CURVE.fromBytes ||
        ((bytes) => {
            // const head = bytes[0];
            const tail = bytes.subarray(1);
            // if (head !== 0x04) throw new Error('Only non-compressed encoding is supported');
            const x = Fp.fromBytes(tail.subarray(0, Fp.BYTES));
            const y = Fp.fromBytes(tail.subarray(Fp.BYTES, 2 * Fp.BYTES));
            return { x, y };
        });
    /**
     * y² = x³ + ax + b: Short weierstrass curve formula. Takes x, returns y².
     * @returns y²
     */
    function weierstrassEquation(x) {
        const { a, b } = CURVE;
        const x2 = Fp.sqr(x); // x * x
        const x3 = Fp.mul(x2, x); // x² * x
        return Fp.add(Fp.add(x3, Fp.mul(x, a)), b); // x³ + a * x + b
    }
    function isValidXY(x, y) {
        const left = Fp.sqr(y); // y²
        const right = weierstrassEquation(x); // x³ + ax + b
        return Fp.eql(left, right);
    }
    // Validate whether the passed curve params are valid.
    // Test 1: equation y² = x³ + ax + b should work for generator point.
    if (!isValidXY(CURVE.Gx, CURVE.Gy))
        throw new Error('bad curve params: generator point');
    // Test 2: discriminant Δ part should be non-zero: 4a³ + 27b² != 0.
    // Guarantees curve is genus-1, smooth (non-singular).
    const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n), _4n);
    const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
    if (Fp.is0(Fp.add(_4a3, _27b2)))
        throw new Error('bad curve params: a or b');
    // Valid group elements reside in range 1..n-1
    function isWithinCurveOrder(num) {
        return inRange(num, _1n$1, CURVE.n);
    }
    // Validates if priv key is valid and converts it to bigint.
    // Supports options allowedPrivateKeyLengths and wrapPrivateKey.
    function normPrivateKeyToScalar(key) {
        const { allowedPrivateKeyLengths: lengths, nByteLength, wrapPrivateKey, n: N } = CURVE;
        if (lengths && typeof key !== 'bigint') {
            if (isBytes(key))
                key = bytesToHex(key);
            // Normalize to hex string, pad. E.g. P521 would norm 130-132 char hex to 132-char bytes
            if (typeof key !== 'string' || !lengths.includes(key.length))
                throw new Error('invalid private key');
            key = key.padStart(nByteLength * 2, '0');
        }
        let num;
        try {
            num =
                typeof key === 'bigint'
                    ? key
                    : bytesToNumberBE(ensureBytes('private key', key, nByteLength));
        }
        catch (error) {
            throw new Error('invalid private key, expected hex or ' + nByteLength + ' bytes, got ' + typeof key);
        }
        if (wrapPrivateKey)
            num = mod(num, N); // disabled by default, enabled for BLS
        aInRange('private key', num, _1n$1, N); // num in range [1..N-1]
        return num;
    }
    function aprjpoint(other) {
        if (!(other instanceof Point))
            throw new Error('ProjectivePoint expected');
    }
    // Memoized toAffine / validity check. They are heavy. Points are immutable.
    // Converts Projective point to affine (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    // (X, Y, Z) ∋ (x=X/Z, y=Y/Z)
    const toAffineMemo = memoized((p, iz) => {
        const { px: x, py: y, pz: z } = p;
        // Fast-path for normalized points
        if (Fp.eql(z, Fp.ONE))
            return { x, y };
        const is0 = p.is0();
        // If invZ was 0, we return zero point. However we still want to execute
        // all operations, so we replace invZ with a random number, 1.
        if (iz == null)
            iz = is0 ? Fp.ONE : Fp.inv(z);
        const ax = Fp.mul(x, iz);
        const ay = Fp.mul(y, iz);
        const zz = Fp.mul(z, iz);
        if (is0)
            return { x: Fp.ZERO, y: Fp.ZERO };
        if (!Fp.eql(zz, Fp.ONE))
            throw new Error('invZ was invalid');
        return { x: ax, y: ay };
    });
    // NOTE: on exception this will crash 'cached' and no value will be set.
    // Otherwise true will be return
    const assertValidMemo = memoized((p) => {
        if (p.is0()) {
            // (0, 1, 0) aka ZERO is invalid in most contexts.
            // In BLS, ZERO can be serialized, so we allow it.
            // (0, 0, 0) is invalid representation of ZERO.
            if (CURVE.allowInfinityPoint && !Fp.is0(p.py))
                return;
            throw new Error('bad point: ZERO');
        }
        // Some 3rd-party test vectors require different wording between here & `fromCompressedHex`
        const { x, y } = p.toAffine();
        // Check if x, y are valid field elements
        if (!Fp.isValid(x) || !Fp.isValid(y))
            throw new Error('bad point: x or y not FE');
        if (!isValidXY(x, y))
            throw new Error('bad point: equation left != right');
        if (!p.isTorsionFree())
            throw new Error('bad point: not in prime-order subgroup');
        return true;
    });
    /**
     * Projective Point works in 3d / projective (homogeneous) coordinates: (X, Y, Z) ∋ (x=X/Z, y=Y/Z)
     * Default Point works in 2d / affine coordinates: (x, y)
     * We're doing calculations in projective, because its operations don't require costly inversion.
     */
    class Point {
        constructor(px, py, pz) {
            if (px == null || !Fp.isValid(px))
                throw new Error('x required');
            if (py == null || !Fp.isValid(py) || Fp.is0(py))
                throw new Error('y required');
            if (pz == null || !Fp.isValid(pz))
                throw new Error('z required');
            this.px = px;
            this.py = py;
            this.pz = pz;
            Object.freeze(this);
        }
        // Does not validate if the point is on-curve.
        // Use fromHex instead, or call assertValidity() later.
        static fromAffine(p) {
            const { x, y } = p || {};
            if (!p || !Fp.isValid(x) || !Fp.isValid(y))
                throw new Error('invalid affine point');
            if (p instanceof Point)
                throw new Error('projective point not allowed');
            const is0 = (i) => Fp.eql(i, Fp.ZERO);
            // fromAffine(x:0, y:0) would produce (x:0, y:0, z:1), but we need (x:0, y:1, z:0)
            if (is0(x) && is0(y))
                return Point.ZERO;
            return new Point(x, y, Fp.ONE);
        }
        get x() {
            return this.toAffine().x;
        }
        get y() {
            return this.toAffine().y;
        }
        /**
         * Takes a bunch of Projective Points but executes only one
         * inversion on all of them. Inversion is very slow operation,
         * so this improves performance massively.
         * Optimization: converts a list of projective points to a list of identical points with Z=1.
         */
        static normalizeZ(points) {
            const toInv = FpInvertBatch(Fp, points.map((p) => p.pz));
            return points.map((p, i) => p.toAffine(toInv[i])).map(Point.fromAffine);
        }
        /**
         * Converts hash string or Uint8Array to Point.
         * @param hex short/long ECDSA hex
         */
        static fromHex(hex) {
            const P = Point.fromAffine(fromBytes(ensureBytes('pointHex', hex)));
            P.assertValidity();
            return P;
        }
        // Multiplies generator point by privateKey.
        static fromPrivateKey(privateKey) {
            return Point.BASE.multiply(normPrivateKeyToScalar(privateKey));
        }
        // Multiscalar Multiplication
        static msm(points, scalars) {
            return pippenger(Point, Fn, points, scalars);
        }
        // "Private method", don't use it directly
        _setWindowSize(windowSize) {
            wnaf.setWindowSize(this, windowSize);
        }
        // A point on curve is valid if it conforms to equation.
        assertValidity() {
            assertValidMemo(this);
        }
        hasEvenY() {
            const { y } = this.toAffine();
            if (Fp.isOdd)
                return !Fp.isOdd(y);
            throw new Error("Field doesn't support isOdd");
        }
        /**
         * Compare one point to another.
         */
        equals(other) {
            aprjpoint(other);
            const { px: X1, py: Y1, pz: Z1 } = this;
            const { px: X2, py: Y2, pz: Z2 } = other;
            const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
            const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
            return U1 && U2;
        }
        /**
         * Flips point to one corresponding to (x, -y) in Affine coordinates.
         */
        negate() {
            return new Point(this.px, Fp.neg(this.py), this.pz);
        }
        // Renes-Costello-Batina exception-free doubling formula.
        // There is 30% faster Jacobian formula, but it is not complete.
        // https://eprint.iacr.org/2015/1060, algorithm 3
        // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
        double() {
            const { a, b } = CURVE;
            const b3 = Fp.mul(b, _3n);
            const { px: X1, py: Y1, pz: Z1 } = this;
            let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO; // prettier-ignore
            let t0 = Fp.mul(X1, X1); // step 1
            let t1 = Fp.mul(Y1, Y1);
            let t2 = Fp.mul(Z1, Z1);
            let t3 = Fp.mul(X1, Y1);
            t3 = Fp.add(t3, t3); // step 5
            Z3 = Fp.mul(X1, Z1);
            Z3 = Fp.add(Z3, Z3);
            X3 = Fp.mul(a, Z3);
            Y3 = Fp.mul(b3, t2);
            Y3 = Fp.add(X3, Y3); // step 10
            X3 = Fp.sub(t1, Y3);
            Y3 = Fp.add(t1, Y3);
            Y3 = Fp.mul(X3, Y3);
            X3 = Fp.mul(t3, X3);
            Z3 = Fp.mul(b3, Z3); // step 15
            t2 = Fp.mul(a, t2);
            t3 = Fp.sub(t0, t2);
            t3 = Fp.mul(a, t3);
            t3 = Fp.add(t3, Z3);
            Z3 = Fp.add(t0, t0); // step 20
            t0 = Fp.add(Z3, t0);
            t0 = Fp.add(t0, t2);
            t0 = Fp.mul(t0, t3);
            Y3 = Fp.add(Y3, t0);
            t2 = Fp.mul(Y1, Z1); // step 25
            t2 = Fp.add(t2, t2);
            t0 = Fp.mul(t2, t3);
            X3 = Fp.sub(X3, t0);
            Z3 = Fp.mul(t2, t1);
            Z3 = Fp.add(Z3, Z3); // step 30
            Z3 = Fp.add(Z3, Z3);
            return new Point(X3, Y3, Z3);
        }
        // Renes-Costello-Batina exception-free addition formula.
        // There is 30% faster Jacobian formula, but it is not complete.
        // https://eprint.iacr.org/2015/1060, algorithm 1
        // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
        add(other) {
            aprjpoint(other);
            const { px: X1, py: Y1, pz: Z1 } = this;
            const { px: X2, py: Y2, pz: Z2 } = other;
            let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO; // prettier-ignore
            const a = CURVE.a;
            const b3 = Fp.mul(CURVE.b, _3n);
            let t0 = Fp.mul(X1, X2); // step 1
            let t1 = Fp.mul(Y1, Y2);
            let t2 = Fp.mul(Z1, Z2);
            let t3 = Fp.add(X1, Y1);
            let t4 = Fp.add(X2, Y2); // step 5
            t3 = Fp.mul(t3, t4);
            t4 = Fp.add(t0, t1);
            t3 = Fp.sub(t3, t4);
            t4 = Fp.add(X1, Z1);
            let t5 = Fp.add(X2, Z2); // step 10
            t4 = Fp.mul(t4, t5);
            t5 = Fp.add(t0, t2);
            t4 = Fp.sub(t4, t5);
            t5 = Fp.add(Y1, Z1);
            X3 = Fp.add(Y2, Z2); // step 15
            t5 = Fp.mul(t5, X3);
            X3 = Fp.add(t1, t2);
            t5 = Fp.sub(t5, X3);
            Z3 = Fp.mul(a, t4);
            X3 = Fp.mul(b3, t2); // step 20
            Z3 = Fp.add(X3, Z3);
            X3 = Fp.sub(t1, Z3);
            Z3 = Fp.add(t1, Z3);
            Y3 = Fp.mul(X3, Z3);
            t1 = Fp.add(t0, t0); // step 25
            t1 = Fp.add(t1, t0);
            t2 = Fp.mul(a, t2);
            t4 = Fp.mul(b3, t4);
            t1 = Fp.add(t1, t2);
            t2 = Fp.sub(t0, t2); // step 30
            t2 = Fp.mul(a, t2);
            t4 = Fp.add(t4, t2);
            t0 = Fp.mul(t1, t4);
            Y3 = Fp.add(Y3, t0);
            t0 = Fp.mul(t5, t4); // step 35
            X3 = Fp.mul(t3, X3);
            X3 = Fp.sub(X3, t0);
            t0 = Fp.mul(t3, t1);
            Z3 = Fp.mul(t5, Z3);
            Z3 = Fp.add(Z3, t0); // step 40
            return new Point(X3, Y3, Z3);
        }
        subtract(other) {
            return this.add(other.negate());
        }
        is0() {
            return this.equals(Point.ZERO);
        }
        wNAF(n) {
            return wnaf.wNAFCached(this, n, Point.normalizeZ);
        }
        /**
         * Non-constant-time multiplication. Uses double-and-add algorithm.
         * It's faster, but should only be used when you don't care about
         * an exposed private key e.g. sig verification, which works over *public* keys.
         */
        multiplyUnsafe(sc) {
            const { endo, n: N } = CURVE;
            aInRange('scalar', sc, _0n$1, N);
            const I = Point.ZERO;
            if (sc === _0n$1)
                return I;
            if (this.is0() || sc === _1n$1)
                return this;
            // Case a: no endomorphism. Case b: has precomputes.
            if (!endo || wnaf.hasPrecomputes(this))
                return wnaf.wNAFCachedUnsafe(this, sc, Point.normalizeZ);
            // Case c: endomorphism
            /** See docs for {@link EndomorphismOpts} */
            let { k1neg, k1, k2neg, k2 } = endo.splitScalar(sc);
            let k1p = I;
            let k2p = I;
            let d = this;
            while (k1 > _0n$1 || k2 > _0n$1) {
                if (k1 & _1n$1)
                    k1p = k1p.add(d);
                if (k2 & _1n$1)
                    k2p = k2p.add(d);
                d = d.double();
                k1 >>= _1n$1;
                k2 >>= _1n$1;
            }
            if (k1neg)
                k1p = k1p.negate();
            if (k2neg)
                k2p = k2p.negate();
            k2p = new Point(Fp.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
            return k1p.add(k2p);
        }
        /**
         * Constant time multiplication.
         * Uses wNAF method. Windowed method may be 10% faster,
         * but takes 2x longer to generate and consumes 2x memory.
         * Uses precomputes when available.
         * Uses endomorphism for Koblitz curves.
         * @param scalar by which the point would be multiplied
         * @returns New point
         */
        multiply(scalar) {
            const { endo, n: N } = CURVE;
            aInRange('scalar', scalar, _1n$1, N);
            let point, fake; // Fake point is used to const-time mult
            /** See docs for {@link EndomorphismOpts} */
            if (endo) {
                const { k1neg, k1, k2neg, k2 } = endo.splitScalar(scalar);
                let { p: k1p, f: f1p } = this.wNAF(k1);
                let { p: k2p, f: f2p } = this.wNAF(k2);
                k1p = wnaf.constTimeNegate(k1neg, k1p);
                k2p = wnaf.constTimeNegate(k2neg, k2p);
                k2p = new Point(Fp.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
                point = k1p.add(k2p);
                fake = f1p.add(f2p);
            }
            else {
                const { p, f } = this.wNAF(scalar);
                point = p;
                fake = f;
            }
            // Normalize `z` for both points, but return only real one
            return Point.normalizeZ([point, fake])[0];
        }
        /**
         * Efficiently calculate `aP + bQ`. Unsafe, can expose private key, if used incorrectly.
         * Not using Strauss-Shamir trick: precomputation tables are faster.
         * The trick could be useful if both P and Q are not G (not in our case).
         * @returns non-zero affine point
         */
        multiplyAndAddUnsafe(Q, a, b) {
            const G = Point.BASE; // No Strauss-Shamir trick: we have 10% faster G precomputes
            const mul = (P, a // Select faster multiply() method
            ) => (a === _0n$1 || a === _1n$1 || !P.equals(G) ? P.multiplyUnsafe(a) : P.multiply(a));
            const sum = mul(this, a).add(mul(Q, b));
            return sum.is0() ? undefined : sum;
        }
        // Converts Projective point to affine (x, y) coordinates.
        // Can accept precomputed Z^-1 - for example, from invertBatch.
        // (x, y, z) ∋ (x=x/z, y=y/z)
        toAffine(iz) {
            return toAffineMemo(this, iz);
        }
        isTorsionFree() {
            const { h: cofactor, isTorsionFree } = CURVE;
            if (cofactor === _1n$1)
                return true; // No subgroups, always torsion-free
            if (isTorsionFree)
                return isTorsionFree(Point, this);
            throw new Error('isTorsionFree() has not been declared for the elliptic curve');
        }
        clearCofactor() {
            const { h: cofactor, clearCofactor } = CURVE;
            if (cofactor === _1n$1)
                return this; // Fast-path
            if (clearCofactor)
                return clearCofactor(Point, this);
            return this.multiplyUnsafe(CURVE.h);
        }
        toRawBytes(isCompressed = true) {
            abool('isCompressed', isCompressed);
            this.assertValidity();
            return toBytes(Point, this, isCompressed);
        }
        toHex(isCompressed = true) {
            abool('isCompressed', isCompressed);
            return bytesToHex(this.toRawBytes(isCompressed));
        }
    }
    // base / generator point
    Point.BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
    // zero / infinity / identity point
    Point.ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO); // 0, 1, 0
    const { endo, nBitLength } = CURVE;
    const wnaf = wNAF(Point, endo ? Math.ceil(nBitLength / 2) : nBitLength);
    return {
        CURVE,
        ProjectivePoint: Point,
        normPrivateKeyToScalar,
        weierstrassEquation,
        isWithinCurveOrder,
    };
}
function validateOpts(curve) {
    const opts = validateBasic(curve);
    validateObject(opts, {
        hash: 'hash',
        hmac: 'function',
        randomBytes: 'function',
    }, {
        bits2int: 'function',
        bits2int_modN: 'function',
        lowS: 'boolean',
    });
    return Object.freeze({ lowS: true, ...opts });
}
/**
 * Creates short weierstrass curve and ECDSA signature methods for it.
 * @example
 * import { Field } from '@noble/curves/abstract/modular';
 * // Before that, define BigInt-s: a, b, p, n, Gx, Gy
 * const curve = weierstrass({ a, b, Fp: Field(p), n, Gx, Gy, h: 1n })
 */
function weierstrass(curveDef) {
    const CURVE = validateOpts(curveDef);
    const { Fp, n: CURVE_ORDER, nByteLength, nBitLength } = CURVE;
    const compressedLen = Fp.BYTES + 1; // e.g. 33 for 32
    const uncompressedLen = 2 * Fp.BYTES + 1; // e.g. 65 for 32
    function modN(a) {
        return mod(a, CURVE_ORDER);
    }
    function invN(a) {
        return invert(a, CURVE_ORDER);
    }
    const { ProjectivePoint: Point, normPrivateKeyToScalar, weierstrassEquation, isWithinCurveOrder, } = weierstrassPoints({
        ...CURVE,
        toBytes(_c, point, isCompressed) {
            const a = point.toAffine();
            const x = Fp.toBytes(a.x);
            const cat = concatBytes;
            abool('isCompressed', isCompressed);
            if (isCompressed) {
                return cat(Uint8Array.from([point.hasEvenY() ? 0x02 : 0x03]), x);
            }
            else {
                return cat(Uint8Array.from([0x04]), x, Fp.toBytes(a.y));
            }
        },
        fromBytes(bytes) {
            const len = bytes.length;
            const head = bytes[0];
            const tail = bytes.subarray(1);
            // this.assertValidity() is done inside of fromHex
            if (len === compressedLen && (head === 0x02 || head === 0x03)) {
                const x = bytesToNumberBE(tail);
                if (!inRange(x, _1n$1, Fp.ORDER))
                    throw new Error('Point is not on curve');
                const y2 = weierstrassEquation(x); // y² = x³ + ax + b
                let y;
                try {
                    y = Fp.sqrt(y2); // y = y² ^ (p+1)/4
                }
                catch (sqrtError) {
                    const suffix = sqrtError instanceof Error ? ': ' + sqrtError.message : '';
                    throw new Error('Point is not on curve' + suffix);
                }
                const isYOdd = (y & _1n$1) === _1n$1;
                // ECDSA
                const isHeadOdd = (head & 1) === 1;
                if (isHeadOdd !== isYOdd)
                    y = Fp.neg(y);
                return { x, y };
            }
            else if (len === uncompressedLen && head === 0x04) {
                const x = Fp.fromBytes(tail.subarray(0, Fp.BYTES));
                const y = Fp.fromBytes(tail.subarray(Fp.BYTES, 2 * Fp.BYTES));
                return { x, y };
            }
            else {
                const cl = compressedLen;
                const ul = uncompressedLen;
                throw new Error('invalid Point, expected length of ' + cl + ', or uncompressed ' + ul + ', got ' + len);
            }
        },
    });
    function isBiggerThanHalfOrder(number) {
        const HALF = CURVE_ORDER >> _1n$1;
        return number > HALF;
    }
    function normalizeS(s) {
        return isBiggerThanHalfOrder(s) ? modN(-s) : s;
    }
    // slice bytes num
    const slcNum = (b, from, to) => bytesToNumberBE(b.slice(from, to));
    /**
     * ECDSA signature with its (r, s) properties. Supports DER & compact representations.
     */
    class Signature {
        constructor(r, s, recovery) {
            aInRange('r', r, _1n$1, CURVE_ORDER); // r in [1..N]
            aInRange('s', s, _1n$1, CURVE_ORDER); // s in [1..N]
            this.r = r;
            this.s = s;
            if (recovery != null)
                this.recovery = recovery;
            Object.freeze(this);
        }
        // pair (bytes of r, bytes of s)
        static fromCompact(hex) {
            const l = nByteLength;
            hex = ensureBytes('compactSignature', hex, l * 2);
            return new Signature(slcNum(hex, 0, l), slcNum(hex, l, 2 * l));
        }
        // DER encoded ECDSA signature
        // https://bitcoin.stackexchange.com/questions/57644/what-are-the-parts-of-a-bitcoin-transaction-input-script
        static fromDER(hex) {
            const { r, s } = DER.toSig(ensureBytes('DER', hex));
            return new Signature(r, s);
        }
        /**
         * @todo remove
         * @deprecated
         */
        assertValidity() { }
        addRecoveryBit(recovery) {
            return new Signature(this.r, this.s, recovery);
        }
        recoverPublicKey(msgHash) {
            const { r, s, recovery: rec } = this;
            const h = bits2int_modN(ensureBytes('msgHash', msgHash)); // Truncate hash
            if (rec == null || ![0, 1, 2, 3].includes(rec))
                throw new Error('recovery id invalid');
            const radj = rec === 2 || rec === 3 ? r + CURVE.n : r;
            if (radj >= Fp.ORDER)
                throw new Error('recovery id 2 or 3 invalid');
            const prefix = (rec & 1) === 0 ? '02' : '03';
            const R = Point.fromHex(prefix + numToSizedHex(radj, Fp.BYTES));
            const ir = invN(radj); // r^-1
            const u1 = modN(-h * ir); // -hr^-1
            const u2 = modN(s * ir); // sr^-1
            const Q = Point.BASE.multiplyAndAddUnsafe(R, u1, u2); // (sr^-1)R-(hr^-1)G = -(hr^-1)G + (sr^-1)
            if (!Q)
                throw new Error('point at infinify'); // unsafe is fine: no priv data leaked
            Q.assertValidity();
            return Q;
        }
        // Signatures should be low-s, to prevent malleability.
        hasHighS() {
            return isBiggerThanHalfOrder(this.s);
        }
        normalizeS() {
            return this.hasHighS() ? new Signature(this.r, modN(-this.s), this.recovery) : this;
        }
        // DER-encoded
        toDERRawBytes() {
            return hexToBytes(this.toDERHex());
        }
        toDERHex() {
            return DER.hexFromSig(this);
        }
        // padded bytes of r, then padded bytes of s
        toCompactRawBytes() {
            return hexToBytes(this.toCompactHex());
        }
        toCompactHex() {
            const l = nByteLength;
            return numToSizedHex(this.r, l) + numToSizedHex(this.s, l);
        }
    }
    const utils = {
        isValidPrivateKey(privateKey) {
            try {
                normPrivateKeyToScalar(privateKey);
                return true;
            }
            catch (error) {
                return false;
            }
        },
        normPrivateKeyToScalar: normPrivateKeyToScalar,
        /**
         * Produces cryptographically secure private key from random of size
         * (groupLen + ceil(groupLen / 2)) with modulo bias being negligible.
         */
        randomPrivateKey: () => {
            const length = getMinHashLength(CURVE.n);
            return mapHashToField(CURVE.randomBytes(length), CURVE.n);
        },
        /**
         * Creates precompute table for an arbitrary EC point. Makes point "cached".
         * Allows to massively speed-up `point.multiply(scalar)`.
         * @returns cached point
         * @example
         * const fast = utils.precompute(8, ProjectivePoint.fromHex(someonesPubKey));
         * fast.multiply(privKey); // much faster ECDH now
         */
        precompute(windowSize = 8, point = Point.BASE) {
            point._setWindowSize(windowSize);
            point.multiply(BigInt(3)); // 3 is arbitrary, just need any number here
            return point;
        },
    };
    /**
     * Computes public key for a private key. Checks for validity of the private key.
     * @param privateKey private key
     * @param isCompressed whether to return compact (default), or full key
     * @returns Public key, full when isCompressed=false; short when isCompressed=true
     */
    function getPublicKey(privateKey, isCompressed = true) {
        return Point.fromPrivateKey(privateKey).toRawBytes(isCompressed);
    }
    /**
     * Quick and dirty check for item being public key. Does not validate hex, or being on-curve.
     */
    function isProbPub(item) {
        if (typeof item === 'bigint')
            return false;
        if (item instanceof Point)
            return true;
        const arr = ensureBytes('key', item);
        const len = arr.length;
        const fpl = Fp.BYTES;
        const compLen = fpl + 1; // e.g. 33 for 32
        const uncompLen = 2 * fpl + 1; // e.g. 65 for 32
        if (CURVE.allowedPrivateKeyLengths || nByteLength === compLen) {
            return undefined;
        }
        else {
            return len === compLen || len === uncompLen;
        }
    }
    /**
     * ECDH (Elliptic Curve Diffie Hellman).
     * Computes shared public key from private key and public key.
     * Checks: 1) private key validity 2) shared key is on-curve.
     * Does NOT hash the result.
     * @param privateA private key
     * @param publicB different public key
     * @param isCompressed whether to return compact (default), or full key
     * @returns shared public key
     */
    function getSharedSecret(privateA, publicB, isCompressed = true) {
        if (isProbPub(privateA) === true)
            throw new Error('first arg must be private key');
        if (isProbPub(publicB) === false)
            throw new Error('second arg must be public key');
        const b = Point.fromHex(publicB); // check for being on-curve
        return b.multiply(normPrivateKeyToScalar(privateA)).toRawBytes(isCompressed);
    }
    // RFC6979: ensure ECDSA msg is X bytes and < N. RFC suggests optional truncating via bits2octets.
    // FIPS 186-4 4.6 suggests the leftmost min(nBitLen, outLen) bits, which matches bits2int.
    // bits2int can produce res>N, we can do mod(res, N) since the bitLen is the same.
    // int2octets can't be used; pads small msgs with 0: unacceptatble for trunc as per RFC vectors
    const bits2int = CURVE.bits2int ||
        function (bytes) {
            // Our custom check "just in case", for protection against DoS
            if (bytes.length > 8192)
                throw new Error('input is too large');
            // For curves with nBitLength % 8 !== 0: bits2octets(bits2octets(m)) !== bits2octets(m)
            // for some cases, since bytes.length * 8 is not actual bitLength.
            const num = bytesToNumberBE(bytes); // check for == u8 done here
            const delta = bytes.length * 8 - nBitLength; // truncate to nBitLength leftmost bits
            return delta > 0 ? num >> BigInt(delta) : num;
        };
    const bits2int_modN = CURVE.bits2int_modN ||
        function (bytes) {
            return modN(bits2int(bytes)); // can't use bytesToNumberBE here
        };
    // NOTE: pads output with zero as per spec
    const ORDER_MASK = bitMask(nBitLength);
    /**
     * Converts to bytes. Checks if num in `[0..ORDER_MASK-1]` e.g.: `[0..2^256-1]`.
     */
    function int2octets(num) {
        aInRange('num < 2^' + nBitLength, num, _0n$1, ORDER_MASK);
        // works with order, can have different size than numToField!
        return numberToBytesBE(num, nByteLength);
    }
    // Steps A, D of RFC6979 3.2
    // Creates RFC6979 seed; converts msg/privKey to numbers.
    // Used only in sign, not in verify.
    // NOTE: we cannot assume here that msgHash has same amount of bytes as curve order,
    // this will be invalid at least for P521. Also it can be bigger for P224 + SHA256
    function prepSig(msgHash, privateKey, opts = defaultSigOpts) {
        if (['recovered', 'canonical'].some((k) => k in opts))
            throw new Error('sign() legacy options not supported');
        const { hash, randomBytes } = CURVE;
        let { lowS, prehash, extraEntropy: ent } = opts; // generates low-s sigs by default
        if (lowS == null)
            lowS = true; // RFC6979 3.2: we skip step A, because we already provide hash
        msgHash = ensureBytes('msgHash', msgHash);
        validateSigVerOpts(opts);
        if (prehash)
            msgHash = ensureBytes('prehashed msgHash', hash(msgHash));
        // We can't later call bits2octets, since nested bits2int is broken for curves
        // with nBitLength % 8 !== 0. Because of that, we unwrap it here as int2octets call.
        // const bits2octets = (bits) => int2octets(bits2int_modN(bits))
        const h1int = bits2int_modN(msgHash);
        const d = normPrivateKeyToScalar(privateKey); // validate private key, convert to bigint
        const seedArgs = [int2octets(d), int2octets(h1int)];
        // extraEntropy. RFC6979 3.6: additional k' (optional).
        if (ent != null && ent !== false) {
            // K = HMAC_K(V || 0x00 || int2octets(x) || bits2octets(h1) || k')
            const e = ent === true ? randomBytes(Fp.BYTES) : ent; // generate random bytes OR pass as-is
            seedArgs.push(ensureBytes('extraEntropy', e)); // check for being bytes
        }
        const seed = concatBytes(...seedArgs); // Step D of RFC6979 3.2
        const m = h1int; // NOTE: no need to call bits2int second time here, it is inside truncateHash!
        // Converts signature params into point w r/s, checks result for validity.
        function k2sig(kBytes) {
            // RFC 6979 Section 3.2, step 3: k = bits2int(T)
            const k = bits2int(kBytes); // Cannot use fields methods, since it is group element
            if (!isWithinCurveOrder(k))
                return; // Important: all mod() calls here must be done over N
            const ik = invN(k); // k^-1 mod n
            const q = Point.BASE.multiply(k).toAffine(); // q = Gk
            const r = modN(q.x); // r = q.x mod n
            if (r === _0n$1)
                return;
            // Can use scalar blinding b^-1(bm + bdr) where b ∈ [1,q−1] according to
            // https://tches.iacr.org/index.php/TCHES/article/view/7337/6509. We've decided against it:
            // a) dependency on CSPRNG b) 15% slowdown c) doesn't really help since bigints are not CT
            const s = modN(ik * modN(m + r * d)); // Not using blinding here
            if (s === _0n$1)
                return;
            let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n$1); // recovery bit (2 or 3, when q.x > n)
            let normS = s;
            if (lowS && isBiggerThanHalfOrder(s)) {
                normS = normalizeS(s); // if lowS was passed, ensure s is always
                recovery ^= 1; // // in the bottom half of N
            }
            return new Signature(r, normS, recovery); // use normS, not s
        }
        return { seed, k2sig };
    }
    const defaultSigOpts = { lowS: CURVE.lowS, prehash: false };
    const defaultVerOpts = { lowS: CURVE.lowS, prehash: false };
    /**
     * Signs message hash with a private key.
     * ```
     * sign(m, d, k) where
     *   (x, y) = G × k
     *   r = x mod n
     *   s = (m + dr)/k mod n
     * ```
     * @param msgHash NOT message. msg needs to be hashed to `msgHash`, or use `prehash`.
     * @param privKey private key
     * @param opts lowS for non-malleable sigs. extraEntropy for mixing randomness into k. prehash will hash first arg.
     * @returns signature with recovery param
     */
    function sign(msgHash, privKey, opts = defaultSigOpts) {
        const { seed, k2sig } = prepSig(msgHash, privKey, opts); // Steps A, D of RFC6979 3.2.
        const C = CURVE;
        const drbg = createHmacDrbg(C.hash.outputLen, C.nByteLength, C.hmac);
        return drbg(seed, k2sig); // Steps B, C, D, E, F, G
    }
    // Enable precomputes. Slows down first publicKey computation by 20ms.
    Point.BASE._setWindowSize(8);
    // utils.precompute(8, ProjectivePoint.BASE)
    /**
     * Verifies a signature against message hash and public key.
     * Rejects lowS signatures by default: to override,
     * specify option `{lowS: false}`. Implements section 4.1.4 from https://www.secg.org/sec1-v2.pdf:
     *
     * ```
     * verify(r, s, h, P) where
     *   U1 = hs^-1 mod n
     *   U2 = rs^-1 mod n
     *   R = U1⋅G - U2⋅P
     *   mod(R.x, n) == r
     * ```
     */
    function verify(signature, msgHash, publicKey, opts = defaultVerOpts) {
        const sg = signature;
        msgHash = ensureBytes('msgHash', msgHash);
        publicKey = ensureBytes('publicKey', publicKey);
        const { lowS, prehash, format } = opts;
        // Verify opts, deduce signature format
        validateSigVerOpts(opts);
        if ('strict' in opts)
            throw new Error('options.strict was renamed to lowS');
        if (format !== undefined && format !== 'compact' && format !== 'der')
            throw new Error('format must be compact or der');
        const isHex = typeof sg === 'string' || isBytes(sg);
        const isObj = !isHex &&
            !format &&
            typeof sg === 'object' &&
            sg !== null &&
            typeof sg.r === 'bigint' &&
            typeof sg.s === 'bigint';
        if (!isHex && !isObj)
            throw new Error('invalid signature, expected Uint8Array, hex string or Signature instance');
        let _sig = undefined;
        let P;
        try {
            if (isObj)
                _sig = new Signature(sg.r, sg.s);
            if (isHex) {
                // Signature can be represented in 2 ways: compact (2*nByteLength) & DER (variable-length).
                // Since DER can also be 2*nByteLength bytes, we check for it first.
                try {
                    if (format !== 'compact')
                        _sig = Signature.fromDER(sg);
                }
                catch (derError) {
                    if (!(derError instanceof DER.Err))
                        throw derError;
                }
                if (!_sig && format !== 'der')
                    _sig = Signature.fromCompact(sg);
            }
            P = Point.fromHex(publicKey);
        }
        catch (error) {
            return false;
        }
        if (!_sig)
            return false;
        if (lowS && _sig.hasHighS())
            return false;
        if (prehash)
            msgHash = CURVE.hash(msgHash);
        const { r, s } = _sig;
        const h = bits2int_modN(msgHash); // Cannot use fields methods, since it is group element
        const is = invN(s); // s^-1
        const u1 = modN(h * is); // u1 = hs^-1 mod n
        const u2 = modN(r * is); // u2 = rs^-1 mod n
        const R = Point.BASE.multiplyAndAddUnsafe(P, u1, u2)?.toAffine(); // R = u1⋅G + u2⋅P
        if (!R)
            return false;
        const v = modN(R.x);
        return v === r;
    }
    return {
        CURVE,
        getPublicKey,
        getSharedSecret,
        sign,
        verify,
        ProjectivePoint: Point,
        Signature,
        utils,
    };
}

/**
 * Utilities for short weierstrass curves, combined with noble-hashes.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
/** connects noble-curves to noble-hashes */
function getHash(hash) {
    return {
        hash,
        hmac: (key, ...msgs) => hmac(hash, key, concatBytes$2(...msgs)),
        randomBytes,
    };
}
function createCurve(curveDef, defHash) {
    const create = (hash) => weierstrass({ ...curveDef, ...getHash(hash) });
    return { ...create(defHash), create };
}

/**
 * NIST secp256k1. See [pdf](https://www.secg.org/sec2-v2.pdf).
 *
 * Seems to be rigid (not backdoored)
 * [as per discussion](https://bitcointalk.org/index.php?topic=289795.msg3183975#msg3183975).
 *
 * secp256k1 belongs to Koblitz curves: it has efficiently computable endomorphism.
 * Endomorphism uses 2x less RAM, speeds up precomputation by 2x and ECDH / key recovery by 20%.
 * For precomputed wNAF it trades off 1/2 init time & 1/3 ram for 20% perf hit.
 * [See explanation](https://gist.github.com/paulmillr/eb670806793e84df628a7c434a873066).
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const secp256k1P = BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f');
const secp256k1N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const _0n = BigInt(0);
const _1n = BigInt(1);
const _2n = BigInt(2);
const divNearest = (a, b) => (a + b / _2n) / b;
/**
 * √n = n^((p+1)/4) for fields p = 3 mod 4. We unwrap the loop and multiply bit-by-bit.
 * (P+1n/4n).toString(2) would produce bits [223x 1, 0, 22x 1, 4x 0, 11, 00]
 */
function sqrtMod(y) {
    const P = secp256k1P;
    // prettier-ignore
    const _3n = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
    // prettier-ignore
    const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
    const b2 = (y * y * y) % P; // x^3, 11
    const b3 = (b2 * b2 * y) % P; // x^7
    const b6 = (pow2(b3, _3n, P) * b3) % P;
    const b9 = (pow2(b6, _3n, P) * b3) % P;
    const b11 = (pow2(b9, _2n, P) * b2) % P;
    const b22 = (pow2(b11, _11n, P) * b11) % P;
    const b44 = (pow2(b22, _22n, P) * b22) % P;
    const b88 = (pow2(b44, _44n, P) * b44) % P;
    const b176 = (pow2(b88, _88n, P) * b88) % P;
    const b220 = (pow2(b176, _44n, P) * b44) % P;
    const b223 = (pow2(b220, _3n, P) * b3) % P;
    const t1 = (pow2(b223, _23n, P) * b22) % P;
    const t2 = (pow2(t1, _6n, P) * b2) % P;
    const root = pow2(t2, _2n, P);
    if (!Fpk1.eql(Fpk1.sqr(root), y))
        throw new Error('Cannot find square root');
    return root;
}
const Fpk1 = Field(secp256k1P, undefined, undefined, { sqrt: sqrtMod });
/**
 * secp256k1 curve, ECDSA and ECDH methods.
 *
 * Field: `2n**256n - 2n**32n - 2n**9n - 2n**8n - 2n**7n - 2n**6n - 2n**4n - 1n`
 *
 * @example
 * ```js
 * import { secp256k1 } from '@noble/curves/secp256k1';
 * const priv = secp256k1.utils.randomPrivateKey();
 * const pub = secp256k1.getPublicKey(priv);
 * const msg = new Uint8Array(32).fill(1); // message hash (not message) in ecdsa
 * const sig = secp256k1.sign(msg, priv); // `{prehash: true}` option is available
 * const isValid = secp256k1.verify(sig, msg, pub) === true;
 * ```
 */
const secp256k1 = createCurve({
    a: _0n,
    b: BigInt(7),
    Fp: Fpk1,
    n: secp256k1N,
    Gx: BigInt('55066263022277343669578718895168534326250603453777594175500187360389116729240'),
    Gy: BigInt('32670510020758816978083085130507043184471273380659243275938904335757337482424'),
    h: BigInt(1),
    lowS: true, // Allow only low-S signatures by default in sign() and verify()
    endo: {
        // Endomorphism, see above
        beta: BigInt('0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee'),
        splitScalar: (k) => {
            const n = secp256k1N;
            const a1 = BigInt('0x3086d221a7d46bcde86c90e49284eb15');
            const b1 = -_1n * BigInt('0xe4437ed6010e88286f547fa90abfe4c3');
            const a2 = BigInt('0x114ca50f7a8e2f3f657c1108d9d44cfd8');
            const b2 = a1;
            const POW_2_128 = BigInt('0x100000000000000000000000000000000'); // (2n**128n).toString(16)
            const c1 = divNearest(b2 * k, n);
            const c2 = divNearest(-b1 * k, n);
            let k1 = mod(k - c1 * a1 - c2 * a2, n);
            let k2 = mod(-c1 * b1 - c2 * b2, n);
            const k1neg = k1 > POW_2_128;
            const k2neg = k2 > POW_2_128;
            if (k1neg)
                k1 = n - k1;
            if (k2neg)
                k2 = n - k2;
            if (k1 > POW_2_128 || k2 > POW_2_128) {
                throw new Error('splitScalar: Endomorphism failed, k=' + k);
            }
            return { k1neg, k1, k2neg, k2 };
        },
    },
}, sha256$2);

var secp256k1$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  secp256k1: secp256k1
});

/**
 * @description Converts a signature into hex format.
 *
 * @param signature The signature to convert.
 * @returns The signature in hex format.
 *
 * @example
 * serializeSignature({
 *   r: '0x6e100a352ec6ad1b70802290e18aeed190704973570f3b8ed42cb9808e2ea6bf',
 *   s: '0x4a90a229a244495b41890987806fcbd2d5d23fc0dbe5f5256c2613c039d76db8',
 *   yParity: 1
 * })
 * // "0x6e100a352ec6ad1b70802290e18aeed190704973570f3b8ed42cb9808e2ea6bf4a90a229a244495b41890987806fcbd2d5d23fc0dbe5f5256c2613c039d76db81c"
 */
function serializeSignature({ r, s, to = 'hex', v, yParity, }) {
    const yParity_ = (() => {
        if (yParity === 0 || yParity === 1)
            return yParity;
        if (v && (v === 27n || v === 28n || v >= 35n))
            return v % 2n === 0n ? 1 : 0;
        throw new Error('Invalid `v` or `yParity` value');
    })();
    const signature = `0x${new secp256k1.Signature(hexToBigInt(r), hexToBigInt(s)).toCompactHex()}${yParity_ === 0 ? '1b' : '1c'}`;
    if (to === 'hex')
        return signature;
    return hexToBytes$1(signature);
}

/**
 * Verifies a message hash onchain using ERC-6492.
 *
 * @param client - Client to use.
 * @param parameters - {@link VerifyHashParameters}
 * @returns Whether or not the signature is valid. {@link VerifyHashReturnType}
 */
async function verifyHash(client, parameters) {
    const { address, chain = client.chain, hash, erc6492VerifierAddress: verifierAddress = parameters.universalSignatureVerifierAddress ??
        chain?.contracts?.erc6492Verifier?.address, multicallAddress = parameters.multicallAddress ??
        chain?.contracts?.multicall3?.address, } = parameters;
    if (chain?.verifyHash)
        return await chain.verifyHash(client, parameters);
    const signature = (() => {
        const signature = parameters.signature;
        if (isHex(signature))
            return signature;
        if (typeof signature === 'object' && 'r' in signature && 's' in signature)
            return serializeSignature(signature);
        return bytesToHex$1(signature);
    })();
    try {
        if (validate$1(signature))
            return await verifyErc8010(client, {
                ...parameters,
                multicallAddress,
                signature,
            });
        return await verifyErc6492(client, {
            ...parameters,
            verifierAddress,
            signature,
        });
    }
    catch (error) {
        // Fallback attempt to verify the signature via ECDSA recovery.
        try {
            const verified = isAddressEqual(getAddress(address), await recoverAddress({ hash, signature }));
            if (verified)
                return true;
        }
        catch { }
        if (error instanceof VerificationError) {
            // if the execution fails, the signature was not valid and an internal method inside of the validator reverted
            // this can happen for many reasons, for example if signer can not be recovered from the signature
            // or if the signature has no valid format
            return false;
        }
        throw error;
    }
}
/** @internal */
async function verifyErc8010(client, parameters) {
    const { address, blockNumber, blockTag, hash, multicallAddress } = parameters;
    const { authorization: authorization_ox, data: initData, signature, to, } = unwrap(parameters.signature);
    // Check if already delegated
    const code = await getCode(client, {
        address,
        blockNumber,
        blockTag,
    });
    // If already delegated, perform standard ERC-1271 verification.
    if (code === concatHex(['0xef0100', authorization_ox.address]))
        return await verifyErc1271(client, {
            address,
            blockNumber,
            blockTag,
            hash,
            signature,
        });
    const authorization = {
        address: authorization_ox.address,
        chainId: Number(authorization_ox.chainId),
        nonce: Number(authorization_ox.nonce),
        r: numberToHex(authorization_ox.r, { size: 32 }),
        s: numberToHex(authorization_ox.s, { size: 32 }),
        yParity: authorization_ox.yParity,
    };
    const valid = await verifyAuthorization({
        address,
        authorization,
    });
    if (!valid)
        throw new VerificationError();
    // Deployless verification.
    const results = await getAction(client, readContract, 'readContract')({
        ...(multicallAddress
            ? { address: multicallAddress }
            : { code: multicall3Bytecode }),
        authorizationList: [authorization],
        abi: multicall3Abi,
        blockNumber,
        blockTag: 'pending',
        functionName: 'aggregate3',
        args: [
            [
                ...(initData
                    ? [
                        {
                            allowFailure: true,
                            target: to ?? address,
                            callData: initData,
                        },
                    ]
                    : []),
                {
                    allowFailure: true,
                    target: address,
                    callData: encodeFunctionData({
                        abi: erc1271Abi,
                        functionName: 'isValidSignature',
                        args: [hash, signature],
                    }),
                },
            ],
        ],
    });
    const data = results[results.length - 1]?.returnData;
    if (data?.startsWith('0x1626ba7e'))
        return true;
    throw new VerificationError();
}
/** @internal */
// biome-ignore lint/correctness/noUnusedVariables: _
async function verifyErc6492(client, parameters) {
    const { address, factory, factoryData, hash, signature, verifierAddress, ...rest } = parameters;
    const wrappedSignature = await (async () => {
        // If no `factory` or `factoryData` is provided, it is assumed that the
        // address is not a Smart Account, or the Smart Account is already deployed.
        if (!factory && !factoryData)
            return signature;
        // If the signature is already wrapped, return the signature.
        if (validate(signature))
            return signature;
        // If the Smart Account is not deployed, wrap the signature with a 6492 wrapper
        // to perform counterfactual validation.
        return wrap({
            data: factoryData,
            signature,
            to: factory,
        });
    })();
    const args = verifierAddress
        ? {
            to: verifierAddress,
            data: encodeFunctionData({
                abi: erc6492SignatureValidatorAbi,
                functionName: 'isValidSig',
                args: [address, hash, wrappedSignature],
            }),
            ...rest,
        }
        : {
            data: encodeDeployData({
                abi: erc6492SignatureValidatorAbi,
                args: [address, hash, wrappedSignature],
                bytecode: erc6492SignatureValidatorByteCode,
            }),
            ...rest,
        };
    const { data } = await getAction(client, call, 'call')(args).catch((error) => {
        if (error instanceof CallExecutionError)
            throw new VerificationError();
        throw error;
    });
    if (hexToBool(data ?? '0x0'))
        return true;
    throw new VerificationError();
}
/** @internal */
async function verifyErc1271(client, parameters) {
    const { address, blockNumber, blockTag, hash, signature } = parameters;
    const result = await getAction(client, readContract, 'readContract')({
        address,
        abi: erc1271Abi,
        args: [hash, signature],
        blockNumber,
        blockTag,
        functionName: 'isValidSignature',
    }).catch((error) => {
        if (error instanceof ContractFunctionExecutionError)
            throw new VerificationError();
        throw error;
    });
    if (result.startsWith('0x1626ba7e'))
        return true;
    throw new VerificationError();
}
class VerificationError extends Error {
}

/**
 * Verify that a message was signed by the provided address.
 *
 * Compatible with Smart Contract Accounts & Externally Owned Accounts via [ERC-6492](https://eips.ethereum.org/EIPS/eip-6492).
 *
 * - Docs {@link https://viem.sh/docs/actions/public/verifyMessage}
 *
 * @param client - Client to use.
 * @param parameters - {@link VerifyMessageParameters}
 * @returns Whether or not the signature is valid. {@link VerifyMessageReturnType}
 */
async function verifyMessage(client, { address, message, factory, factoryData, signature, ...callRequest }) {
    const hash = hashMessage(message);
    return getAction(client, verifyHash, 'verifyHash')({
        address,
        factory: factory,
        factoryData: factoryData,
        hash,
        signature,
        ...callRequest,
    });
}

/**
 * Verify that typed data was signed by the provided address.
 *
 * - Docs {@link https://viem.sh/docs/actions/public/verifyTypedData}
 *
 * @param client - Client to use.
 * @param parameters - {@link VerifyTypedDataParameters}
 * @returns Whether or not the signature is valid. {@link VerifyTypedDataReturnType}
 */
async function verifyTypedData(client, parameters) {
    const { address, factory, factoryData, signature, message, primaryType, types, domain, ...callRequest } = parameters;
    const hash = hashTypedData({ message, primaryType, types, domain });
    return getAction(client, verifyHash, 'verifyHash')({
        address,
        factory: factory,
        factoryData: factoryData,
        hash,
        signature,
        ...callRequest,
    });
}

/**
 * Watches and returns incoming block numbers.
 *
 * - Docs: https://viem.sh/docs/actions/public/watchBlockNumber
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_watching-blocks
 * - JSON-RPC Methods:
 *   - When `poll: true`, calls [`eth_blockNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blocknumber) on a polling interval.
 *   - When `poll: false` & WebSocket Transport, uses a WebSocket subscription via [`eth_subscribe`](https://docs.alchemy.com/reference/eth-subscribe-polygon) and the `"newHeads"` event.
 *
 * @param client - Client to use
 * @param parameters - {@link WatchBlockNumberParameters}
 * @returns A function that can be invoked to stop watching for new block numbers. {@link WatchBlockNumberReturnType}
 *
 * @example
 * import { createPublicClient, watchBlockNumber, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const unwatch = watchBlockNumber(client, {
 *   onBlockNumber: (blockNumber) => console.log(blockNumber),
 * })
 */
function watchBlockNumber(client, { emitOnBegin = false, emitMissed = false, onBlockNumber, onError, poll: poll_, pollingInterval = client.pollingInterval, }) {
    const enablePolling = (() => {
        if (typeof poll_ !== 'undefined')
            return poll_;
        if (client.transport.type === 'webSocket' ||
            client.transport.type === 'ipc')
            return false;
        if (client.transport.type === 'fallback' &&
            (client.transport.transports[0].config.type === 'webSocket' ||
                client.transport.transports[0].config.type === 'ipc'))
            return false;
        return true;
    })();
    let prevBlockNumber;
    const pollBlockNumber = () => {
        const observerId = stringify$1([
            'watchBlockNumber',
            client.uid,
            emitOnBegin,
            emitMissed,
            pollingInterval,
        ]);
        return observe(observerId, { onBlockNumber, onError }, (emit) => poll(async () => {
            try {
                const blockNumber = await getAction(client, getBlockNumber, 'getBlockNumber')({ cacheTime: 0 });
                if (prevBlockNumber !== undefined) {
                    // If the current block number is the same as the previous,
                    // we can skip.
                    if (blockNumber === prevBlockNumber)
                        return;
                    // If we have missed out on some previous blocks, and the
                    // `emitMissed` flag is truthy, let's emit those blocks.
                    if (blockNumber - prevBlockNumber > 1 && emitMissed) {
                        for (let i = prevBlockNumber + 1n; i < blockNumber; i++) {
                            emit.onBlockNumber(i, prevBlockNumber);
                            prevBlockNumber = i;
                        }
                    }
                }
                // If the next block number is greater than the previous,
                // it is not in the past, and we can emit the new block number.
                if (prevBlockNumber === undefined ||
                    blockNumber > prevBlockNumber) {
                    emit.onBlockNumber(blockNumber, prevBlockNumber);
                    prevBlockNumber = blockNumber;
                }
            }
            catch (err) {
                emit.onError?.(err);
            }
        }, {
            emitOnBegin,
            interval: pollingInterval,
        }));
    };
    const subscribeBlockNumber = () => {
        const observerId = stringify$1([
            'watchBlockNumber',
            client.uid,
            emitOnBegin,
            emitMissed,
        ]);
        return observe(observerId, { onBlockNumber, onError }, (emit) => {
            let active = true;
            let unsubscribe = () => (active = false);
            (async () => {
                try {
                    const transport = (() => {
                        if (client.transport.type === 'fallback') {
                            const transport = client.transport.transports.find((transport) => transport.config.type === 'webSocket' ||
                                transport.config.type === 'ipc');
                            if (!transport)
                                return client.transport;
                            return transport.value;
                        }
                        return client.transport;
                    })();
                    const { unsubscribe: unsubscribe_ } = await transport.subscribe({
                        params: ['newHeads'],
                        onData(data) {
                            if (!active)
                                return;
                            const blockNumber = hexToBigInt(data.result?.number);
                            emit.onBlockNumber(blockNumber, prevBlockNumber);
                            prevBlockNumber = blockNumber;
                        },
                        onError(error) {
                            emit.onError?.(error);
                        },
                    });
                    unsubscribe = unsubscribe_;
                    if (!active)
                        unsubscribe();
                }
                catch (err) {
                    onError?.(err);
                }
            })();
            return () => unsubscribe();
        });
    };
    return enablePolling ? pollBlockNumber() : subscribeBlockNumber();
}

/**
 * Waits for the [Transaction](https://viem.sh/docs/glossary/terms#transaction) to be included on a [Block](https://viem.sh/docs/glossary/terms#block) (one confirmation), and then returns the [Transaction Receipt](https://viem.sh/docs/glossary/terms#transaction-receipt).
 *
 * - Docs: https://viem.sh/docs/actions/public/waitForTransactionReceipt
 * - Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_sending-transactions
 * - JSON-RPC Methods:
 *   - Polls [`eth_getTransactionReceipt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionReceipt) on each block until it has been processed.
 *   - If a Transaction has been replaced:
 *     - Calls [`eth_getBlockByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbynumber) and extracts the transactions
 *     - Checks if one of the Transactions is a replacement
 *     - If so, calls [`eth_getTransactionReceipt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionReceipt).
 *
 * The `waitForTransactionReceipt` action additionally supports Replacement detection (e.g. sped up Transactions).
 *
 * Transactions can be replaced when a user modifies their transaction in their wallet (to speed up or cancel). Transactions are replaced when they are sent from the same nonce.
 *
 * There are 3 types of Transaction Replacement reasons:
 *
 * - `repriced`: The gas price has been modified (e.g. different `maxFeePerGas`)
 * - `cancelled`: The Transaction has been cancelled (e.g. `value === 0n`)
 * - `replaced`: The Transaction has been replaced (e.g. different `value` or `data`)
 *
 * @param client - Client to use
 * @param parameters - {@link WaitForTransactionReceiptParameters}
 * @returns The transaction receipt. {@link WaitForTransactionReceiptReturnType}
 *
 * @example
 * import { createPublicClient, waitForTransactionReceipt, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const transactionReceipt = await waitForTransactionReceipt(client, {
 *   hash: '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d',
 * })
 */
async function waitForTransactionReceipt(client, parameters) {
    const { checkReplacement = true, confirmations = 1, hash, onReplaced, retryCount = 6, retryDelay = ({ count }) => ~~(1 << count) * 200, // exponential backoff
    timeout = 180_000, } = parameters;
    const observerId = stringify$1(['waitForTransactionReceipt', client.uid, hash]);
    const pollingInterval = (() => {
        if (parameters.pollingInterval)
            return parameters.pollingInterval;
        if (client.chain?.experimental_preconfirmationTime)
            return client.chain.experimental_preconfirmationTime;
        return client.pollingInterval;
    })();
    let transaction;
    let replacedTransaction;
    let receipt;
    let retrying = false;
    let _unobserve;
    let _unwatch;
    const { promise, resolve, reject } = withResolvers();
    const timer = timeout
        ? setTimeout(() => {
            _unwatch?.();
            _unobserve?.();
            reject(new WaitForTransactionReceiptTimeoutError({ hash }));
        }, timeout)
        : undefined;
    _unobserve = observe(observerId, { onReplaced, resolve, reject }, async (emit) => {
        receipt = await getAction(client, getTransactionReceipt, 'getTransactionReceipt')({ hash }).catch(() => undefined);
        if (receipt && confirmations <= 1) {
            clearTimeout(timer);
            emit.resolve(receipt);
            _unobserve?.();
            return;
        }
        _unwatch = getAction(client, watchBlockNumber, 'watchBlockNumber')({
            emitMissed: true,
            emitOnBegin: true,
            poll: true,
            pollingInterval,
            async onBlockNumber(blockNumber_) {
                const done = (fn) => {
                    clearTimeout(timer);
                    _unwatch?.();
                    fn();
                    _unobserve?.();
                };
                let blockNumber = blockNumber_;
                if (retrying)
                    return;
                try {
                    // If we already have a valid receipt, let's check if we have enough
                    // confirmations. If we do, then we can resolve.
                    if (receipt) {
                        if (confirmations > 1 &&
                            (!receipt.blockNumber ||
                                blockNumber - receipt.blockNumber + 1n < confirmations))
                            return;
                        done(() => emit.resolve(receipt));
                        return;
                    }
                    // Get the transaction to check if it's been replaced.
                    // We need to retry as some RPC Providers may be slow to sync
                    // up mined transactions.
                    if (checkReplacement && !transaction) {
                        retrying = true;
                        await withRetry(async () => {
                            transaction = (await getAction(client, getTransaction, 'getTransaction')({ hash }));
                            if (transaction.blockNumber)
                                blockNumber = transaction.blockNumber;
                        }, {
                            delay: retryDelay,
                            retryCount,
                        });
                        retrying = false;
                    }
                    // Get the receipt to check if it's been processed.
                    receipt = await getAction(client, getTransactionReceipt, 'getTransactionReceipt')({ hash });
                    // Check if we have enough confirmations. If not, continue polling.
                    if (confirmations > 1 &&
                        (!receipt.blockNumber ||
                            blockNumber - receipt.blockNumber + 1n < confirmations))
                        return;
                    done(() => emit.resolve(receipt));
                }
                catch (err) {
                    // If the receipt is not found, the transaction will be pending.
                    // We need to check if it has potentially been replaced.
                    if (err instanceof TransactionNotFoundError ||
                        err instanceof TransactionReceiptNotFoundError) {
                        if (!transaction) {
                            retrying = false;
                            return;
                        }
                        try {
                            replacedTransaction = transaction;
                            // Let's retrieve the transactions from the current block.
                            // We need to retry as some RPC Providers may be slow to sync
                            // up mined blocks.
                            retrying = true;
                            const block = await withRetry(() => getAction(client, getBlock, 'getBlock')({
                                blockNumber,
                                includeTransactions: true,
                            }), {
                                delay: retryDelay,
                                retryCount,
                                shouldRetry: ({ error }) => error instanceof BlockNotFoundError,
                            });
                            retrying = false;
                            const replacementTransaction = block.transactions.find(({ from, nonce }) => from === replacedTransaction.from &&
                                nonce === replacedTransaction.nonce);
                            // If we couldn't find a replacement transaction, continue polling.
                            if (!replacementTransaction)
                                return;
                            // If we found a replacement transaction, return it's receipt.
                            receipt = await getAction(client, getTransactionReceipt, 'getTransactionReceipt')({
                                hash: replacementTransaction.hash,
                            });
                            // Check if we have enough confirmations. If not, continue polling.
                            if (confirmations > 1 &&
                                (!receipt.blockNumber ||
                                    blockNumber - receipt.blockNumber + 1n < confirmations))
                                return;
                            let reason = 'replaced';
                            if (replacementTransaction.to === replacedTransaction.to &&
                                replacementTransaction.value === replacedTransaction.value &&
                                replacementTransaction.input === replacedTransaction.input) {
                                reason = 'repriced';
                            }
                            else if (replacementTransaction.from === replacementTransaction.to &&
                                replacementTransaction.value === 0n) {
                                reason = 'cancelled';
                            }
                            done(() => {
                                emit.onReplaced?.({
                                    reason,
                                    replacedTransaction: replacedTransaction,
                                    transaction: replacementTransaction,
                                    transactionReceipt: receipt,
                                });
                                emit.resolve(receipt);
                            });
                        }
                        catch (err_) {
                            done(() => emit.reject(err_));
                        }
                    }
                    else {
                        done(() => emit.reject(err));
                    }
                }
            },
        });
    });
    return promise;
}

/**
 * Watches and returns information for incoming blocks.
 *
 * - Docs: https://viem.sh/docs/actions/public/watchBlocks
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_watching-blocks
 * - JSON-RPC Methods:
 *   - When `poll: true`, calls [`eth_getBlockByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getBlockByNumber) on a polling interval.
 *   - When `poll: false` & WebSocket Transport, uses a WebSocket subscription via [`eth_subscribe`](https://docs.alchemy.com/reference/eth-subscribe-polygon) and the `"newHeads"` event.
 *
 * @param client - Client to use
 * @param parameters - {@link WatchBlocksParameters}
 * @returns A function that can be invoked to stop watching for new block numbers. {@link WatchBlocksReturnType}
 *
 * @example
 * import { createPublicClient, watchBlocks, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const unwatch = watchBlocks(client, {
 *   onBlock: (block) => console.log(block),
 * })
 */
function watchBlocks(client, { blockTag = client.experimental_blockTag ?? 'latest', emitMissed = false, emitOnBegin = false, onBlock, onError, includeTransactions: includeTransactions_, poll: poll_, pollingInterval = client.pollingInterval, }) {
    const enablePolling = (() => {
        if (typeof poll_ !== 'undefined')
            return poll_;
        if (client.transport.type === 'webSocket' ||
            client.transport.type === 'ipc')
            return false;
        if (client.transport.type === 'fallback' &&
            (client.transport.transports[0].config.type === 'webSocket' ||
                client.transport.transports[0].config.type === 'ipc'))
            return false;
        return true;
    })();
    const includeTransactions = includeTransactions_ ?? false;
    let prevBlock;
    const pollBlocks = () => {
        const observerId = stringify$1([
            'watchBlocks',
            client.uid,
            blockTag,
            emitMissed,
            emitOnBegin,
            includeTransactions,
            pollingInterval,
        ]);
        return observe(observerId, { onBlock, onError }, (emit) => poll(async () => {
            try {
                const block = await getAction(client, getBlock, 'getBlock')({
                    blockTag,
                    includeTransactions,
                });
                if (block.number !== null && prevBlock?.number != null) {
                    // If the current block number is the same as the previous,
                    // we can skip.
                    if (block.number === prevBlock.number)
                        return;
                    // If we have missed out on some previous blocks, and the
                    // `emitMissed` flag is truthy, let's emit those blocks.
                    if (block.number - prevBlock.number > 1 && emitMissed) {
                        for (let i = prevBlock?.number + 1n; i < block.number; i++) {
                            const block = (await getAction(client, getBlock, 'getBlock')({
                                blockNumber: i,
                                includeTransactions,
                            }));
                            emit.onBlock(block, prevBlock);
                            prevBlock = block;
                        }
                    }
                }
                if (
                // If no previous block exists, emit.
                prevBlock?.number == null ||
                    // If the block tag is "pending" with no block number, emit.
                    (blockTag === 'pending' && block?.number == null) ||
                    // If the next block number is greater than the previous block number, emit.
                    // We don't want to emit blocks in the past.
                    (block.number !== null && block.number > prevBlock.number)) {
                    emit.onBlock(block, prevBlock);
                    prevBlock = block;
                }
            }
            catch (err) {
                emit.onError?.(err);
            }
        }, {
            emitOnBegin,
            interval: pollingInterval,
        }));
    };
    const subscribeBlocks = () => {
        let active = true;
        let emitFetched = true;
        let unsubscribe = () => (active = false);
        (async () => {
            try {
                if (emitOnBegin) {
                    getAction(client, getBlock, 'getBlock')({
                        blockTag,
                        includeTransactions,
                    })
                        .then((block) => {
                        if (!active)
                            return;
                        if (!emitFetched)
                            return;
                        onBlock(block, undefined);
                        emitFetched = false;
                    })
                        .catch(onError);
                }
                const transport = (() => {
                    if (client.transport.type === 'fallback') {
                        const transport = client.transport.transports.find((transport) => transport.config.type === 'webSocket' ||
                            transport.config.type === 'ipc');
                        if (!transport)
                            return client.transport;
                        return transport.value;
                    }
                    return client.transport;
                })();
                const { unsubscribe: unsubscribe_ } = await transport.subscribe({
                    params: ['newHeads'],
                    async onData(data) {
                        if (!active)
                            return;
                        const block = (await getAction(client, getBlock, 'getBlock')({
                            blockNumber: data.result?.number,
                            includeTransactions,
                        }).catch(() => { }));
                        if (!active)
                            return;
                        onBlock(block, prevBlock);
                        emitFetched = false;
                        prevBlock = block;
                    },
                    onError(error) {
                        onError?.(error);
                    },
                });
                unsubscribe = unsubscribe_;
                if (!active)
                    unsubscribe();
            }
            catch (err) {
                onError?.(err);
            }
        })();
        return () => unsubscribe();
    };
    return enablePolling ? pollBlocks() : subscribeBlocks();
}

/**
 * Watches and returns emitted [Event Logs](https://viem.sh/docs/glossary/terms#event-log).
 *
 * - Docs: https://viem.sh/docs/actions/public/watchEvent
 * - JSON-RPC Methods:
 *   - **RPC Provider supports `eth_newFilter`:**
 *     - Calls [`eth_newFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newfilter) to create a filter (called on initialize).
 *     - On a polling interval, it will call [`eth_getFilterChanges`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getfilterchanges).
 *   - **RPC Provider does not support `eth_newFilter`:**
 *     - Calls [`eth_getLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs) for each block between the polling interval.
 *
 * This Action will batch up all the Event Logs found within the [`pollingInterval`](https://viem.sh/docs/actions/public/watchEvent#pollinginterval-optional), and invoke them via [`onLogs`](https://viem.sh/docs/actions/public/watchEvent#onLogs).
 *
 * `watchEvent` will attempt to create an [Event Filter](https://viem.sh/docs/actions/public/createEventFilter) and listen to changes to the Filter per polling interval, however, if the RPC Provider does not support Filters (e.g. `eth_newFilter`), then `watchEvent` will fall back to using [`getLogs`](https://viem.sh/docs/actions/public/getLogs) instead.
 *
 * @param client - Client to use
 * @param parameters - {@link WatchEventParameters}
 * @returns A function that can be invoked to stop watching for new Event Logs. {@link WatchEventReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { watchEvent } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const unwatch = watchEvent(client, {
 *   onLogs: (logs) => console.log(logs),
 * })
 */
function watchEvent(client, { address, args, batch = true, event, events, fromBlock, onError, onLogs, poll: poll_, pollingInterval = client.pollingInterval, strict: strict_, }) {
    const enablePolling = (() => {
        if (typeof poll_ !== 'undefined')
            return poll_;
        if (typeof fromBlock === 'bigint')
            return true;
        if (client.transport.type === 'webSocket' ||
            client.transport.type === 'ipc')
            return false;
        if (client.transport.type === 'fallback' &&
            (client.transport.transports[0].config.type === 'webSocket' ||
                client.transport.transports[0].config.type === 'ipc'))
            return false;
        return true;
    })();
    const strict = strict_ ?? false;
    const pollEvent = () => {
        const observerId = stringify$1([
            'watchEvent',
            address,
            args,
            batch,
            client.uid,
            event,
            pollingInterval,
            fromBlock,
        ]);
        return observe(observerId, { onLogs, onError }, (emit) => {
            let previousBlockNumber;
            if (fromBlock !== undefined)
                previousBlockNumber = fromBlock - 1n;
            let filter;
            let initialized = false;
            const unwatch = poll(async () => {
                if (!initialized) {
                    try {
                        filter = (await getAction(client, createEventFilter, 'createEventFilter')({
                            address,
                            args,
                            event: event,
                            events,
                            strict,
                            fromBlock,
                        }));
                    }
                    catch { }
                    initialized = true;
                    return;
                }
                try {
                    let logs;
                    if (filter) {
                        logs = await getAction(client, getFilterChanges, 'getFilterChanges')({ filter });
                    }
                    else {
                        // If the filter doesn't exist, we will fall back to use `getLogs`.
                        // The fall back exists because some RPC Providers do not support filters.
                        // Fetch the block number to use for `getLogs`.
                        const blockNumber = await getAction(client, getBlockNumber, 'getBlockNumber')({});
                        // If the block number has changed, we will need to fetch the logs.
                        // If the block number doesn't exist, we are yet to reach the first poll interval,
                        // so do not emit any logs.
                        if (previousBlockNumber && previousBlockNumber !== blockNumber) {
                            logs = await getAction(client, getLogs, 'getLogs')({
                                address,
                                args,
                                event: event,
                                events,
                                fromBlock: previousBlockNumber + 1n,
                                toBlock: blockNumber,
                            });
                        }
                        else {
                            logs = [];
                        }
                        previousBlockNumber = blockNumber;
                    }
                    if (logs.length === 0)
                        return;
                    if (batch)
                        emit.onLogs(logs);
                    else
                        for (const log of logs)
                            emit.onLogs([log]);
                }
                catch (err) {
                    // If a filter has been set and gets uninstalled, providers will throw an InvalidInput error.
                    // Reinitialize the filter when this occurs
                    if (filter && err instanceof InvalidInputRpcError)
                        initialized = false;
                    emit.onError?.(err);
                }
            }, {
                emitOnBegin: true,
                interval: pollingInterval,
            });
            return async () => {
                if (filter)
                    await getAction(client, uninstallFilter, 'uninstallFilter')({ filter });
                unwatch();
            };
        });
    };
    const subscribeEvent = () => {
        let active = true;
        let unsubscribe = () => (active = false);
        (async () => {
            try {
                const transport = (() => {
                    if (client.transport.type === 'fallback') {
                        const transport = client.transport.transports.find((transport) => transport.config.type === 'webSocket' ||
                            transport.config.type === 'ipc');
                        if (!transport)
                            return client.transport;
                        return transport.value;
                    }
                    return client.transport;
                })();
                const events_ = events ?? (event ? [event] : undefined);
                let topics = [];
                if (events_) {
                    const encoded = events_.flatMap((event) => encodeEventTopics({
                        abi: [event],
                        eventName: event.name,
                        args,
                    }));
                    // TODO: Clean up type casting
                    topics = [encoded];
                    if (event)
                        topics = topics[0];
                }
                const { unsubscribe: unsubscribe_ } = await transport.subscribe({
                    params: ['logs', { address, topics }],
                    onData(data) {
                        if (!active)
                            return;
                        const log = data.result;
                        try {
                            const { eventName, args } = decodeEventLog({
                                abi: events_ ?? [],
                                data: log.data,
                                topics: log.topics,
                                strict,
                            });
                            const formatted = formatLog(log, { args, eventName });
                            onLogs([formatted]);
                        }
                        catch (err) {
                            let eventName;
                            let isUnnamed;
                            if (err instanceof DecodeLogDataMismatch ||
                                err instanceof DecodeLogTopicsMismatch) {
                                // If strict mode is on, and log data/topics do not match event definition, skip.
                                if (strict_)
                                    return;
                                eventName = err.abiItem.name;
                                isUnnamed = err.abiItem.inputs?.some((x) => !('name' in x && x.name));
                            }
                            // Set args to empty if there is an error decoding (e.g. indexed/non-indexed params mismatch).
                            const formatted = formatLog(log, {
                                args: isUnnamed ? [] : {},
                                eventName,
                            });
                            onLogs([formatted]);
                        }
                    },
                    onError(error) {
                        onError?.(error);
                    },
                });
                unsubscribe = unsubscribe_;
                if (!active)
                    unsubscribe();
            }
            catch (err) {
                onError?.(err);
            }
        })();
        return () => unsubscribe();
    };
    return enablePolling ? pollEvent() : subscribeEvent();
}

/**
 * Watches and returns pending transaction hashes.
 *
 * - Docs: https://viem.sh/docs/actions/public/watchPendingTransactions
 * - JSON-RPC Methods:
 *   - When `poll: true`
 *     - Calls [`eth_newPendingTransactionFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newpendingtransactionfilter) to initialize the filter.
 *     - Calls [`eth_getFilterChanges`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getFilterChanges) on a polling interval.
 *   - When `poll: false` & WebSocket Transport, uses a WebSocket subscription via [`eth_subscribe`](https://docs.alchemy.com/reference/eth-subscribe-polygon) and the `"newPendingTransactions"` event.
 *
 * This Action will batch up all the pending transactions found within the [`pollingInterval`](https://viem.sh/docs/actions/public/watchPendingTransactions#pollinginterval-optional), and invoke them via [`onTransactions`](https://viem.sh/docs/actions/public/watchPendingTransactions#ontransactions).
 *
 * @param client - Client to use
 * @param parameters - {@link WatchPendingTransactionsParameters}
 * @returns A function that can be invoked to stop watching for new pending transaction hashes. {@link WatchPendingTransactionsReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { watchPendingTransactions } from 'viem/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const unwatch = await watchPendingTransactions(client, {
 *   onTransactions: (hashes) => console.log(hashes),
 * })
 */
function watchPendingTransactions(client, { batch = true, onError, onTransactions, poll: poll_, pollingInterval = client.pollingInterval, }) {
    const enablePolling = typeof poll_ !== 'undefined'
        ? poll_
        : client.transport.type !== 'webSocket' && client.transport.type !== 'ipc';
    const pollPendingTransactions = () => {
        const observerId = stringify$1([
            'watchPendingTransactions',
            client.uid,
            batch,
            pollingInterval,
        ]);
        return observe(observerId, { onTransactions, onError }, (emit) => {
            let filter;
            const unwatch = poll(async () => {
                try {
                    if (!filter) {
                        try {
                            filter = await getAction(client, createPendingTransactionFilter, 'createPendingTransactionFilter')({});
                            return;
                        }
                        catch (err) {
                            unwatch();
                            throw err;
                        }
                    }
                    const hashes = await getAction(client, getFilterChanges, 'getFilterChanges')({ filter });
                    if (hashes.length === 0)
                        return;
                    if (batch)
                        emit.onTransactions(hashes);
                    else
                        for (const hash of hashes)
                            emit.onTransactions([hash]);
                }
                catch (err) {
                    emit.onError?.(err);
                }
            }, {
                emitOnBegin: true,
                interval: pollingInterval,
            });
            return async () => {
                if (filter)
                    await getAction(client, uninstallFilter, 'uninstallFilter')({ filter });
                unwatch();
            };
        });
    };
    const subscribePendingTransactions = () => {
        let active = true;
        let unsubscribe = () => (active = false);
        (async () => {
            try {
                const { unsubscribe: unsubscribe_ } = await client.transport.subscribe({
                    params: ['newPendingTransactions'],
                    onData(data) {
                        if (!active)
                            return;
                        const transaction = data.result;
                        onTransactions([transaction]);
                    },
                    onError(error) {
                        onError?.(error);
                    },
                });
                unsubscribe = unsubscribe_;
                if (!active)
                    unsubscribe();
            }
            catch (err) {
                onError?.(err);
            }
        })();
        return () => unsubscribe();
    };
    return enablePolling
        ? pollPendingTransactions()
        : subscribePendingTransactions();
}

/**
 * @description Parses EIP-4361 formatted message into message fields object.
 *
 * @see https://eips.ethereum.org/EIPS/eip-4361
 *
 * @returns EIP-4361 fields object
 */
function parseSiweMessage(message) {
    const { scheme, statement, ...prefix } = (message.match(prefixRegex)
        ?.groups ?? {});
    const { chainId, expirationTime, issuedAt, notBefore, requestId, ...suffix } = (message.match(suffixRegex)?.groups ?? {});
    const resources = message.split('Resources:')[1]?.split('\n- ').slice(1);
    return {
        ...prefix,
        ...suffix,
        ...(chainId ? { chainId: Number(chainId) } : {}),
        ...(expirationTime ? { expirationTime: new Date(expirationTime) } : {}),
        ...(issuedAt ? { issuedAt: new Date(issuedAt) } : {}),
        ...(notBefore ? { notBefore: new Date(notBefore) } : {}),
        ...(requestId ? { requestId } : {}),
        ...(resources ? { resources } : {}),
        ...(scheme ? { scheme } : {}),
        ...(statement ? { statement } : {}),
    };
}
// https://regexr.com/80gdj
const prefixRegex = /^(?:(?<scheme>[a-zA-Z][a-zA-Z0-9+-.]*):\/\/)?(?<domain>[a-zA-Z0-9+-.]*(?::[0-9]{1,5})?) (?:wants you to sign in with your Ethereum account:\n)(?<address>0x[a-fA-F0-9]{40})\n\n(?:(?<statement>.*)\n\n)?/;
// https://regexr.com/80gf9
const suffixRegex = /(?:URI: (?<uri>.+))\n(?:Version: (?<version>.+))\n(?:Chain ID: (?<chainId>\d+))\n(?:Nonce: (?<nonce>[a-zA-Z0-9]+))\n(?:Issued At: (?<issuedAt>.+))(?:\nExpiration Time: (?<expirationTime>.+))?(?:\nNot Before: (?<notBefore>.+))?(?:\nRequest ID: (?<requestId>.+))?/;

/**
 * @description Validates EIP-4361 message.
 *
 * @see https://eips.ethereum.org/EIPS/eip-4361
 */
function validateSiweMessage(parameters) {
    const { address, domain, message, nonce, scheme, time = new Date(), } = parameters;
    if (domain && message.domain !== domain)
        return false;
    if (nonce && message.nonce !== nonce)
        return false;
    if (scheme && message.scheme !== scheme)
        return false;
    if (message.expirationTime && time >= message.expirationTime)
        return false;
    if (message.notBefore && time < message.notBefore)
        return false;
    try {
        if (!message.address)
            return false;
        if (!isAddress(message.address, { strict: false }))
            return false;
        if (address && !isAddressEqual(message.address, address))
            return false;
    }
    catch {
        return false;
    }
    return true;
}

/**
 * Verifies [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361) formatted message was signed.
 *
 * Compatible with Smart Contract Accounts & Externally Owned Accounts via [ERC-6492](https://eips.ethereum.org/EIPS/eip-6492).
 *
 * - Docs {@link https://viem.sh/docs/siwe/actions/verifySiweMessage}
 *
 * @param client - Client to use.
 * @param parameters - {@link VerifySiweMessageParameters}
 * @returns Whether or not the signature is valid. {@link VerifySiweMessageReturnType}
 */
async function verifySiweMessage(client, parameters) {
    const { address, domain, message, nonce, scheme, signature, time = new Date(), ...callRequest } = parameters;
    const parsed = parseSiweMessage(message);
    if (!parsed.address)
        return false;
    const isValid = validateSiweMessage({
        address,
        domain,
        message: parsed,
        nonce,
        scheme,
        time,
    });
    if (!isValid)
        return false;
    const hash = hashMessage(message);
    return verifyHash(client, {
        address: parsed.address,
        hash,
        signature,
        ...callRequest,
    });
}

/**
 * Sends a **signed** transaction to the network synchronously,
 * and waits for the transaction to be included in a block.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/sendRawTransactionSync
 * - JSON-RPC Method: [`eth_sendRawTransactionSync`](https://eips.ethereum.org/EIPS/eip-7966)
 *
 * @param client - Client to use
 * @param parameters - {@link SendRawTransactionParameters}
 * @returns The transaction receipt. {@link SendRawTransactionSyncReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { sendRawTransactionSync } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 *
 * const receipt = await sendRawTransactionSync(client, {
 *   serializedTransaction: '0x02f850018203118080825208808080c080a04012522854168b27e5dc3d5839bab5e6b39e1a0ffd343901ce1622e3d64b48f1a04e00902ae0502c4728cbf12156290df99c3ed7de85b1dbfe20b5c36931733a33'
 * })
 */
async function sendRawTransactionSync(client, { serializedTransaction, throwOnReceiptRevert, timeout, }) {
    const receipt = await client.request({
        method: 'eth_sendRawTransactionSync',
        params: timeout
            ? [serializedTransaction, timeout]
            : [serializedTransaction],
    }, { retryCount: 0 });
    const format = client.chain?.formatters?.transactionReceipt?.format ||
        formatTransactionReceipt;
    const formatted = format(receipt);
    if (formatted.status === 'reverted' && throwOnReceiptRevert)
        throw new TransactionReceiptRevertedError({ receipt: formatted });
    return formatted;
}

function publicActions(client) {
    return {
        call: (args) => call(client, args),
        createAccessList: (args) => createAccessList(client, args),
        createBlockFilter: () => createBlockFilter(client),
        createContractEventFilter: (args) => createContractEventFilter(client, args),
        createEventFilter: (args) => createEventFilter(client, args),
        createPendingTransactionFilter: () => createPendingTransactionFilter(client),
        estimateContractGas: (args) => estimateContractGas(client, args),
        estimateGas: (args) => estimateGas(client, args),
        getBalance: (args) => getBalance(client, args),
        getBlobBaseFee: () => getBlobBaseFee(client),
        getBlock: (args) => getBlock(client, args),
        getBlockNumber: (args) => getBlockNumber(client, args),
        getBlockTransactionCount: (args) => getBlockTransactionCount(client, args),
        getBytecode: (args) => getCode(client, args),
        getChainId: () => getChainId(client),
        getCode: (args) => getCode(client, args),
        getContractEvents: (args) => getContractEvents(client, args),
        getDelegation: (args) => getDelegation(client, args),
        getEip712Domain: (args) => getEip712Domain(client, args),
        getEnsAddress: (args) => getEnsAddress(client, args),
        getEnsAvatar: (args) => getEnsAvatar(client, args),
        getEnsName: (args) => getEnsName(client, args),
        getEnsResolver: (args) => getEnsResolver(client, args),
        getEnsText: (args) => getEnsText(client, args),
        getFeeHistory: (args) => getFeeHistory(client, args),
        estimateFeesPerGas: (args) => estimateFeesPerGas(client, args),
        getFilterChanges: (args) => getFilterChanges(client, args),
        getFilterLogs: (args) => getFilterLogs(client, args),
        getGasPrice: () => getGasPrice(client),
        getLogs: (args) => getLogs(client, args),
        getProof: (args) => getProof(client, args),
        estimateMaxPriorityFeePerGas: (args) => estimateMaxPriorityFeePerGas(client, args),
        fillTransaction: (args) => fillTransaction(client, args),
        getStorageAt: (args) => getStorageAt(client, args),
        getTransaction: (args) => getTransaction(client, args),
        getTransactionConfirmations: (args) => getTransactionConfirmations(client, args),
        getTransactionCount: (args) => getTransactionCount(client, args),
        getTransactionReceipt: (args) => getTransactionReceipt(client, args),
        multicall: (args) => multicall(client, args),
        prepareTransactionRequest: (args) => prepareTransactionRequest(client, args),
        readContract: (args) => readContract(client, args),
        sendRawTransaction: (args) => sendRawTransaction(client, args),
        sendRawTransactionSync: (args) => sendRawTransactionSync(client, args),
        simulate: (args) => simulateBlocks(client, args),
        simulateBlocks: (args) => simulateBlocks(client, args),
        simulateCalls: (args) => simulateCalls(client, args),
        simulateContract: (args) => simulateContract(client, args),
        verifyHash: (args) => verifyHash(client, args),
        verifyMessage: (args) => verifyMessage(client, args),
        verifySiweMessage: (args) => verifySiweMessage(client, args),
        verifyTypedData: (args) => verifyTypedData(client, args),
        uninstallFilter: (args) => uninstallFilter(client, args),
        waitForTransactionReceipt: (args) => waitForTransactionReceipt(client, args),
        watchBlocks: (args) => watchBlocks(client, args),
        watchBlockNumber: (args) => watchBlockNumber(client, args),
        watchContractEvent: (args) => watchContractEvent(client, args),
        watchEvent: (args) => watchEvent(client, args),
        watchPendingTransactions: (args) => watchPendingTransactions(client, args),
    };
}

/**
 * Creates a Public Client with a given [Transport](https://viem.sh/docs/clients/intro) configured for a [Chain](https://viem.sh/docs/clients/chains).
 *
 * - Docs: https://viem.sh/docs/clients/public
 *
 * A Public Client is an interface to "public" [JSON-RPC API](https://ethereum.org/en/developers/docs/apis/json-rpc/) methods such as retrieving block numbers, transactions, reading from smart contracts, etc through [Public Actions](/docs/actions/public/introduction).
 *
 * @param config - {@link PublicClientConfig}
 * @returns A Public Client. {@link PublicClient}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 */
function createPublicClient(parameters) {
    const { key = 'public', name = 'Public Client' } = parameters;
    const client = createClient({
        ...parameters,
        key,
        name,
        type: 'publicClient',
    });
    return client.extend(publicActions);
}

/**
 * Adds an EVM chain to the wallet.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/addChain
 * - JSON-RPC Methods: [`eth_addEthereumChain`](https://eips.ethereum.org/EIPS/eip-3085)
 *
 * @param client - Client to use
 * @param parameters - {@link AddChainParameters}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { optimism } from 'viem/chains'
 * import { addChain } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   transport: custom(window.ethereum),
 * })
 * await addChain(client, { chain: optimism })
 */
async function addChain(client, { chain }) {
    const { id, name, nativeCurrency, rpcUrls, blockExplorers } = chain;
    await client.request({
        method: 'wallet_addEthereumChain',
        params: [
            {
                chainId: numberToHex(id),
                chainName: name,
                nativeCurrency,
                rpcUrls: rpcUrls.default.http,
                blockExplorerUrls: blockExplorers
                    ? Object.values(blockExplorers).map(({ url }) => url)
                    : undefined,
            },
        ],
    }, { dedupe: true, retryCount: 0 });
}

/**
 * Deploys a contract to the network, given bytecode and constructor arguments.
 *
 * - Docs: https://viem.sh/docs/contract/deployContract
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts_deploying-contracts
 *
 * @param client - Client to use
 * @param parameters - {@link DeployContractParameters}
 * @returns The [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash. {@link DeployContractReturnType}
 *
 * @example
 * import { createWalletClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet } from 'viem/chains'
 * import { deployContract } from 'viem/contract'
 *
 * const client = createWalletClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const hash = await deployContract(client, {
 *   abi: [],
 *   account: '0x…,
 *   bytecode: '0x608060405260405161083e38038061083e833981016040819052610...',
 * })
 */
function deployContract(walletClient, parameters) {
    const { abi, args, bytecode, ...request } = parameters;
    const calldata = encodeDeployData({ abi, args, bytecode });
    return sendTransaction(walletClient, {
        ...request,
        ...(request.authorizationList ? { to: null } : {}),
        data: calldata,
    });
}

/**
 * Returns a list of account addresses owned by the wallet or client.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/getAddresses
 * - JSON-RPC Methods: [`eth_accounts`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_accounts)
 *
 * @param client - Client to use
 * @returns List of account addresses owned by the wallet or client. {@link GetAddressesReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getAddresses } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const accounts = await getAddresses(client)
 */
async function getAddresses(client) {
    if (client.account?.type === 'local')
        return [client.account.address];
    const addresses = await client.request({ method: 'eth_accounts' }, { dedupe: true });
    return addresses.map((address) => checksumAddress(address));
}

/**
 * Extract capabilities that a connected wallet supports (e.g. paymasters, session keys, etc).
 *
 * - Docs: https://viem.sh/docs/actions/wallet/getCapabilities
 * - JSON-RPC Methods: [`wallet_getCapabilities`](https://eips.ethereum.org/EIPS/eip-5792)
 *
 * @param client - Client to use
 * @returns The wallet's capabilities. {@link GetCapabilitiesReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getCapabilities } from 'viem/actions'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const capabilities = await getCapabilities(client)
 */
async function getCapabilities(client, parameters = {}) {
    const { account = client.account, chainId } = parameters;
    const account_ = account ? parseAccount(account) : undefined;
    const params = chainId
        ? [account_?.address, [numberToHex(chainId)]]
        : [account_?.address];
    const capabilities_raw = await client.request({
        method: 'wallet_getCapabilities',
        params,
    });
    const capabilities = {};
    for (const [chainId, capabilities_] of Object.entries(capabilities_raw)) {
        capabilities[Number(chainId)] = {};
        for (let [key, value] of Object.entries(capabilities_)) {
            if (key === 'addSubAccount')
                key = 'unstable_addSubAccount';
            capabilities[Number(chainId)][key] = value;
        }
    }
    return (typeof chainId === 'number' ? capabilities[chainId] : capabilities);
}

/**
 * Gets the wallets current permissions.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/getPermissions
 * - JSON-RPC Methods: [`wallet_getPermissions`](https://eips.ethereum.org/EIPS/eip-2255)
 *
 * @param client - Client to use
 * @returns The wallet permissions. {@link GetPermissionsReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getPermissions } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const permissions = await getPermissions(client)
 */
async function getPermissions(client) {
    const permissions = await client.request({ method: 'wallet_getPermissions' }, { dedupe: true });
    return permissions;
}

/**
 * Prepares an [EIP-7702 Authorization](https://eips.ethereum.org/EIPS/eip-7702) object for signing.
 * This Action will fill the required fields of the Authorization object if they are not provided (e.g. `nonce` and `chainId`).
 *
 * With the prepared Authorization object, you can use [`signAuthorization`](https://viem.sh/docs/eip7702/signAuthorization) to sign over the Authorization object.
 *
 * @param client - Client to use
 * @param parameters - {@link PrepareAuthorizationParameters}
 * @returns The prepared Authorization object. {@link PrepareAuthorizationReturnType}
 *
 * @example
 * import { createClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet } from 'viem/chains'
 * import { prepareAuthorization } from 'viem/experimental'
 *
 * const client = createClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const authorization = await prepareAuthorization(client, {
 *   account: privateKeyToAccount('0x..'),
 *   contractAddress: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 * })
 *
 * @example
 * // Account Hoisting
 * import { createClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet } from 'viem/chains'
 * import { prepareAuthorization } from 'viem/experimental'
 *
 * const client = createClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const authorization = await prepareAuthorization(client, {
 *   contractAddress: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 * })
 */
async function prepareAuthorization(client, parameters) {
    const { account: account_ = client.account, chainId, nonce } = parameters;
    if (!account_)
        throw new AccountNotFoundError({
            docsPath: '/docs/eip7702/prepareAuthorization',
        });
    const account = parseAccount(account_);
    const executor = (() => {
        if (!parameters.executor)
            return undefined;
        if (parameters.executor === 'self')
            return parameters.executor;
        return parseAccount(parameters.executor);
    })();
    const authorization = {
        address: parameters.contractAddress ?? parameters.address,
        chainId,
        nonce,
    };
    if (typeof authorization.chainId === 'undefined')
        authorization.chainId =
            client.chain?.id ??
                (await getAction(client, getChainId, 'getChainId')({}));
    if (typeof authorization.nonce === 'undefined') {
        authorization.nonce = await getAction(client, getTransactionCount, 'getTransactionCount')({
            address: account.address,
            blockTag: 'pending',
        });
        if (executor === 'self' ||
            (executor?.address && isAddressEqual(executor.address, account.address)))
            authorization.nonce += 1;
    }
    return authorization;
}

/**
 * Requests a list of accounts managed by a wallet.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/requestAddresses
 * - JSON-RPC Methods: [`eth_requestAccounts`](https://eips.ethereum.org/EIPS/eip-1102)
 *
 * Sends a request to the wallet, asking for permission to access the user's accounts. After the user accepts the request, it will return a list of accounts (addresses).
 *
 * This API can be useful for dapps that need to access the user's accounts in order to execute transactions or interact with smart contracts.
 *
 * @param client - Client to use
 * @returns List of accounts managed by a wallet {@link RequestAddressesReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { requestAddresses } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const accounts = await requestAddresses(client)
 */
async function requestAddresses(client) {
    const addresses = await client.request({ method: 'eth_requestAccounts' }, { dedupe: true, retryCount: 0 });
    return addresses.map((address) => getAddress(address));
}

/**
 * Requests permissions for a wallet.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/requestPermissions
 * - JSON-RPC Methods: [`wallet_requestPermissions`](https://eips.ethereum.org/EIPS/eip-2255)
 *
 * @param client - Client to use
 * @param parameters - {@link RequestPermissionsParameters}
 * @returns The wallet permissions. {@link RequestPermissionsReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { requestPermissions } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const permissions = await requestPermissions(client, {
 *   eth_accounts: {}
 * })
 */
async function requestPermissions(client, permissions) {
    return client.request({
        method: 'wallet_requestPermissions',
        params: [permissions],
    }, { retryCount: 0 });
}

/**
 * Requests the connected wallet to send a batch of calls, and waits for the calls to be included in a block.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/sendCallsSync
 * - JSON-RPC Methods: [`wallet_sendCalls`](https://eips.ethereum.org/EIPS/eip-5792)
 *
 * @param client - Client to use
 * @returns Calls status. {@link SendCallsSyncReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { sendCalls } from 'viem/actions'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const status = await sendCallsSync(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   calls: [
 *     {
 *       data: '0xdeadbeef',
 *       to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *     },
 *     {
 *       to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *       value: 69420n,
 *     },
 *   ],
 * })
 */
async function sendCallsSync(client, parameters) {
    const { chain = client.chain } = parameters;
    const timeout = parameters.timeout ?? Math.max((chain?.blockTime ?? 0) * 3, 5_000);
    const result = await getAction(client, sendCalls, 'sendCalls')(parameters);
    const status = await getAction(client, waitForCallsStatus, 'waitForCallsStatus')({
        ...parameters,
        id: result.id,
        timeout,
    });
    return status;
}

const supportsWalletNamespace = new LruMap$1(128);
/**
 * Creates, signs, and sends a new transaction to the network synchronously.
 * Returns the transaction receipt.
 *
 * @param client - Client to use
 * @param parameters - {@link SendTransactionSyncParameters}
 * @returns The transaction receipt. {@link SendTransactionSyncReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { sendTransactionSync } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const receipt = await sendTransactionSync(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *   value: 1000000000000000000n,
 * })
 *
 * @example
 * // Account Hoisting
 * import { createWalletClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet } from 'viem/chains'
 * import { sendTransactionSync } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const receipt = await sendTransactionSync(client, {
 *   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *   value: 1000000000000000000n,
 * })
 */
async function sendTransactionSync(client, parameters) {
    const { account: account_ = client.account, assertChainId = true, chain = client.chain, accessList, authorizationList, blobs, data, dataSuffix = typeof client.dataSuffix === 'string'
        ? client.dataSuffix
        : client.dataSuffix?.value, gas, gasPrice, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, nonce, pollingInterval, throwOnReceiptRevert, type, value, ...rest } = parameters;
    const timeout = parameters.timeout ?? Math.max((chain?.blockTime ?? 0) * 3, 5_000);
    if (typeof account_ === 'undefined')
        throw new AccountNotFoundError({
            docsPath: '/docs/actions/wallet/sendTransactionSync',
        });
    const account = account_ ? parseAccount(account_) : null;
    try {
        assertRequest(parameters);
        const to = await (async () => {
            // If `to` exists on the parameters, use that.
            if (parameters.to)
                return parameters.to;
            // If `to` is null, we are sending a deployment transaction.
            if (parameters.to === null)
                return undefined;
            // If no `to` exists, and we are sending a EIP-7702 transaction, use the
            // address of the first authorization in the list.
            if (authorizationList && authorizationList.length > 0)
                return await recoverAuthorizationAddress({
                    authorization: authorizationList[0],
                }).catch(() => {
                    throw new BaseError$1('`to` is required. Could not infer from `authorizationList`.');
                });
            // Otherwise, we are sending a deployment transaction.
            return undefined;
        })();
        if (account?.type === 'json-rpc' || account === null) {
            let chainId;
            if (chain !== null) {
                chainId = await getAction(client, getChainId, 'getChainId')({});
                if (assertChainId)
                    assertCurrentChain({
                        currentChainId: chainId,
                        chain,
                    });
            }
            const chainFormat = client.chain?.formatters?.transactionRequest?.format;
            const format = chainFormat || formatTransactionRequest;
            const request = format({
                // Pick out extra data that might exist on the chain's transaction request type.
                ...extract$1(rest, { format: chainFormat }),
                accessList,
                account,
                authorizationList,
                blobs,
                chainId,
                data: data ? concat$1([data, dataSuffix ?? '0x']) : data,
                gas,
                gasPrice,
                maxFeePerBlobGas,
                maxFeePerGas,
                maxPriorityFeePerGas,
                nonce,
                to,
                type,
                value,
            }, 'sendTransaction');
            const isWalletNamespaceSupported = supportsWalletNamespace.get(client.uid);
            const method = isWalletNamespaceSupported
                ? 'wallet_sendTransaction'
                : 'eth_sendTransaction';
            const hash = await (async () => {
                try {
                    return await client.request({
                        method,
                        params: [request],
                    }, { retryCount: 0 });
                }
                catch (e) {
                    if (isWalletNamespaceSupported === false)
                        throw e;
                    const error = e;
                    // If the transport does not support the method or input, attempt to use the
                    // `wallet_sendTransaction` method.
                    if (error.name === 'InvalidInputRpcError' ||
                        error.name === 'InvalidParamsRpcError' ||
                        error.name === 'MethodNotFoundRpcError' ||
                        error.name === 'MethodNotSupportedRpcError') {
                        return (await client
                            .request({
                            method: 'wallet_sendTransaction',
                            params: [request],
                        }, { retryCount: 0 })
                            .then((hash) => {
                            supportsWalletNamespace.set(client.uid, true);
                            return hash;
                        })
                            .catch((e) => {
                            const walletNamespaceError = e;
                            if (walletNamespaceError.name === 'MethodNotFoundRpcError' ||
                                walletNamespaceError.name === 'MethodNotSupportedRpcError') {
                                supportsWalletNamespace.set(client.uid, false);
                                throw error;
                            }
                            throw walletNamespaceError;
                        }));
                    }
                    throw error;
                }
            })();
            const receipt = await getAction(client, waitForTransactionReceipt, 'waitForTransactionReceipt')({
                checkReplacement: false,
                hash,
                pollingInterval,
                timeout,
            });
            if (throwOnReceiptRevert && receipt.status === 'reverted')
                throw new TransactionReceiptRevertedError({ receipt });
            return receipt;
        }
        if (account?.type === 'local') {
            // Prepare the request for signing (assign appropriate fees, etc.)
            const request = await getAction(client, prepareTransactionRequest, 'prepareTransactionRequest')({
                account,
                accessList,
                authorizationList,
                blobs,
                chain,
                data: data ? concat$1([data, dataSuffix ?? '0x']) : data,
                gas,
                gasPrice,
                maxFeePerBlobGas,
                maxFeePerGas,
                maxPriorityFeePerGas,
                nonce,
                nonceManager: account.nonceManager,
                parameters: [...defaultParameters, 'sidecars'],
                type,
                value,
                ...rest,
                to,
            });
            const serializer = chain?.serializers?.transaction;
            const serializedTransaction = (await account.signTransaction(request, {
                serializer,
            }));
            return (await getAction(client, sendRawTransactionSync, 'sendRawTransactionSync')({
                serializedTransaction,
                throwOnReceiptRevert,
                timeout: parameters.timeout,
            }));
        }
        if (account?.type === 'smart')
            throw new AccountTypeNotSupportedError({
                metaMessages: [
                    'Consider using the `sendUserOperation` Action instead.',
                ],
                docsPath: '/docs/actions/bundler/sendUserOperation',
                type: 'smart',
            });
        throw new AccountTypeNotSupportedError({
            docsPath: '/docs/actions/wallet/sendTransactionSync',
            type: account?.type,
        });
    }
    catch (err) {
        if (err instanceof AccountTypeNotSupportedError)
            throw err;
        throw getTransactionError(err, {
            ...parameters,
            account,
            chain: parameters.chain || undefined,
        });
    }
}

/**
 * Requests for the wallet to show information about a call batch
 * that was sent via `sendCalls`.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/showCallsStatus
 * - JSON-RPC Methods: [`wallet_showCallsStatus`](https://eips.ethereum.org/EIPS/eip-5792)
 *
 * @param client - Client to use
 * @returns Status of the calls. {@link ShowCallsStatusReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { showCallsStatus } from 'viem/actions'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * await showCallsStatus(client, { id: '0xdeadbeef' })
 */
async function showCallsStatus(client, parameters) {
    const { id } = parameters;
    await client.request({
        method: 'wallet_showCallsStatus',
        params: [id],
    });
    return;
}

/**
 * Signs an [EIP-7702 Authorization](https://eips.ethereum.org/EIPS/eip-7702) object.
 *
 * With the calculated signature, you can:
 * - use [`verifyAuthorization`](https://viem.sh/docs/eip7702/verifyAuthorization) to verify the signed Authorization object,
 * - use [`recoverAuthorizationAddress`](https://viem.sh/docs/eip7702/recoverAuthorizationAddress) to recover the signing address from the signed Authorization object.
 *
 * @param client - Client to use
 * @param parameters - {@link SignAuthorizationParameters}
 * @returns The signed Authorization object. {@link SignAuthorizationReturnType}
 *
 * @example
 * import { createClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet } from 'viem/chains'
 * import { signAuthorization } from 'viem/experimental'
 *
 * const client = createClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const signature = await signAuthorization(client, {
 *   account: privateKeyToAccount('0x..'),
 *   contractAddress: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 * })
 *
 * @example
 * // Account Hoisting
 * import { createClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet } from 'viem/chains'
 * import { signAuthorization } from 'viem/experimental'
 *
 * const client = createClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const signature = await signAuthorization(client, {
 *   contractAddress: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 * })
 */
async function signAuthorization(client, parameters) {
    const { account: account_ = client.account } = parameters;
    if (!account_)
        throw new AccountNotFoundError({
            docsPath: '/docs/eip7702/signAuthorization',
        });
    const account = parseAccount(account_);
    if (!account.signAuthorization)
        throw new AccountTypeNotSupportedError({
            docsPath: '/docs/eip7702/signAuthorization',
            metaMessages: [
                'The `signAuthorization` Action does not support JSON-RPC Accounts.',
            ],
            type: account.type,
        });
    const authorization = await prepareAuthorization(client, parameters);
    return account.signAuthorization(authorization);
}

/**
 * Calculates an Ethereum-specific signature in [EIP-191 format](https://eips.ethereum.org/EIPS/eip-191): `keccak256("\x19Ethereum Signed Message:\n" + len(message) + message))`.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/signMessage
 * - JSON-RPC Methods:
 *   - JSON-RPC Accounts: [`personal_sign`](https://docs.metamask.io/guide/signing-data#personal-sign)
 *   - Local Accounts: Signs locally. No JSON-RPC request.
 *
 * With the calculated signature, you can:
 * - use [`verifyMessage`](https://viem.sh/docs/utilities/verifyMessage) to verify the signature,
 * - use [`recoverMessageAddress`](https://viem.sh/docs/utilities/recoverMessageAddress) to recover the signing address from a signature.
 *
 * @param client - Client to use
 * @param parameters - {@link SignMessageParameters}
 * @returns The signed message. {@link SignMessageReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { signMessage } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const signature = await signMessage(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   message: 'hello world',
 * })
 *
 * @example
 * // Account Hoisting
 * import { createWalletClient, custom } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet } from 'viem/chains'
 * import { signMessage } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const signature = await signMessage(client, {
 *   message: 'hello world',
 * })
 */
async function signMessage(client, { account: account_ = client.account, message, }) {
    if (!account_)
        throw new AccountNotFoundError({
            docsPath: '/docs/actions/wallet/signMessage',
        });
    const account = parseAccount(account_);
    if (account.signMessage)
        return account.signMessage({ message });
    const message_ = (() => {
        if (typeof message === 'string')
            return stringToHex(message);
        if (message.raw instanceof Uint8Array)
            return toHex(message.raw);
        return message.raw;
    })();
    return client.request({
        method: 'personal_sign',
        params: [message_, account.address],
    }, { retryCount: 0 });
}

/**
 * Signs a transaction.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/signTransaction
 * - JSON-RPC Methods:
 *   - JSON-RPC Accounts: [`eth_signTransaction`](https://ethereum.github.io/execution-apis/api-documentation/)
 *   - Local Accounts: Signs locally. No JSON-RPC request.
 *
 * @param args - {@link SignTransactionParameters}
 * @returns The signed serialized transaction. {@link SignTransactionReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { signTransaction } from 'viem/actions'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const signature = await signTransaction(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   to: '0x0000000000000000000000000000000000000000',
 *   value: 1n,
 * })
 *
 * @example
 * // Account Hoisting
 * import { createWalletClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet } from 'viem/chains'
 * import { signTransaction } from 'viem/actions'
 *
 * const client = createWalletClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const signature = await signTransaction(client, {
 *   to: '0x0000000000000000000000000000000000000000',
 *   value: 1n,
 * })
 */
async function signTransaction(client, parameters) {
    const { account: account_ = client.account, chain = client.chain, ...transaction } = parameters;
    if (!account_)
        throw new AccountNotFoundError({
            docsPath: '/docs/actions/wallet/signTransaction',
        });
    const account = parseAccount(account_);
    assertRequest({
        account,
        ...parameters,
    });
    const chainId = await getAction(client, getChainId, 'getChainId')({});
    if (chain !== null)
        assertCurrentChain({
            currentChainId: chainId,
            chain,
        });
    const formatters = chain?.formatters || client.chain?.formatters;
    const format = formatters?.transactionRequest?.format || formatTransactionRequest;
    if (account.signTransaction)
        return account.signTransaction({
            ...transaction,
            chainId,
        }, { serializer: client.chain?.serializers?.transaction });
    return await client.request({
        method: 'eth_signTransaction',
        params: [
            {
                ...format({
                    ...transaction,
                    account,
                }, 'signTransaction'),
                chainId: numberToHex(chainId),
                from: account.address,
            },
        ],
    }, { retryCount: 0 });
}

/**
 * Signs typed data and calculates an Ethereum-specific signature in [https://eips.ethereum.org/EIPS/eip-712](https://eips.ethereum.org/EIPS/eip-712): `sign(keccak256("\x19\x01" ‖ domainSeparator ‖ hashStruct(message)))`
 *
 * - Docs: https://viem.sh/docs/actions/wallet/signTypedData
 * - JSON-RPC Methods:
 *   - JSON-RPC Accounts: [`eth_signTypedData_v4`](https://docs.metamask.io/guide/signing-data#signtypeddata-v4)
 *   - Local Accounts: Signs locally. No JSON-RPC request.
 *
 * @param client - Client to use
 * @param parameters - {@link SignTypedDataParameters}
 * @returns The signed data. {@link SignTypedDataReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { signTypedData } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const signature = await signTypedData(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   domain: {
 *     name: 'Ether Mail',
 *     version: '1',
 *     chainId: 1,
 *     verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
 *   },
 *   types: {
 *     Person: [
 *       { name: 'name', type: 'string' },
 *       { name: 'wallet', type: 'address' },
 *     ],
 *     Mail: [
 *       { name: 'from', type: 'Person' },
 *       { name: 'to', type: 'Person' },
 *       { name: 'contents', type: 'string' },
 *     ],
 *   },
 *   primaryType: 'Mail',
 *   message: {
 *     from: {
 *       name: 'Cow',
 *       wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
 *     },
 *     to: {
 *       name: 'Bob',
 *       wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
 *     },
 *     contents: 'Hello, Bob!',
 *   },
 * })
 *
 * @example
 * // Account Hoisting
 * import { createWalletClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet } from 'viem/chains'
 * import { signTypedData } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const signature = await signTypedData(client, {
 *   domain: {
 *     name: 'Ether Mail',
 *     version: '1',
 *     chainId: 1,
 *     verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
 *   },
 *   types: {
 *     Person: [
 *       { name: 'name', type: 'string' },
 *       { name: 'wallet', type: 'address' },
 *     ],
 *     Mail: [
 *       { name: 'from', type: 'Person' },
 *       { name: 'to', type: 'Person' },
 *       { name: 'contents', type: 'string' },
 *     ],
 *   },
 *   primaryType: 'Mail',
 *   message: {
 *     from: {
 *       name: 'Cow',
 *       wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
 *     },
 *     to: {
 *       name: 'Bob',
 *       wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
 *     },
 *     contents: 'Hello, Bob!',
 *   },
 * })
 */
async function signTypedData(client, parameters) {
    const { account: account_ = client.account, domain, message, primaryType, } = parameters;
    if (!account_)
        throw new AccountNotFoundError({
            docsPath: '/docs/actions/wallet/signTypedData',
        });
    const account = parseAccount(account_);
    const types = {
        EIP712Domain: getTypesForEIP712Domain({ domain }),
        ...parameters.types,
    };
    // Need to do a runtime validation check on addresses, byte ranges, integer ranges, etc
    // as we can't statically check this with TypeScript.
    validateTypedData({ domain, message, primaryType, types });
    if (account.signTypedData)
        return account.signTypedData({ domain, message, primaryType, types });
    const typedData = serializeTypedData({ domain, message, primaryType, types });
    return client.request({
        method: 'eth_signTypedData_v4',
        params: [account.address, typedData],
    }, { retryCount: 0 });
}

/**
 * Switch the target chain in a wallet.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/switchChain
 * - JSON-RPC Methods: [`wallet_switchEthereumChain`](https://eips.ethereum.org/EIPS/eip-3326)
 *
 * @param client - Client to use
 * @param parameters - {@link SwitchChainParameters}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet, optimism } from 'viem/chains'
 * import { switchChain } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * await switchChain(client, { id: optimism.id })
 */
async function switchChain(client, { id }) {
    await client.request({
        method: 'wallet_switchEthereumChain',
        params: [
            {
                chainId: numberToHex(id),
            },
        ],
    }, { retryCount: 0 });
}

/**
 * Adds an EVM chain to the wallet.
 *
 * - Docs: https://viem.sh/docs/actions/wallet/watchAsset
 * - JSON-RPC Methods: [`eth_switchEthereumChain`](https://eips.ethereum.org/EIPS/eip-747)
 *
 * @param client - Client to use
 * @param parameters - {@link WatchAssetParameters}
 * @returns Boolean indicating if the token was successfully added. {@link WatchAssetReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { watchAsset } from 'viem/wallet'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const success = await watchAsset(client, {
 *   type: 'ERC20',
 *   options: {
 *     address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
 *     decimals: 18,
 *     symbol: 'WETH',
 *   },
 * })
 */
async function watchAsset(client, params) {
    const added = await client.request({
        method: 'wallet_watchAsset',
        params,
    }, { retryCount: 0 });
    return added;
}

/**
 * Executes a write function on a contract synchronously.
 * Returns the transaction receipt.
 *
 * - Docs: https://viem.sh/docs/contract/writeContractSync
 *
 * A "write" function on a Solidity contract modifies the state of the blockchain. These types of functions require gas to be executed, and hence a [Transaction](https://viem.sh/docs/glossary/terms) is needed to be broadcast in order to change the state.
 *
 * Internally, uses a [Wallet Client](https://viem.sh/docs/clients/wallet) to call the [`sendTransaction` action](https://viem.sh/docs/actions/wallet/sendTransaction) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).
 *
 * __Warning: The `write` internally sends a transaction – it does not validate if the contract write will succeed (the contract may throw an error). It is highly recommended to [simulate the contract write with `contract.simulate`](https://viem.sh/docs/contract/writeContract#usage) before you execute it.__
 *
 * @param client - Client to use
 * @param parameters - {@link WriteContractParameters}
 * @returns A [Transaction Hash](https://viem.sh/docs/glossary/terms#hash). {@link WriteContractReturnType}
 *
 * @example
 * import { createWalletClient, custom, parseAbi } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { writeContract } from 'viem/contract'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const receipt = await writeContractSync(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *   abi: parseAbi(['function mint(uint32 tokenId) nonpayable']),
 *   functionName: 'mint',
 *   args: [69420],
 * })
 */
async function writeContractSync(client, parameters) {
    return writeContract.internal(client, sendTransactionSync, 'sendTransactionSync', parameters);
}

function walletActions(client) {
    return {
        addChain: (args) => addChain(client, args),
        deployContract: (args) => deployContract(client, args),
        fillTransaction: (args) => fillTransaction(client, args),
        getAddresses: () => getAddresses(client),
        getCallsStatus: (args) => getCallsStatus(client, args),
        getCapabilities: (args) => getCapabilities(client, args),
        getChainId: () => getChainId(client),
        getPermissions: () => getPermissions(client),
        prepareAuthorization: (args) => prepareAuthorization(client, args),
        prepareTransactionRequest: (args) => prepareTransactionRequest(client, args),
        requestAddresses: () => requestAddresses(client),
        requestPermissions: (args) => requestPermissions(client, args),
        sendCalls: (args) => sendCalls(client, args),
        sendCallsSync: (args) => sendCallsSync(client, args),
        sendRawTransaction: (args) => sendRawTransaction(client, args),
        sendRawTransactionSync: (args) => sendRawTransactionSync(client, args),
        sendTransaction: (args) => sendTransaction(client, args),
        sendTransactionSync: (args) => sendTransactionSync(client, args),
        showCallsStatus: (args) => showCallsStatus(client, args),
        signAuthorization: (args) => signAuthorization(client, args),
        signMessage: (args) => signMessage(client, args),
        signTransaction: (args) => signTransaction(client, args),
        signTypedData: (args) => signTypedData(client, args),
        switchChain: (args) => switchChain(client, args),
        waitForCallsStatus: (args) => waitForCallsStatus(client, args),
        watchAsset: (args) => watchAsset(client, args),
        writeContract: (args) => writeContract(client, args),
        writeContractSync: (args) => writeContractSync(client, args),
    };
}

function createWalletClient(parameters) {
    const { key = 'wallet', name = 'Wallet Client', transport } = parameters;
    const client = createClient({
        ...parameters,
        key,
        name,
        transport,
        type: 'walletClient',
    });
    return client.extend(walletActions);
}

/**
 * @description Creates an transport intended to be used with a client.
 */
function createTransport({ key, methods, name, request, retryCount = 3, retryDelay = 150, timeout, type, }, value) {
    const uid$1 = uid();
    return {
        config: {
            key,
            methods,
            name,
            request,
            retryCount,
            retryDelay,
            timeout,
            type,
        },
        request: buildRequest(request, { methods, retryCount, retryDelay, uid: uid$1 }),
        value,
    };
}

class UrlRequiredError extends BaseError$1 {
    constructor() {
        super('No URL was provided to the Transport. Please provide a valid RPC URL to the Transport.', {
            docsPath: '/docs/clients/intro',
            name: 'UrlRequiredError',
        });
    }
}

/**
 * @description Creates a HTTP transport that connects to a JSON-RPC API.
 */
function http(
/** URL of the JSON-RPC API. Defaults to the chain's public RPC URL. */
url, config = {}) {
    const { batch, fetchFn, fetchOptions, key = 'http', methods, name = 'HTTP JSON-RPC', onFetchRequest, onFetchResponse, retryDelay, raw, } = config;
    return ({ chain, retryCount: retryCount_, timeout: timeout_ }) => {
        const { batchSize = 1000, wait = 0 } = typeof batch === 'object' ? batch : {};
        const retryCount = config.retryCount ?? retryCount_;
        const timeout = timeout_ ?? config.timeout ?? 10_000;
        const url_ = url || chain?.rpcUrls.default.http[0];
        if (!url_)
            throw new UrlRequiredError();
        const rpcClient = getHttpRpcClient(url_, {
            fetchFn,
            fetchOptions,
            onRequest: onFetchRequest,
            onResponse: onFetchResponse,
            timeout,
        });
        return createTransport({
            key,
            methods,
            name,
            async request({ method, params }) {
                const body = { method, params };
                const { schedule } = createBatchScheduler({
                    id: url_,
                    wait,
                    shouldSplitBatch(requests) {
                        return requests.length > batchSize;
                    },
                    fn: (body) => rpcClient.request({
                        body,
                    }),
                    sort: (a, b) => a.id - b.id,
                });
                const fn = async (body) => batch
                    ? schedule(body)
                    : [
                        await rpcClient.request({
                            body,
                        }),
                    ];
                const [{ error, result }] = await fn(body);
                if (raw)
                    return { error, result };
                if (error)
                    throw new RpcRequestError({
                        body,
                        error,
                        url: url_,
                    });
                return result;
            },
            retryCount,
            retryDelay,
            timeout,
            type: 'http',
        }, {
            fetchOptions,
            url: url_,
        });
    };
}

const mainnet = /*#__PURE__*/ defineChain({
    id: 1,
    name: 'Ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockTime: 12_000,
    rpcUrls: {
        default: {
            http: ['https://eth.merkle.io'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Etherscan',
            url: 'https://etherscan.io',
            apiUrl: 'https://api.etherscan.io/api',
        },
    },
    contracts: {
        ensUniversalResolver: {
            address: '0xeeeeeeee14d718c2b47d9923deab1335e144eeee',
            blockCreated: 23_085_558,
        },
        multicall3: {
            address: '0xca11bde05977b3631167028862be2a173976ca11',
            blockCreated: 14_353_601,
        },
    },
});

const createViemClients = (rpcUrl) => {
  if (!rpcUrl || typeof rpcUrl !== "string" || !rpcUrl.trim()) {
    throw new Error("createViemClients: rpcUrl is required");
  }
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });

  return { publicClient, walletClient };
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
const buyScTx = (djed, payer, receiver, value, UI, DJED_ADDRESS) => {
  // `receiver` will get the stablecoins
  const data = djed.methods.buyStableCoins(receiver, FEE_UI_UNSCALED, UI).encodeABI();
  
  // `payer` is sending the funds
  return buildTx(payer, DJED_ADDRESS, value, data);
};

const sellScTx = (djed, account, amount, UI, DJED_ADDRESS) => {
  const data = djed.methods
    .sellStableCoins(amount, account, FEE_UI_UNSCALED, UI)
    .encodeABI();
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
const calculateFutureScPrice = async ({
  amountBC,
  amountSC,
  djedAddress,
  oracleAddress,
  stableCoinAddress,
  scDecimalScalingFactor,
  rpcUrl,
}) => {
  try {
    const { publicClient } = createViemClients(rpcUrl);

    const [scTargetPrice, scSupply, ratio] = await Promise.all([
      publicClient.readContract({
        address: oracleAddress,
        abi: oracleArtifact,
        functionName: "readData",
      }),
      publicClient.readContract({
        address: stableCoinAddress,
        abi: coinArtifact,
        functionName: "totalSupply",
      }),
      publicClient.readContract({
        address: djedAddress,
        abi: djedArtifact,
        functionName: "R",
        args: [0],
      }),
    ]);

    const futureScSupply = BigInt(scSupply) + BigInt(amountSC);
    const futureRatio = BigInt(ratio) + BigInt(amountBC);

    if (futureScSupply === 0n) {
      return scTargetPrice;
    } else {
      const futurePrice =
        (futureRatio * BigInt(scDecimalScalingFactor)) / futureScSupply;

      return BigInt(scTargetPrice) < futurePrice
        ? scTargetPrice
        : futurePrice.toString();
    }
  } catch (error) {
    console.log("calculateFutureScPrice error", error);
  }
};

//setting up djed
const getDjedContract = (web3, DJED_ADDRESS) => {
  const djed = new web3.eth.Contract(djedArtifact.abi, DJED_ADDRESS);
  return djed;
};

const getCoinContracts = async (djedContract, web3) => {
  const [stableCoinAddress, reserveCoinAddress] = await Promise.all([
    web3Promise(djedContract, "stableCoin"),
    web3Promise(djedContract, "reserveCoin"),
  ]);
  const stableCoin = new web3.eth.Contract(coinArtifact.abi, stableCoinAddress);
  const reserveCoin = new web3.eth.Contract(
    coinArtifact.abi,
    reserveCoinAddress
  );
  return { stableCoin, reserveCoin };
};
const getDecimals = async (stableCoin, reserveCoin) => {
  const [scDecimals, rcDecimals] = await Promise.all([
    convertInt(web3Promise(stableCoin, "decimals")),
    convertInt(web3Promise(reserveCoin, "decimals")),
  ]);
  return { scDecimals, rcDecimals };
};

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
      scaledUnscaledPromise(web3Promise(stableCoin, "totalSupply"), scDecimals),
      scaledUnscaledPromise(web3Promise(djed, "scPrice", 0), BC_DECIMALS),
      scaledUnscaledPromise(
        web3Promise(reserveCoin, "totalSupply"),
        rcDecimals
      ),
      scaledUnscaledPromise(web3Promise(djed, "R", 0), BC_DECIMALS),
      scaledPromise(web3Promise(djed, "rcBuyingPrice", 0), BC_DECIMALS),
      scaledPromise(web3Promise(djed, "scPrice", 0), BC_DECIMALS),
    ]);

    // Define default empty value
    const emptyValue = decimalScaling("0".toString(10), BC_DECIMALS);
    let scaledSellPriceRc = emptyValue;
    let unscaledSellPriceRc = emptyValue;
    let percentReserveRatio = emptyValue;

    // Check total reserve coin supply to calculate sell price
    if (BigInt(unscaledNumberRc) !== 0n) {
      [scaledSellPriceRc, unscaledSellPriceRc] = await scaledUnscaledPromise(
        web3Promise(djed, "rcTargetPrice", 0),
        BC_DECIMALS
      );
    }

    // Check total stable coin supply to calculate reserve ratio
    if (BigInt(unscaledNumberSc) !== 0n) {
      percentReserveRatio = await percentScaledPromise(
        web3Promise(djed, "ratio"),
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

const getSystemParams = async (djed) => {
  const [
    reserveRatioMinUnscaled,
    reserveRatioMaxUnscaled,
    feeUnscaled,
    treasuryFee,
    thresholdSupplySC,
  ] = await Promise.all([
    web3Promise(djed, "reserveRatioMin"),
    web3Promise(djed, "reserveRatioMax"),
    web3Promise(djed, "fee"),
    percentScaledPromise(web3Promise(djed, "treasuryFee"), SCALING_DECIMALS),
    web3Promise(djed, "thresholdSupplySC"),
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

const getAccountDetails = async (
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

const getOracleAddress = async (djedContract) => {
  return await web3Promise(djedContract, "oracle");
};

const getOracleContract = (web3, oracleAddress, msgSender) => {
  const oracle = new web3.eth.Contract(oracleArtifact.abi, oracleAddress, {
    from: msgSender
  });
  return oracle;
};

export { FEE_UI_UNSCALED, appendFees, buyRcTx, buyScTx, calculateBcUsdEquivalent, calculateFutureScPrice, calculateIsRatioAboveMin, calculateIsRatioBelowMax, calculateRcUsdEquivalent, calculateTxFees, convertToBC, deductFees, getAccountDetails, getBcUsdEquivalent, getCoinContracts, getCoinDetails, getDecimals, getDjedContract, getFees, getOracleAddress, getOracleContract, getRcUsdEquivalent, getScAdaEquivalent, getSystemParams, getWeb3, isTxLimitReached, promiseTx, scalingFactor, sellRcTx, sellScTx, tradeDataPriceBuyRc, tradeDataPriceBuySc, tradeDataPriceCore, tradeDataPriceSellRc, tradeDataPriceSellSc, verifyTx };
