export function web3Promise(contract, method, ...args) {
  return contract.methods[method](...args).call();
}

// Function to build a transaction
// Set gas limit to 500,000 by default
export function buildTx(from_, to_, value_, data_, setGasLimit = true) {
  const tx = {
    to: to_,
    from: from_,
    value: "0x" + BigInt(value_).toString(16),
    data: data_,
  };
  if (setGasLimit) {
    tx.gasLimit = 500_000;
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
  return promise.then((value) =>
    decimalScaling(value.toString(10), scaling)
  );
}

export function scaledUnscaledPromise(promise, scaling) {
  return promise.then((value) => [
    decimalScaling(value.toString(10), scaling),
    value,
  ]);
}

export function percentageScale(value, scaling, showSymbol = false) {
  const calculatedValue = decimalScaling(
    value.toString(10),
    scaling - 2,
    2
  );
  if (showSymbol) {
    return calculatedValue + "%";
  }
  return calculatedValue;
}

export function percentScaledPromise(promise, scaling) {
  return promise.then((value) =>
    percentageScale(value, scaling, true)
  );
}

/* ============================================================
   CURRENCY CONVERSIONS (BigInt Safe Version)
   ============================================================ */

// BC → USD
export function calculateBcUsdEquivalent(coinsDetails, amount) {
  if (!coinsDetails?.scaledScExchangeRate) return "0.000000";

  const adaPerUsd = BigInt(
    coinsDetails.scaledScExchangeRate.replaceAll(",", "")
  );

  const amountBig = BigInt(amount);

  // scaled to 6 decimals
  const eqPrice = (amountBig * 1_000_000n) / adaPerUsd;

  return decimalScaling(eqPrice.toString(10), 6);
}

export function getBcUsdEquivalent(coinsDetails, amount) {
  return "$" + calculateBcUsdEquivalent(coinsDetails, amount);
}

// RC → USD
export function calculateRcUsdEquivalent(coinsDetails, amount) {
  if (
    !coinsDetails?.scaledSellPriceRc ||
    !coinsDetails?.scaledScExchangeRate
  )
    return "0.000000";

  const adaPerRc = BigInt(coinsDetails.scaledSellPriceRc);
  const adaPerUsd = BigInt(
    coinsDetails.scaledScExchangeRate.replaceAll(",", "")
  );

  const amountBig = BigInt(amount);

  const eqPrice =
    (amountBig * adaPerRc * 1_000_000n) / adaPerUsd;

  return decimalScaling(eqPrice.toString(10), 6);
}

export function getRcUsdEquivalent(coinsDetails, amount) {
  return "$" + calculateRcUsdEquivalent(coinsDetails, amount);
}

// SC → ADA
export function getScAdaEquivalent(coinsDetails, amount) {
  if (!coinsDetails?.scaledPriceSc) return "0.000000";

  const adaPerSc = BigInt(
    coinsDetails.scaledPriceSc.replaceAll(",", "")
  );

  const amountBig = BigInt(amount);

  const eqPrice = amountBig * adaPerSc * 1_000_000n;

  return decimalScaling(eqPrice.toString(10), 6);
}