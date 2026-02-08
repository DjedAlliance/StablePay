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

function web3Promise$1(contract, method, ...args) {
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
  return scaledUnscaledPromise(web3Promise$1(djed, method, 0), BC_DECIMALS).then(
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

const convertToBC = (amount, price, decimals) => {
  const decimalScalingFactor = BigInt(Math.pow(10, decimals));
  return (BigInt(amount) * BigInt(price)) / decimalScalingFactor;
};

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

const isTxLimitReached = (amountUSD, totalSCSupply, thresholdSCSupply, txLimit) =>
  (BigInt(amountUSD) > BigInt(txLimit || TRANSACTION_USD_LIMIT)) &&
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

const calculateTxFees = (value, fee, treasuryFee, feeUI) => {
  const f = (BigInt(value) * BigInt(fee)) / BigInt(scalingFactor);
  const f_ui =
    (BigInt(value) * BigInt(feeUI || FEE_UI_UNSCALED)) / BigInt(scalingFactor);
  const f_t = (BigInt(value) * BigInt(treasuryFee)) / BigInt(scalingFactor);

  return { f, f_ui, f_t };
};

const deductFees = (value, fee, treasuryFee) => {
  const { f, f_ui, f_t } = calculateTxFees(value, fee, treasuryFee);
  return BigInt(value) - f - f_ui - f_t;
};

const appendFees = (amountBC, treasuryFee, fee, fee_UI) => {
  const totalFees = BigInt(treasuryFee) + BigInt(fee) + BigInt(fee_UI);
  const substractedFees = BigInt(scalingFactor) - totalFees;
  const appendedFeesAmount =
    (BigInt(amountBC) * BigInt(scalingFactor)) / substractedFees;

  return appendedFeesAmount.toString();
};

const getFees = async (djed) => {
  try {
    const [treasuryFee, fee] = await Promise.all([
      web3Promise$1(djed, "treasuryFee"),
      web3Promise$1(djed, "fee"),
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
const getPriceMethod = async (djed, operation) => {
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
  djedContract,
  oracleContract,
  stableCoinContract,
  scDecimalScalingFactor,
}) => {
  try {
    const [scTargetPrice, scSupply, ratio] = await Promise.all([
      web3Promise(oracleContract, "readData"),
      web3Promise(stableCoinContract, "totalSupply"),
      web3Promise(djedContract, "R", 0),
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
    console.log("calculateFutureScPrice error ", error);
  }
};

/**
 * Function that calculates fees and how much BC (totalBCAmount) user will receive if he sells desired amount of stable coin and reserve coin
 * @param {*} djed DjedContract
 * @param {*} scDecimals Stable coin decimals
 * @param {*} rcDecimals Reserve coin decimals
 * @param {*} amountScScaled Stable coin amount that user wants to sell
 * @param {*} amountRcScaled Reserve coin amount that user wants to sell
 * @returns
 */
const tradeDataPriceSellBoth = async (
  djed,
  scDecimals,
  rcDecimals,
  amountScScaled,
  amountRcScaled
) => {
  try {
    const scPriceMethod = await getPriceMethod(djed, 'sellSC');
    const [scPriceData, rcPriceData] = await Promise.all([
      scaledUnscaledPromise(web3Promise$1(djed, scPriceMethod, 0), BC_DECIMALS),
      scaledUnscaledPromise(web3Promise$1(djed, "rcTargetPrice", 0), BC_DECIMALS),
    ]);

    const amountScUnscaled = decimalUnscaling(amountScScaled, scDecimals);
    const amountRcUnscaled = decimalUnscaling(amountRcScaled, rcDecimals);

    const scValueBC = convertToBC(
      amountScUnscaled,
      scPriceData[1],
      scDecimals
    );
    const rcValueBC = convertToBC(
      amountRcUnscaled,
      rcPriceData[1],
      rcDecimals
    );

    const totalValueBC = (BigInt(scValueBC) + BigInt(rcValueBC)).toString();

    const { treasuryFee, fee } = await getFees(djed);
    const totalBCAmount = deductFees(totalValueBC, fee, treasuryFee);

    return {
      scPriceScaled: scPriceData[0],
      scPriceUnscaled: scPriceData[1],
      rcPriceScaled: rcPriceData[0],
      rcPriceUnscaled: rcPriceData[1],
      amountScUnscaled,
      amountRcUnscaled,
      totalBCScaled: decimalScaling(totalBCAmount.toString(), BC_DECIMALS),
      totalBCUnscaled: totalBCAmount.toString(),
    };
  } catch (error) {
    console.error("Error in tradeDataPriceSellBoth:", error);
    throw error;
  }
};

/**
 * Function to sell both stablecoins and reservecoins
 * @param {*} djed DjedContract
 * @param {*} account User address
 * @param {*} amountSC Unscaled amount of stablecoins to sell
 * @param {*} amountRC Unscaled amount of reservecoins to sell
 * @param {*} UI UI address for fee
 * @param {*} DJED_ADDRESS Address of Djed contract
 * @returns 
 */
const sellBothTx = (
  djed,
  account,
  amountSC,
  amountRC,
  UI,
  DJED_ADDRESS
) => {
  const data = djed.methods
    .sellBothCoins(amountSC, amountRC, account, FEE_UI_UNSCALED, UI)
    .encodeABI();
  return buildTx(account, DJED_ADDRESS, 0, data);
};

// # ISIS / TEFNUT Transaction Functions (ERC20 Base Asset)

/**
 * Buy StableCoins (Isis/Tefnut Variant - ERC20 Base Asset)
 * Note: Caller must APPROVE the Djed contract to spend `amountBC` of the Base Asset before calling this.
 */
const buyScIsisTx = (djed, payer, receiver, amountBC, UI, DJED_ADDRESS) => {
  // Signature: buyStableCoins(uint256 amountBC, address receiver, uint256 feeUI, address ui)
  const data = djed.methods
    .buyStableCoins(amountBC, receiver, FEE_UI_UNSCALED, UI)
    .encodeABI();
  
  // Value is 0 because Base Asset is ERC20 transferFrom, not msg.value
  return buildTx(payer, DJED_ADDRESS, 0, data);
};

const sellScIsisTx = (djed, account, amountSC, UI, DJED_ADDRESS) => {
    // Signature: sellStableCoins(uint256 amountSC, address receiver, uint256 feeUI, address ui)
    const data = djed.methods
      .sellStableCoins(amountSC, account, FEE_UI_UNSCALED, UI)
      .encodeABI();
    return buildTx(account, DJED_ADDRESS, 0, data);
};

const buyRcIsisTx = (djed, payer, receiver, amountBC, UI, DJED_ADDRESS) => {
    // Signature: buyReserveCoins(uint256 amountBC, address receiver, uint256 feeUI, address ui)
    const data = djed.methods
      .buyReserveCoins(amountBC, receiver, FEE_UI_UNSCALED, UI)
      .encodeABI();
    
    return buildTx(payer, DJED_ADDRESS, 0, data);
  };
  
const sellRcIsisTx = (djed, account, amountRC, UI, DJED_ADDRESS) => {
    // Signature: sellReserveCoins(uint256 amountRC, address receiver, uint256 feeUI, address ui)
    const data = djed.methods
      .sellReserveCoins(amountRC, account, FEE_UI_UNSCALED, UI)
      .encodeABI();
    return buildTx(account, DJED_ADDRESS, 0, data);
};

const sellBothIsisTx = (djed, account, amountSC, amountRC, UI, DJED_ADDRESS) => {
    // Signature: sellBothCoins(uint256 amountSC, uint256 amountRC, address receiver, uint256 feeUI, address ui)
    const data = djed.methods
      .sellBothCoins(amountSC, amountRC, account, FEE_UI_UNSCALED, UI)
      .encodeABI();
    return buildTx(account, DJED_ADDRESS, 0, data);
};

var contractName$4 = "Djed";
var abi$7 = [
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
	contractName: contractName$4,
	abi: abi$7
};

var contractName$3 = "Djed";
var abi$6 = [
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
				internalType: "uint256",
				name: "amount",
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
		name: "buyReserveCoins",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "amount",
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
		name: "buyStableCoins",
		outputs: [
		],
		stateMutability: "nonpayable",
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
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_currentPaymentAmount",
				type: "uint256"
			}
		],
		name: "scMaxPrice",
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
		name: "scMinPrice",
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
		name: "ratioMax",
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
		name: "ratioMin",
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
		name: "updateOracleValues",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	}
];
var djedIsisArtifact = {
	contractName: contractName$3,
	abi: abi$6
};

var contractName$2 = "Djed";
var abi$5 = [
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
				internalType: "uint256",
				name: "amount",
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
		name: "buyReserveCoins",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "amount",
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
		name: "buyStableCoins",
		outputs: [
		],
		stateMutability: "nonpayable",
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
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_currentPaymentAmount",
				type: "uint256"
			}
		],
		name: "scMaxPrice",
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
		name: "scMinPrice",
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
		name: "ratioMax",
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
		name: "ratioMin",
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
		name: "updateOracleValues",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	}
];
var djedTefnutArtifact = {
	contractName: contractName$2,
	abi: abi$5
};

var contractName$1 = "Coin";
var abi$4 = [
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
	abi: abi$4
};

// Standard Djed (Osiris / Native)
const getDjedContract = (web3, DJED_ADDRESS) => {
  const djed = new web3.eth.Contract(djedArtifact.abi, DJED_ADDRESS);
  return djed;
};

// Djed Isis (ERC20 Backed)
const getDjedIsisContract = (web3, DJED_ADDRESS) => {
  const djed = new web3.eth.Contract(djedIsisArtifact.abi, DJED_ADDRESS);
  return djed;
};

// Djed Tefnut
const getDjedTefnutContract = (web3, DJED_ADDRESS) => {
  const djed = new web3.eth.Contract(djedTefnutArtifact.abi, DJED_ADDRESS);
  return djed;
};

const getCoinContracts = async (djedContract, web3) => {
  const [stableCoinAddress, reserveCoinAddress] = await Promise.all([
    web3Promise$1(djedContract, "stableCoin"),
    web3Promise$1(djedContract, "reserveCoin"),
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
    convertInt(web3Promise$1(stableCoin, "decimals")),
    convertInt(web3Promise$1(reserveCoin, "decimals")),
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
      scaledUnscaledPromise(web3Promise$1(stableCoin, "totalSupply"), scDecimals),
      scaledUnscaledPromise(web3Promise$1(djed, "scPrice", 0), BC_DECIMALS),
      scaledUnscaledPromise(
        web3Promise$1(reserveCoin, "totalSupply"),
        rcDecimals
      ),
      scaledUnscaledPromise(web3Promise$1(djed, "R", 0), BC_DECIMALS),
      scaledPromise(web3Promise$1(djed, "rcBuyingPrice", 0), BC_DECIMALS),
      scaledPromise(web3Promise$1(djed, "scPrice", 0), BC_DECIMALS),
    ]);

    // Define default empty value
    const emptyValue = decimalScaling("0".toString(10), BC_DECIMALS);
    let scaledSellPriceRc = emptyValue;
    let unscaledSellPriceRc = emptyValue;
    let percentReserveRatio = emptyValue;

    // Check total reserve coin supply to calculate sell price
    if (BigInt(unscaledNumberRc) !== 0n) {
      [scaledSellPriceRc, unscaledSellPriceRc] = await scaledUnscaledPromise(
        web3Promise$1(djed, "rcTargetPrice", 0),
        BC_DECIMALS
      );
    }

    // Check total stable coin supply to calculate reserve ratio
    if (BigInt(unscaledNumberSc) !== 0n) {
      percentReserveRatio = await percentScaledPromise(
        web3Promise$1(djed, "ratio"),
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
    web3Promise$1(djed, "reserveRatioMin"),
    web3Promise$1(djed, "reserveRatioMax"),
    web3Promise$1(djed, "fee"),
    percentScaledPromise(web3Promise$1(djed, "treasuryFee"), SCALING_DECIMALS),
    web3Promise$1(djed, "thresholdSupplySC"),
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
      web3Promise$1(stableCoin, "balanceOf", account),
      scDecimals
    ),
    scaledUnscaledPromise(
      web3Promise$1(reserveCoin, "balanceOf", account),
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

/**
 * Utility to listen for Djed contract events
 * @param {Object} djedContract - The Web3 contract instance
 * @param {Object} callbacks - Object containing callback functions for different events
 */
const subscribeToDjedEvents = (djedContract, callbacks) => {
  const events = [
    { name: "BoughtStableCoins", cb: callbacks.onBoughtStableCoins },
    { name: "SoldStableCoins", cb: callbacks.onSoldStableCoins },
    { name: "BoughtReserveCoins", cb: callbacks.onBoughtReserveCoins },
    { name: "SoldReserveCoins", cb: callbacks.onSoldReserveCoins },
    { name: "SoldBothCoins", cb: callbacks.onSoldBothCoins },
  ];

  const subscriptions = [];

  events.forEach((event) => {
    if (event.cb) {
      const sub = djedContract.events[event.name]({
        fromBlock: "latest",
      })
        .on("data", (data) => {
          event.cb(data.returnValues);
        })
        .on("error", (err) => {
          if (callbacks.onError) callbacks.onError(err);
          else console.error(`Error in ${event.name} subscription:`, err);
        });
      subscriptions.push(sub);
    }
  });

  return {
    unsubscribe: () => {
      subscriptions.forEach((sub) => {
        if (sub.unsubscribe) sub.unsubscribe();
      });
    },
  };
};

/**
 * Utility to fetch past events from the Djed contract
 * @param {Object} djedContract - The Web3 contract instance
 * @param {string} eventName - Name of the event
 * @param {Object} filter - Web3 filter object (e.g., { buyer: '0x...' })
 * @param {number|string} fromBlock - Starting block
 * @returns {Promise<Array>} - Array of past events
 */
const getPastDjedEvents = async (
  djedContract,
  eventName,
  filter = {},
  fromBlock = 0
) => {
  try {
    return await djedContract.getPastEvents(eventName, {
      filter,
      fromBlock,
      toBlock: "latest",
    });
  } catch (error) {
    console.error(`Error fetching past events for ${eventName}:`, error);
    throw error;
  }
};

const approveTx = (tokenContract, owner, spender, amount) => {
  const data = tokenContract.methods.approve(spender, amount).encodeABI();
  return buildTx(owner, tokenContract.options.address, 0, data);
};

const checkAllowance = async (tokenContract, owner, spender) => {
  return await tokenContract.methods.allowance(owner, spender).call();
};

var contractName = "Oracle";
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
	contractName: contractName,
	abi: abi$3
};

var abi$2 = [
	{
		type: "constructor",
		inputs: [
			{
				name: "_ref",
				type: "address",
				internalType: "contract IStdReference"
			},
			{
				name: "_decimals",
				type: "uint8",
				internalType: "uint8"
			},
			{
				name: "_hebeSwapDecimals",
				type: "uint8",
				internalType: "uint8"
			},
			{
				name: "_baseToken",
				type: "string",
				internalType: "string"
			},
			{
				name: "_quoteToken",
				type: "string",
				internalType: "string"
			}
		],
		stateMutability: "nonpayable"
	},
	{
		type: "function",
		name: "acceptTermsOfService",
		inputs: [
		],
		outputs: [
		],
		stateMutability: "nonpayable"
	},
	{
		type: "function",
		name: "baseToken",
		inputs: [
		],
		outputs: [
			{
				name: "",
				type: "string",
				internalType: "string"
			}
		],
		stateMutability: "view"
	},
	{
		type: "function",
		name: "quoteToken",
		inputs: [
		],
		outputs: [
			{
				name: "",
				type: "string",
				internalType: "string"
			}
		],
		stateMutability: "view"
	},
	{
		type: "function",
		name: "readData",
		inputs: [
		],
		outputs: [
			{
				name: "",
				type: "uint256",
				internalType: "uint256"
			}
		],
		stateMutability: "view"
	},
	{
		type: "function",
		name: "ref",
		inputs: [
		],
		outputs: [
			{
				name: "",
				type: "address",
				internalType: "contract IStdReference"
			}
		],
		stateMutability: "view"
	},
	{
		type: "function",
		name: "scalingFactor",
		inputs: [
		],
		outputs: [
			{
				name: "",
				type: "uint256",
				internalType: "uint256"
			}
		],
		stateMutability: "view"
	}
];
var hebeSwapOracleArtifact = {
	abi: abi$2
};

var abi$1 = [
	{
		type: "constructor",
		inputs: [
			{
				name: "_dataFeedAddress",
				type: "address",
				internalType: "address"
			},
			{
				name: "_decimals",
				type: "uint256",
				internalType: "uint256"
			}
		],
		stateMutability: "nonpayable"
	},
	{
		type: "function",
		name: "acceptTermsOfService",
		inputs: [
		],
		outputs: [
		],
		stateMutability: "nonpayable"
	},
	{
		type: "function",
		name: "readData",
		inputs: [
		],
		outputs: [
			{
				name: "",
				type: "uint256",
				internalType: "uint256"
			}
		],
		stateMutability: "view"
	},
	{
		type: "function",
		name: "scalingFactor",
		inputs: [
		],
		outputs: [
			{
				name: "",
				type: "uint256",
				internalType: "uint256"
			}
		],
		stateMutability: "view"
	}
];
var chainlinkOracleArtifact = {
	abi: abi$1
};

var abi = [
	{
		type: "constructor",
		inputs: [
			{
				name: "_proxyAddress",
				type: "address",
				internalType: "address"
			},
			{
				name: "_api3Decimals",
				type: "uint256",
				internalType: "uint256"
			},
			{
				name: "_decimals",
				type: "uint256",
				internalType: "uint256"
			}
		],
		stateMutability: "nonpayable"
	},
	{
		type: "function",
		name: "acceptTermsOfService",
		inputs: [
		],
		outputs: [
		],
		stateMutability: "nonpayable"
	},
	{
		type: "function",
		name: "proxyAddress",
		inputs: [
		],
		outputs: [
			{
				name: "",
				type: "address",
				internalType: "address"
			}
		],
		stateMutability: "view"
	},
	{
		type: "function",
		name: "readData",
		inputs: [
		],
		outputs: [
			{
				name: "",
				type: "uint256",
				internalType: "uint256"
			}
		],
		stateMutability: "view"
	},
	{
		type: "function",
		name: "scalingFactor",
		inputs: [
		],
		outputs: [
			{
				name: "",
				type: "uint256",
				internalType: "uint256"
			}
		],
		stateMutability: "view"
	}
];
var api3OracleArtifact = {
	abi: abi
};

const getOracleAddress = async (djedContract) => {
  return await web3Promise$1(djedContract, "oracle");
};

const getOracleContract = (web3, oracleAddress, msgSender) => {
  const oracle = new web3.eth.Contract(oracleArtifact.abi, oracleAddress, {
    from: msgSender
  });
  return oracle;
};

/**
 * Added export to resolve Rollup error
 */
const getHebeSwapOracleContract = (web3, oracleAddress, msgSender) => {
  const oracle = new web3.eth.Contract(hebeSwapOracleArtifact.abi, oracleAddress, {
    from: msgSender
  });
  return oracle;
};

/**
 * Added export to resolve Rollup error
 */
const getChainlinkOracleContract = (web3, oracleAddress, msgSender) => {
  const oracle = new web3.eth.Contract(chainlinkOracleArtifact.abi, oracleAddress, {
    from: msgSender
  });
  return oracle;
};

/**
 * Added export to resolve Rollup error
 */
const getAPI3OracleContract = (web3, oracleAddress, msgSender) => {
  const oracle = new web3.eth.Contract(api3OracleArtifact.abi, oracleAddress, {
    from: msgSender
  });
  return oracle;
};

export { FEE_UI_UNSCALED, appendFees, approveTx, buyRcIsisTx, buyRcTx, buyScIsisTx, buyScTx, calculateBcUsdEquivalent, calculateFutureScPrice, calculateIsRatioAboveMin, calculateIsRatioBelowMax, calculateRcUsdEquivalent, calculateTxFees, checkAllowance, convertToBC, deductFees, getAPI3OracleContract, getAccountDetails, getBcUsdEquivalent, getChainlinkOracleContract, getCoinContracts, getCoinDetails, getDecimals, getDjedContract, getDjedIsisContract, getDjedTefnutContract, getFees, getHebeSwapOracleContract, getOracleAddress, getOracleContract, getPastDjedEvents, getRcUsdEquivalent, getScAdaEquivalent, getSystemParams, getWeb3, isTxLimitReached, promiseTx, scalingFactor, sellBothIsisTx, sellBothTx, sellRcIsisTx, sellRcTx, sellScIsisTx, sellScTx, subscribeToDjedEvents, tradeDataPriceBuyRc, tradeDataPriceBuySc, tradeDataPriceCore, tradeDataPriceSellBoth, tradeDataPriceSellRc, tradeDataPriceSellSc, verifyTx };
