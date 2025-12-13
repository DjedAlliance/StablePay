// Call contract read method using ethers
export function web3Promise(contract, method, ...args) {
  return contract[method](...args);
}

// Function to build a transaction object for ethers signer
// Set gas limit to 500,000 by default
export function buildTx(from_, to_, value_, data_, setGasLimit = true) {
  const tx = {
    to: to_,
    from: from_,
    value: value_ ? BigInt(value_) : 0n,
    data: data_,
  };
  if (setGasLimit) {
    tx.gasLimit = 500_000n;
  }
  return tx;
}
export function convertInt(promise) {
  return promise.then((value) => parseInt(value));
}

export function reverseString(s) {
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

export function decimalScaling(unscaledString, decimals, show = 6) {
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

export function decimalUnscaling(scaledString, decimals) {
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

export function scaledPromise(promise, scaling) {
  return promise.then((value) => decimalScaling(value.toString(10), scaling));
}

export function scaledUnscaledPromise(promise, scaling) {
  return promise.then((value) => [
    decimalScaling(value.toString(10), scaling),
    value,
  ]);
}

export function percentageScale(value, scaling, showSymbol = false) {
  const calculatedValue = decimalScaling(value.toString(10), scaling - 2, 2);
  if (showSymbol) {
    return calculatedValue + "%";
  }
  return calculatedValue;
}

export function percentScaledPromise(promise, scaling) {
  return promise.then((value) => percentageScale(value, scaling, true));
}
// currency conversions:
export function calculateBcUsdEquivalent(coinsDetails, amountFloat) {
  const adaPerUsd = parseFloat(
    coinsDetails?.scaledScExchangeRate.replaceAll(",", "")
  );
  const eqPrice = (1e6 * amountFloat) / adaPerUsd;
  return decimalScaling(eqPrice.toFixed(0).toString(10), 6);
}

export function getBcUsdEquivalent(coinsDetails, amountFloat) {
  return "$" + calculateBcUsdEquivalent(coinsDetails, amountFloat);
}

export function calculateRcUsdEquivalent(coinsDetails, amountFloat) {
  const adaPerRc = parseFloat(coinsDetails?.scaledSellPriceRc);
  const adaPerUsd = parseFloat(
    coinsDetails?.scaledScExchangeRate.replaceAll(",", "")
  );
  const eqPrice = (1e6 * amountFloat * adaPerRc) / adaPerUsd;
  return decimalScaling(eqPrice.toFixed(0).toString(10), 6);
}
export function getRcUsdEquivalent(coinsDetails, amountFloat) {
  return "$" + calculateRcUsdEquivalent(coinsDetails, amountFloat);
}

export function getScAdaEquivalent(coinsDetails, amountFloat) {
  const adaPerSc = parseFloat(coinsDetails?.scaledPriceSc.replaceAll(",", ""));
  const eqPrice = 1e6 * amountFloat * adaPerSc;
  return decimalScaling(eqPrice.toFixed(0).toString(10), 6);
}
