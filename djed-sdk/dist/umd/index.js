(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('web3')) :
  typeof define === 'function' && define.amd ? define(['exports', 'web3'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.DjedSdk = {}, global.Web3));
})(this, (function (exports, Web3) { 'use strict';

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
   * @param {*} txLimit
   * @returns
   */
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
   * Function that returns the correct price method name based on the contract version and operation
   * @param {*} djed Djed contract
   * @param {*} operation 'buySC', 'sellSC', 'buyRC', 'sellRC'
   * @returns 
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
      const scMethod = await getPriceMethod(djed, 'buyRC');
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
      const scMethod = await getPriceMethod(djed, 'sellRC');
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
      const method = await getPriceMethod(djed, 'buySC');
      const data = await tradeDataPriceCore(
        djed,
        method,
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
      const method = await getPriceMethod(djed, 'sellSC');
      const data = await tradeDataPriceCore(
        djed,
        method,
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

      const totalValueBC = (scValueBC + rcValueBC).toString();

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
   * @param {object} djed The DjedContract instance
   * @param {string} payer The address paying the Base Asset
   * @param {string} receiver The address receiving the StableCoins
   * @param {string} amountBC The amount of Base Asset to pay (in wei/smallest unit)
   * @param {string} UI The UI address
   * @param {string} DJED_ADDRESS The Djed contract address
   * @returns {object} The transaction object
   */
  const buyScIsisTx = (djed, payer, receiver, amountBC, UI, DJED_ADDRESS) => {
    // Signature: buyStableCoins(uint256 amountBC, address receiver, uint256 feeUI, address ui)
    const data = djed.methods
      .buyStableCoins(amountBC, receiver, FEE_UI_UNSCALED, UI)
      .encodeABI();
    
    // Value is 0 because Base Asset is ERC20 transferFrom, not msg.value
    return buildTx(payer, DJED_ADDRESS, 0, data);
  };

  /**
   * Sell StableCoins (Isis/Tefnut Variant)
   * Note: Same logic as Osiris, but ensuring naming consistency if needed.
   * But functionally, sellStableCoins signature is: sellStableCoins(uint256 amountSC, address receiver, uint256 feeUI, address ui)
   * which matches Osiris. Using the same function is fine, but we provide an alias for clarity.
   */
  const sellScIsisTx = (djed, account, amountSC, UI, DJED_ADDRESS) => {
      // Signature: sellStableCoins(uint256 amountSC, address receiver, uint256 feeUI, address ui)
      // This is identical to Osiris, so we can reuse the logic or just wrap it.
      // However, the internal implementation of Djed Isis would transfer ERC20 back to user.
      const data = djed.methods
        .sellStableCoins(amountSC, account, FEE_UI_UNSCALED, UI)
        .encodeABI();
      return buildTx(account, DJED_ADDRESS, 0, data);
  };

  /**
   * Buy ReserveCoins (Isis/Tefnut Variant - ERC20 Base Asset)
   * Note: Caller must APPROVE the Djed contract to spend `amountBC` of the Base Asset before calling this.
   * @param {object} djed The DjedContract instance
   * @param {string} payer The address paying the Base Asset
   * @param {string} receiver The address receiving the ReserveCoins
   * @param {string} amountBC The amount of Base Asset to pay (in wei/smallest unit)
   * @param {string} UI The UI address
   * @param {string} DJED_ADDRESS The Djed contract address
   * @returns {object} The transaction object
   */
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

  /**
   * Sell Both Coins (Isis/Tefnut Variant)
   * Note: Same logic as Osiris.
   */
  const sellBothIsisTx = (djed, account, amountSC, amountRC, UI, DJED_ADDRESS) => {
      // Signature: sellBothCoins(uint256 amountSC, uint256 amountRC, address receiver, uint256 feeUI, address ui)
      // Actually, check Djed.sol: sellBothCoins(uint256 amountSC, uint256 amountRC, address receiver, uint256 feeUI, address ui)
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

  //setting up djed
  const getDjedContract = (web3, DJED_ADDRESS) => {
    const djed = new web3.eth.Contract(djedArtifact.abi, DJED_ADDRESS);
    return djed;
  };

  const getDjedIsisContract = (web3, DJED_ADDRESS) => {
    const djed = new web3.eth.Contract(djedIsisArtifact.abi, DJED_ADDRESS);
    return djed;
  };

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

  const checkIfShu = async (djedContract) => {
    try {
      // Check if scMaxPrice exists on the contract
      await djedContract.methods.scMaxPrice(0).call();
      return true;
    } catch (e) {
      return false;
    }
  };

  const getCoinDetails = async (
    stableCoin,
    reserveCoin,
    djed,
    scDecimals,
    rcDecimals
  ) => {
    try {
      const isShu = await checkIfShu(djed);
      const priceMethod = isShu ? "scMaxPrice" : "scPrice";

      const [
        [scaledNumberSc, unscaledNumberSc],
        [scaledPriceSc, unscaledPriceSc],
        [scaledNumberRc, unscaledNumberRc],
        [scaledReserveBc, unscaledReserveBc],
        scaledBuyPriceRc,
        scaledScExchangeRate,
      ] = await Promise.all([
        scaledUnscaledPromise(web3Promise$1(stableCoin, "totalSupply"), scDecimals),
        scaledUnscaledPromise(web3Promise$1(djed, priceMethod, 0), BC_DECIMALS),
        scaledUnscaledPromise(
          web3Promise$1(reserveCoin, "totalSupply"),
          rcDecimals
        ),
        scaledUnscaledPromise(web3Promise$1(djed, "R", 0), BC_DECIMALS),
        scaledPromise(web3Promise$1(djed, "rcBuyingPrice", 0), BC_DECIMALS),
        scaledPromise(web3Promise$1(djed, priceMethod, 0), BC_DECIMALS),
      ]);

      // Define default empty value
      const emptyValue = decimalScaling("0".toString(10), BC_DECIMALS);
      let scaledSellPriceRc = emptyValue;
      let unscaledSellPriceRc = emptyValue;
      let percentReserveRatio = emptyValue;
      let percentReserveRatioMin = emptyValue;
      let percentReserveRatioMax = emptyValue;

      // Check total reserve coin supply to calculate sell price
      if (BigInt(unscaledNumberRc) !== 0n) {
        [scaledSellPriceRc, unscaledSellPriceRc] = await scaledUnscaledPromise(
          web3Promise$1(djed, "rcTargetPrice", 0),
          BC_DECIMALS
        );
      }

      // Check total stable coin supply to calculate reserve ratio
      if (BigInt(unscaledNumberSc) !== 0n) {
        if (isShu) {
          const [ratioMin, ratioMax] = await Promise.all([
             percentScaledPromise(web3Promise$1(djed, "ratioMin"), SCALING_DECIMALS),
             percentScaledPromise(web3Promise$1(djed, "ratioMax"), SCALING_DECIMALS)
          ]);
          percentReserveRatioMin = ratioMin;
          percentReserveRatioMax = ratioMax;
          percentReserveRatio = `${ratioMin} - ${ratioMax}`;
        } else {
          percentReserveRatio = await percentScaledPromise(
            web3Promise$1(djed, "ratio"),
            SCALING_DECIMALS
          );
        }
      }

      // Return the results
      return {
        isShu,
        scaledNumberSc,
        unscaledNumberSc,
        scaledPriceSc,
        unscaledPriceSc,
        scaledNumberRc,
        unscaledNumberRc,
        scaledReserveBc,
        unscaledReserveBc,
        percentReserveRatio,
        percentReserveRatioMin,
        percentReserveRatioMax,
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
      initialTreasuryFee,
      treasuryRevenueTarget,
      treasuryRevenue,
      rcMinPrice,
      txLimit,
    ] = await Promise.all([
      web3Promise$1(djed, "reserveRatioMin"),
      web3Promise$1(djed, "reserveRatioMax"),
      web3Promise$1(djed, "fee"),
      percentScaledPromise(web3Promise$1(djed, "treasuryFee"), SCALING_DECIMALS),
      web3Promise$1(djed, "thresholdSupplySC"),
      web3Promise$1(djed, "initialTreasuryFee"),
      web3Promise$1(djed, "treasuryRevenueTarget"),
      web3Promise$1(djed, "treasuryRevenue"),
      web3Promise$1(djed, "rcMinPrice"),
      web3Promise$1(djed, "txLimit"),
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
      initialTreasuryFee: percentageScale(initialTreasuryFee, SCALING_DECIMALS, true),
      initialTreasuryFeeUnscaled: initialTreasuryFee,
      treasuryRevenueTarget,
      treasuryRevenue,
      rcMinPrice,
      txLimit,
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
   * @param {Function} callbacks.onBoughtStableCoins - (eventData) => {}
   * @param {Function} callbacks.onSoldStableCoins - (eventData) => {}
   * @param {Function} callbacks.onBoughtReserveCoins - (eventData) => {}
   * @param {Function} callbacks.onSoldReserveCoins - (eventData) => {}
   * @param {Function} callbacks.onSoldBothCoins - (eventData) => {}
   * @param {Function} callbacks.onError - (error) => {}
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
  var bytecode$2 = {
  	object: "0x60c060405234620000db5762000b08803803806200001d81620000f7565b928339810160a082820312620000db578151906001600160a01b0382168203620000db576200004f602084016200012c565b6200005d604085016200012c565b60608501516001600160401b039591929190868111620000db5784620000859183016200013b565b936080820151968711620000db57620000ab96620000a492016200013b565b93620003d9565b6040516105d1908162000537823960805181818161037201526103f7015260a05181818161043501526104fe0152f35b600080fd5b50634e487b7160e01b600052604160045260246000fd5b6040519190601f01601f191682016001600160401b038111838210176200011d57604052565b62000127620000e0565b604052565b519060ff82168203620000db57565b81601f82011215620000db578051906001600160401b038211620001bf575b60209062000171601f8401601f19168301620000f7565b93838552828483010111620000db5782906000905b83838310620001a6575050116200019c57505090565b6000918301015290565b8193508281939201015182828801015201839162000186565b620001c9620000e0565b6200015a565b50634e487b7160e01b600052601160045260246000fd5b90600182811c9216801562000218575b60208310146200020257565b634e487b7160e01b600052602260045260246000fd5b91607f1691620001f6565b601f811162000230575050565b60009081805260208220906020601f850160051c8301941062000270575b601f0160051c01915b8281106200026457505050565b81815560010162000257565b90925082906200024e565b90601f821162000289575050565b60019160009083825260208220906020601f850160051c83019410620002cc575b601f0160051c01915b828110620002c15750505050565b8181558301620002b3565b9092508290620002aa565b80519091906001600160401b038111620003c9575b6001906200030681620003008454620001e6565b6200027b565b602080601f83116001146200034457508192939460009262000338575b5050600019600383901b1c191690821b179055565b01519050388062000323565b6001600052601f198316959091907fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6926000905b888210620003b1575050838596971062000397575b505050811b019055565b015160001960f88460031b161c191690553880806200038d565b80878596829496860151815501950193019062000378565b620003d3620000e0565b620002ec565b6080529193929160ff91821690821681811062000526575b0316604d811162000516575b600a0a60a05282516001600160401b03811162000506575b6000906200042f81620004298454620001e6565b62000223565b602080601f8311600114620004775750819062000469959684926200046b575b50508160011b916000199060031b1c1916179055620002d7565b565b0151905038806200044f565b60008052601f198316967f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563929185905b898210620004ed5750509083929160019462000469989910620004d3575b505050811b019055620002d7565b015160001960f88460031b161c19169055388080620004c5565b80600185968294968601518155019501930190620004a7565b62000510620000e0565b62000415565b62000520620001cf565b620003fd565b62000530620001cf565b620003f156fe60806040526004361015610013575b600080fd5b6000803560e01c908163217a4b701461008e5750806321a78f6814610085578063bef55ef31461007c578063c55dae6314610073578063dddd9e961461006a5763ed3437f81461006257600080fd5b61000e6104e5565b5061000e6104d1565b5061000e6104a5565b5061000e6103a1565b5061000e61035b565b346100b957806003193601126100b9576100b56100a961024e565b60405191829182610304565b0390f35b80fd5b90600182811c921680156100ec575b60208310146100d657565b634e487b7160e01b600052602260045260246000fd5b91607f16916100cb565b9060009160005490610107826100bc565b8082529160019081811690811561017d575060011461012557505050565b91929350600080527f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563916000925b84841061016557505060209250010190565b80546020858501810191909152909301928101610153565b60ff191660208401525050604001925050565b906000916001908154916101a3836100bc565b8083529281811690811561017d57506001146101be57505050565b80929394506000527fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6916000925b8484106101fe57505060209250010190565b805460208585018101919091529093019281016101ec565b90601f8019910116810190811067ffffffffffffffff82111761023857604052565b634e487b7160e01b600052604160045260246000fd5b604051600081600191825492610263846100bc565b808452938181169081156102e7575060011461028a575b5061028792500382610216565b90565b600081815291507fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf65b8483106102cc575061028793505081016020013861027a565b819350908160209254838589010152019101909184926102b3565b94505050505060ff1916602082015261028781604081013861027a565b919091602080825283519081818401526000945b828610610345575050806040939411610338575b601f01601f1916010190565b600083828401015261032c565b8581018201518487016040015294810194610318565b503461000e57600036600319011261000e576040517f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168152602090f35b503461000e5760031960003682011261000e5761045a6103f360606100b5936040518093819263195556f360e21b8352604060048401526103e4604484016100f6565b90838203016024840152610190565b03817f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03165afa908115610498575b60009161046a575b50517f000000000000000000000000000000000000000000000000000000000000000090610572565b6040519081529081906020820190565b61048b915060603d8111610491575b6104838183610216565b810190610521565b38610431565b503d610479565b6104a0610565565b610429565b503461000e57600036600319011261000e576100b56040516100a9816104ca816100f6565b0382610216565b503461000e57600036600319011261000e57005b503461000e57600036600319011261000e5760206040517f00000000000000000000000000000000000000000000000000000000000000008152f35b9081606091031261000e5760405190606082019082821067ffffffffffffffff83111761023857604091825280518352602081015160208401520151604082015290565b506040513d6000823e3d90fd5b8060001904821181151516610585570290565b634e487b7160e01b600052601160045260246000fdfea264697066735822122053cfb7b37092c28d461cf6387ad085646c5cf4ccd06822d58ce0f7819d82b38b64736f6c634300080d0033",
  	sourceMap: "120:827:2:-:0;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;-1:-1:-1;;;;;120:827:2;;;;;;;;;;;:::i;:::-;;;;;;:::i;:::-;;;;;-1:-1:-1;;;;;120:827:2;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;:::i;:::-;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;-1:-1:-1;120:827:2;;;;;;;;;;;;;;;;;;;;;;-1:-1:-1;;120:827:2;;;-1:-1:-1;;;;;120:827:2;;;;;;;;;;:::o;:::-;;;:::i;:::-;;;:::o;:::-;;;;;;;;;;:::o;:::-;;;;;;;;;;;;-1:-1:-1;;;;;120:827:2;;;;;;;;;;;-1:-1:-1;;120:827:2;;;;:::i;:::-;;;;;;;;;;;;;;;-1:-1:-1;120:827:2;;;;;;;;;;;;;;;;:::o;:::-;-1:-1:-1;120:827:2;;;;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;578:22;120:827;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;-1:-1:-1;120:827:2;;;;;;;;;;;;;:::o;:::-;610:24;-1:-1:-1;;120:827:2;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;-1:-1:-1;120:827:2;;;;;;;;;;-1:-1:-1;;;;;120:827:2;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;;;;;;;;;;;;;;-1:-1:-1;;;;120:827:2;;;;;;;;;;;;;:::o;:::-;;;;-1:-1:-1;120:827:2;;;;;610:24;120:827;;-1:-1:-1;;120:827:2;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;305:336;488:10;;305:336;;;;120:827;;;;;;;;;;;;305:336;120:827;;;;;;;305:336;120:827;;508:60;;120:827;;-1:-1:-1;;;;;120:827:2;;;;305:336;-1:-1:-1;120:827:2;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;305:336::o;120:827::-;;;;-1:-1:-1;120:827:2;;;;;578:22;120:827;;-1:-1:-1;;120:827:2;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;:::i;:::-;;;;;;:::i;:::-;;",
  	linkReferences: {
  	}
  };
  var deployedBytecode$2 = {
  	object: "0x60806040526004361015610013575b600080fd5b6000803560e01c908163217a4b701461008e5750806321a78f6814610085578063bef55ef31461007c578063c55dae6314610073578063dddd9e961461006a5763ed3437f81461006257600080fd5b61000e6104e5565b5061000e6104d1565b5061000e6104a5565b5061000e6103a1565b5061000e61035b565b346100b957806003193601126100b9576100b56100a961024e565b60405191829182610304565b0390f35b80fd5b90600182811c921680156100ec575b60208310146100d657565b634e487b7160e01b600052602260045260246000fd5b91607f16916100cb565b9060009160005490610107826100bc565b8082529160019081811690811561017d575060011461012557505050565b91929350600080527f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563916000925b84841061016557505060209250010190565b80546020858501810191909152909301928101610153565b60ff191660208401525050604001925050565b906000916001908154916101a3836100bc565b8083529281811690811561017d57506001146101be57505050565b80929394506000527fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6916000925b8484106101fe57505060209250010190565b805460208585018101919091529093019281016101ec565b90601f8019910116810190811067ffffffffffffffff82111761023857604052565b634e487b7160e01b600052604160045260246000fd5b604051600081600191825492610263846100bc565b808452938181169081156102e7575060011461028a575b5061028792500382610216565b90565b600081815291507fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf65b8483106102cc575061028793505081016020013861027a565b819350908160209254838589010152019101909184926102b3565b94505050505060ff1916602082015261028781604081013861027a565b919091602080825283519081818401526000945b828610610345575050806040939411610338575b601f01601f1916010190565b600083828401015261032c565b8581018201518487016040015294810194610318565b503461000e57600036600319011261000e576040517f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168152602090f35b503461000e5760031960003682011261000e5761045a6103f360606100b5936040518093819263195556f360e21b8352604060048401526103e4604484016100f6565b90838203016024840152610190565b03817f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03165afa908115610498575b60009161046a575b50517f000000000000000000000000000000000000000000000000000000000000000090610572565b6040519081529081906020820190565b61048b915060603d8111610491575b6104838183610216565b810190610521565b38610431565b503d610479565b6104a0610565565b610429565b503461000e57600036600319011261000e576100b56040516100a9816104ca816100f6565b0382610216565b503461000e57600036600319011261000e57005b503461000e57600036600319011261000e5760206040517f00000000000000000000000000000000000000000000000000000000000000008152f35b9081606091031261000e5760405190606082019082821067ffffffffffffffff83111761023857604091825280518352602081015160208401520151604082015290565b506040513d6000823e3d90fd5b8060001904821181151516610585570290565b634e487b7160e01b600052601160045260246000fdfea264697066735822122053cfb7b37092c28d461cf6387ad085646c5cf4ccd06822d58ce0f7819d82b38b64736f6c634300080d0033",
  	sourceMap: "120:827:2:-:0;;;;;;;;;-1:-1:-1;120:827:2;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;:::i;:::-;;;;:::i;:::-;;;;:::i;:::-;;;;:::i;:::-;;;;;;;;;;;;;274:24;;:::i;:::-;120:827;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;;-1:-1:-1;;120:827:2;;;;;-1:-1:-1;;120:827:2;;;-1:-1:-1;;120:827:2:o;:::-;;;;857:10;120:827;;;;;;;:::i;:::-;;;;;;;;;857:10;;;;120:827;;;;;;;;:::o;:::-;;;;;;-1:-1:-1;120:827:2;;;-1:-1:-1;120:827:2;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;;;;;-1:-1:-1;274:24:2;;120:827;;;;;;;:::i;:::-;;;;;;;;;274:24;;;;120:827;;;;;;;;;;;;;:::i;:::-;;:::o;:::-;-1:-1:-1;120:827:2;;;-1:-1:-1;;120:827:2;;;;;;;-1:-1:-1;120:827:2;;-1:-1:-1;;120:827:2;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;-1:-1:-1;;120:827:2;;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;-1:-1:-1;;120:827:2;;;;;;161:34;-1:-1:-1;;;;;120:827:2;;;;;;;;;;;-1:-1:-1;;120:827:2;;;;;;;895:42;120:827;800:77;120:827;;;;;;;;;;;800:77;;120:827;;800:77;;120:827;;;;;;:::i;:::-;;;;;;;;;;;:::i;:::-;800:77;120:827;800:3;-1:-1:-1;;;;;120:827:2;800:77;;;;;;;120:827;;800:77;;;120:827;;;924:13;895:42;;:::i;:::-;120:827;;;;;;;;;;;;;800:77;;;;;;;;;;;;;;;:::i;:::-;;;;;:::i;:::-;;;;;;;;;;;;:::i;:::-;;;120:827;;;;;;;-1:-1:-1;;120:827:2;;;;;;;;;;;;:::i;:::-;;;;:::i;:::-;;;;;;;-1:-1:-1;;120:827:2;;;;;;;;;;;;-1:-1:-1;;120:827:2;;;;;;;201:38;120:827;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;",
  	linkReferences: {
  	},
  	immutableReferences: {
  		"131": [
  			{
  				start: 882,
  				length: 32
  			},
  			{
  				start: 1015,
  				length: 32
  			}
  		],
  		"133": [
  			{
  				start: 1077,
  				length: 32
  			},
  			{
  				start: 1278,
  				length: 32
  			}
  		]
  	}
  };
  var methodIdentifiers$2 = {
  	"acceptTermsOfService()": "dddd9e96",
  	"baseToken()": "c55dae63",
  	"quoteToken()": "217a4b70",
  	"readData()": "bef55ef3",
  	"ref()": "21a78f68",
  	"scalingFactor()": "ed3437f8"
  };
  var rawMetadata$2 = "{\"compiler\":{\"version\":\"0.8.13+commit.abaa5c0e\"},\"language\":\"Solidity\",\"output\":{\"abi\":[{\"inputs\":[{\"internalType\":\"contract IStdReference\",\"name\":\"_ref\",\"type\":\"address\"},{\"internalType\":\"uint8\",\"name\":\"_decimals\",\"type\":\"uint8\"},{\"internalType\":\"uint8\",\"name\":\"_hebeSwapDecimals\",\"type\":\"uint8\"},{\"internalType\":\"string\",\"name\":\"_baseToken\",\"type\":\"string\"},{\"internalType\":\"string\",\"name\":\"_quoteToken\",\"type\":\"string\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"inputs\":[],\"name\":\"acceptTermsOfService\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"baseToken\",\"outputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"quoteToken\",\"outputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"readData\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"ref\",\"outputs\":[{\"internalType\":\"contract IStdReference\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"scalingFactor\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"}],\"devdoc\":{\"kind\":\"dev\",\"methods\":{},\"version\":1},\"userdoc\":{\"kind\":\"user\",\"methods\":{},\"version\":1}},\"settings\":{\"compilationTarget\":{\"src/HebeSwapOracle.sol\":\"HebeSwapOracle\"},\"evmVersion\":\"london\",\"libraries\":{},\"metadata\":{\"bytecodeHash\":\"ipfs\"},\"optimizer\":{\"enabled\":true,\"runs\":200},\"remappings\":[\":@api3dao/=lib/contracts/\",\":@chainlink/contracts/=node_modules/@chainlink/contracts/\",\":@eth-optimism/=node_modules/@eth-optimism/\",\":@hebeswap/=lib/hebeswap-contract/\",\":@openzeppelin/=lib/openzeppelin-contracts/\",\":ds-test/=lib/forge-std/lib/ds-test/src/\",\":forge-std/=lib/forge-std/src/\",\":hebeswap-contract/=lib/hebeswap-contract/\",\":openzeppelin-contracts/=lib/openzeppelin-contracts/\",\":solmate/=lib/solmate/src/\"],\"viaIR\":true},\"sources\":{\"lib/hebeswap-contract/IStdReference.sol\":{\"keccak256\":\"0x805354452e33be1dfd58447a237b6bd506287bd30337543cc1e07e05601e4e18\",\"license\":\"Apache-2.0\",\"urls\":[\"bzz-raw://14662cd18e5e122d927e027d8f2ace81d298f5e9b26b84e07a42cd587711a271\",\"dweb:/ipfs/QmWRwfUpiGXspRSJboXBGXmMzzYbDkT2Hs276rRehbtAkT\"]},\"src/HebeSwapOracle.sol\":{\"keccak256\":\"0x24e9a24e8105104d57c6ad72be5bbfa8c7b9cdb77a27102453bd632aa79fbbea\",\"license\":\"AEL\",\"urls\":[\"bzz-raw://236777fe9d91c7e587a092ce6f2ffcdcadea603211a9327a854d81630a9ee824\",\"dweb:/ipfs/QmQrhn7fNXb2gHDk5YqNv3viTv24RgHqV9EsKWe9pD8kB7\"]},\"src/IOracle.sol\":{\"keccak256\":\"0xbdb82189368be9100ec49015ca5838207a3bc5bfec11543d0aede20811cb07ad\",\"license\":\"AEL\",\"urls\":[\"bzz-raw://d6f64b8238eaa188a9b9d7acac753ba0bfccc770b458be512c37c47bc8cafe4c\",\"dweb:/ipfs/QmWB2nD9chE3EAKYa4joucZUsFstZNJDjRoDbrdXEKkYk1\"]}},\"version\":1}";
  var metadata$2 = {
  	compiler: {
  		version: "0.8.13+commit.abaa5c0e"
  	},
  	language: "Solidity",
  	output: {
  		abi: [
  			{
  				inputs: [
  					{
  						internalType: "contract IStdReference",
  						name: "_ref",
  						type: "address"
  					},
  					{
  						internalType: "uint8",
  						name: "_decimals",
  						type: "uint8"
  					},
  					{
  						internalType: "uint8",
  						name: "_hebeSwapDecimals",
  						type: "uint8"
  					},
  					{
  						internalType: "string",
  						name: "_baseToken",
  						type: "string"
  					},
  					{
  						internalType: "string",
  						name: "_quoteToken",
  						type: "string"
  					}
  				],
  				stateMutability: "nonpayable",
  				type: "constructor"
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "nonpayable",
  				type: "function",
  				name: "acceptTermsOfService"
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "view",
  				type: "function",
  				name: "baseToken",
  				outputs: [
  					{
  						internalType: "string",
  						name: "",
  						type: "string"
  					}
  				]
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "view",
  				type: "function",
  				name: "quoteToken",
  				outputs: [
  					{
  						internalType: "string",
  						name: "",
  						type: "string"
  					}
  				]
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "view",
  				type: "function",
  				name: "readData",
  				outputs: [
  					{
  						internalType: "uint256",
  						name: "",
  						type: "uint256"
  					}
  				]
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "view",
  				type: "function",
  				name: "ref",
  				outputs: [
  					{
  						internalType: "contract IStdReference",
  						name: "",
  						type: "address"
  					}
  				]
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "view",
  				type: "function",
  				name: "scalingFactor",
  				outputs: [
  					{
  						internalType: "uint256",
  						name: "",
  						type: "uint256"
  					}
  				]
  			}
  		],
  		devdoc: {
  			kind: "dev",
  			methods: {
  			},
  			version: 1
  		},
  		userdoc: {
  			kind: "user",
  			methods: {
  			},
  			version: 1
  		}
  	},
  	settings: {
  		remappings: [
  			"@api3dao/=lib/contracts/",
  			"@chainlink/contracts/=node_modules/@chainlink/contracts/",
  			"@eth-optimism/=node_modules/@eth-optimism/",
  			"@hebeswap/=lib/hebeswap-contract/",
  			"@openzeppelin/=lib/openzeppelin-contracts/",
  			"ds-test/=lib/forge-std/lib/ds-test/src/",
  			"forge-std/=lib/forge-std/src/",
  			"hebeswap-contract/=lib/hebeswap-contract/",
  			"openzeppelin-contracts/=lib/openzeppelin-contracts/",
  			"solmate/=lib/solmate/src/"
  		],
  		optimizer: {
  			enabled: true,
  			runs: 200
  		},
  		metadata: {
  			bytecodeHash: "ipfs"
  		},
  		compilationTarget: {
  			"src/HebeSwapOracle.sol": "HebeSwapOracle"
  		},
  		evmVersion: "london",
  		libraries: {
  		},
  		viaIR: true
  	},
  	sources: {
  		"lib/hebeswap-contract/IStdReference.sol": {
  			keccak256: "0x805354452e33be1dfd58447a237b6bd506287bd30337543cc1e07e05601e4e18",
  			urls: [
  				"bzz-raw://14662cd18e5e122d927e027d8f2ace81d298f5e9b26b84e07a42cd587711a271",
  				"dweb:/ipfs/QmWRwfUpiGXspRSJboXBGXmMzzYbDkT2Hs276rRehbtAkT"
  			],
  			license: "Apache-2.0"
  		},
  		"src/HebeSwapOracle.sol": {
  			keccak256: "0x24e9a24e8105104d57c6ad72be5bbfa8c7b9cdb77a27102453bd632aa79fbbea",
  			urls: [
  				"bzz-raw://236777fe9d91c7e587a092ce6f2ffcdcadea603211a9327a854d81630a9ee824",
  				"dweb:/ipfs/QmQrhn7fNXb2gHDk5YqNv3viTv24RgHqV9EsKWe9pD8kB7"
  			],
  			license: "AEL"
  		},
  		"src/IOracle.sol": {
  			keccak256: "0xbdb82189368be9100ec49015ca5838207a3bc5bfec11543d0aede20811cb07ad",
  			urls: [
  				"bzz-raw://d6f64b8238eaa188a9b9d7acac753ba0bfccc770b458be512c37c47bc8cafe4c",
  				"dweb:/ipfs/QmWB2nD9chE3EAKYa4joucZUsFstZNJDjRoDbrdXEKkYk1"
  			],
  			license: "AEL"
  		}
  	},
  	version: 1
  };
  var id$2 = 2;
  var hebeSwapOracleArtifact = {
  	abi: abi$2,
  	bytecode: bytecode$2,
  	deployedBytecode: deployedBytecode$2,
  	methodIdentifiers: methodIdentifiers$2,
  	rawMetadata: rawMetadata$2,
  	metadata: metadata$2,
  	id: id$2
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
  var bytecode$1 = {
  	object: "0x60a0806040523461010057604081610333803803809161001f8285610117565b8339810103126101005780516001600160a01b0381169190829003610100576020908101515f80546001600160a01b0319168417905560405163313ce56760e01b81529092909190829060049082905afa801561010c575f906100cb575b60ff9150169081039081116100b757604d81116100b757600a0a6080526040516101e4908161014f82396080518181816054015260cf0152f35b634e487b7160e01b5f52601160045260245ffd5b506020813d602011610104575b816100e560209383610117565b81010312610100575160ff811681036101005760ff9061007d565b5f80fd5b3d91506100d8565b6040513d5f823e3d90fd5b601f909101601f19168101906001600160401b0382119082101761013a57604052565b634e487b7160e01b5f52604160045260245ffdfe6080806040526004361015610012575f80fd5b5f3560e01c908163bef55ef31461008d57508063dddd9e961461007b5763ed3437f81461003d575f80fd5b34610077575f3660031901126100775760206040517f00000000000000000000000000000000000000000000000000000000000000008152f35b5f80fd5b34610077575f36600319011261007757005b34610077575f366003190112610077575f54633fabe5a360e21b825260a090829060049082906001600160a01b03165afa90811561018c575f91610115575b507f00000000000000000000000000000000000000000000000000000000000000009081156101015760209160405191048152f35b634e487b7160e01b5f52601260045260245ffd5b905060a03d60a011610185575b601f8101601f1916820167ffffffffffffffff8111838210176101715760a0918391604052810103126100775761015881610197565b5061016a608060208301519201610197565b50816100cc565b634e487b7160e01b5f52604160045260245ffd5b503d610122565b6040513d5f823e3d90fd5b519069ffffffffffffffffffff821682036100775756fea26469706673582212209673ddeb55b798f5094586c6147a71d254ed39e9b38245e74cfdcd015b47b0cf64736f6c63430008210033",
  	sourceMap: "159:564:26:-:0;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;-1:-1:-1;;;;;159:564:26;;;;;;;;;;;;;;-1:-1:-1;159:564:26;;-1:-1:-1;;;;;;159:564:26;;;;;;;-1:-1:-1;;;447:19:26;;159:564;;;;;;;447:19;;159:564;;447:19;;;;;;-1:-1:-1;447:19:26;;;-1:-1:-1;159:564:26;;;;;;;;;;;;;;;;;;;418:62;;159:564;;;;;;;;418:62;159:564;;;;;;;;;;;;;;;-1:-1:-1;159:564:26;;447:19;159:564;;-1:-1:-1;159:564:26;447:19;;159:564;447:19;;159:564;447:19;;;;;;159:564;447:19;;;:::i;:::-;;;159:564;;;;;;;;;;;;;447:19;;;159:564;-1:-1:-1;159:564:26;;447:19;;;-1:-1:-1;447:19:26;;;159:564;;;-1:-1:-1;159:564:26;;;;;;;;;;-1:-1:-1;;159:564:26;;;;-1:-1:-1;;;;;159:564:26;;;;;;;;;;:::o;:::-;;;;-1:-1:-1;159:564:26;;;;;-1:-1:-1;159:564:26",
  	linkReferences: {
  	}
  };
  var deployedBytecode$1 = {
  	object: "0x6080806040526004361015610012575f80fd5b5f3560e01c908163bef55ef31461008d57508063dddd9e961461007b5763ed3437f81461003d575f80fd5b34610077575f3660031901126100775760206040517f00000000000000000000000000000000000000000000000000000000000000008152f35b5f80fd5b34610077575f36600319011261007757005b34610077575f366003190112610077575f54633fabe5a360e21b825260a090829060049082906001600160a01b03165afa90811561018c575f91610115575b507f00000000000000000000000000000000000000000000000000000000000000009081156101015760209160405191048152f35b634e487b7160e01b5f52601260045260245ffd5b905060a03d60a011610185575b601f8101601f1916820167ffffffffffffffff8111838210176101715760a0918391604052810103126100775761015881610197565b5061016a608060208301519201610197565b50816100cc565b634e487b7160e01b5f52604160045260245ffd5b503d610122565b6040513d5f823e3d90fd5b519069ffffffffffffffffffff821682036100775756fea26469706673582212209673ddeb55b798f5094586c6147a71d254ed39e9b38245e74cfdcd015b47b0cf64736f6c63430008210033",
  	sourceMap: "159:564:26:-:0;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;-1:-1:-1;;159:564:26;;;;;;;246:38;159:564;;;;;;;;;;;;;-1:-1:-1;;159:564:26;;;;;;;;;;;-1:-1:-1;;159:564:26;;;;;;-1:-1:-1;;;630:26:26;;;;159:564;;;;;;-1:-1:-1;;;;;159:564:26;630:26;;;;;;;159:564;630:26;;;159:564;700:13;;159:564;;;;;;;;;;;;;;;;;;;;;;;;;;630:26;;;;;;;;;;159:564;;;-1:-1:-1;;159:564:26;;;;;;;;;;;;630:26;159:564;;;;;630:26;;159:564;;;;;;;:::i;:::-;;;;;;;;;;;:::i;:::-;;630:26;;;159:564;;;;;;;;;;;;630:26;;;;;;159:564;;;;;;;;;;;;;;;;;;;:::o",
  	linkReferences: {
  	},
  	immutableReferences: {
  		"45104": [
  			{
  				start: 84,
  				length: 32
  			},
  			{
  				start: 207,
  				length: 32
  			}
  		]
  	}
  };
  var methodIdentifiers$1 = {
  	"acceptTermsOfService()": "dddd9e96",
  	"readData()": "bef55ef3",
  	"scalingFactor()": "ed3437f8"
  };
  var rawMetadata$1 = "{\"compiler\":{\"version\":\"0.8.33+commit.64118f21\"},\"language\":\"Solidity\",\"output\":{\"abi\":[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"_dataFeedAddress\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"_decimals\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"inputs\":[],\"name\":\"acceptTermsOfService\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"readData\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"scalingFactor\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"}],\"devdoc\":{\"kind\":\"dev\",\"methods\":{},\"version\":1},\"userdoc\":{\"kind\":\"user\",\"methods\":{},\"version\":1}},\"settings\":{\"compilationTarget\":{\"src/ChainlinkOracle.sol\":\"ChainlinkOracle\"},\"evmVersion\":\"prague\",\"libraries\":{},\"metadata\":{\"bytecodeHash\":\"ipfs\"},\"optimizer\":{\"enabled\":true,\"runs\":200},\"remappings\":[\":@api3dao/=lib/contracts/\",\":@chainlink/contracts/=node_modules/@chainlink/contracts/\",\":@eth-optimism/=node_modules/@eth-optimism/\",\":@hebeswap/=lib/hebeswap-contract/\",\":@openzeppelin/=lib/openzeppelin-contracts/\",\":ds-test/=lib/forge-std/lib/ds-test/src/\",\":forge-std/=lib/forge-std/src/\",\":hebeswap-contract/=lib/hebeswap-contract/\",\":openzeppelin-contracts/=lib/openzeppelin-contracts/\",\":solmate/=lib/solmate/src/\"],\"viaIR\":true},\"sources\":{\"node_modules/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol\":{\"keccak256\":\"0x6e6e4b0835904509406b070ee173b5bc8f677c19421b76be38aea3b1b3d30846\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://b3beaa37ee61e4ab615e250fbf01601ae481de843fd0ef55e6b44fd9d5fff8a7\",\"dweb:/ipfs/QmeZUVwd26LzK4Mfp8Zba5JbQNkZFfTzFu1A6FVMMZDg9c\"]},\"src/ChainlinkOracle.sol\":{\"keccak256\":\"0xd3a6904bd77d5ee4219b60b519e323268ac4347db771a43bea2c4e2c58b418ad\",\"license\":\"AEL\",\"urls\":[\"bzz-raw://574ddf2d50bffc03e3457150f00a89105882ec86003405011bca28c76f87e635\",\"dweb:/ipfs/QmXBDr2GGd7nnmaC3tbGPm6ASb2ebuqqds1v3rKxD5aDjw\"]},\"src/IOracle.sol\":{\"keccak256\":\"0xbdb82189368be9100ec49015ca5838207a3bc5bfec11543d0aede20811cb07ad\",\"license\":\"AEL\",\"urls\":[\"bzz-raw://d6f64b8238eaa188a9b9d7acac753ba0bfccc770b458be512c37c47bc8cafe4c\",\"dweb:/ipfs/QmWB2nD9chE3EAKYa4joucZUsFstZNJDjRoDbrdXEKkYk1\"]}},\"version\":1}";
  var metadata$1 = {
  	compiler: {
  		version: "0.8.33+commit.64118f21"
  	},
  	language: "Solidity",
  	output: {
  		abi: [
  			{
  				inputs: [
  					{
  						internalType: "address",
  						name: "_dataFeedAddress",
  						type: "address"
  					},
  					{
  						internalType: "uint256",
  						name: "_decimals",
  						type: "uint256"
  					}
  				],
  				stateMutability: "nonpayable",
  				type: "constructor"
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "nonpayable",
  				type: "function",
  				name: "acceptTermsOfService"
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "view",
  				type: "function",
  				name: "readData",
  				outputs: [
  					{
  						internalType: "uint256",
  						name: "",
  						type: "uint256"
  					}
  				]
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "view",
  				type: "function",
  				name: "scalingFactor",
  				outputs: [
  					{
  						internalType: "uint256",
  						name: "",
  						type: "uint256"
  					}
  				]
  			}
  		],
  		devdoc: {
  			kind: "dev",
  			methods: {
  			},
  			version: 1
  		},
  		userdoc: {
  			kind: "user",
  			methods: {
  			},
  			version: 1
  		}
  	},
  	settings: {
  		remappings: [
  			"@api3dao/=lib/contracts/",
  			"@chainlink/contracts/=node_modules/@chainlink/contracts/",
  			"@eth-optimism/=node_modules/@eth-optimism/",
  			"@hebeswap/=lib/hebeswap-contract/",
  			"@openzeppelin/=lib/openzeppelin-contracts/",
  			"ds-test/=lib/forge-std/lib/ds-test/src/",
  			"forge-std/=lib/forge-std/src/",
  			"hebeswap-contract/=lib/hebeswap-contract/",
  			"openzeppelin-contracts/=lib/openzeppelin-contracts/",
  			"solmate/=lib/solmate/src/"
  		],
  		optimizer: {
  			enabled: true,
  			runs: 200
  		},
  		metadata: {
  			bytecodeHash: "ipfs"
  		},
  		compilationTarget: {
  			"src/ChainlinkOracle.sol": "ChainlinkOracle"
  		},
  		evmVersion: "prague",
  		libraries: {
  		},
  		viaIR: true
  	},
  	sources: {
  		"node_modules/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol": {
  			keccak256: "0x6e6e4b0835904509406b070ee173b5bc8f677c19421b76be38aea3b1b3d30846",
  			urls: [
  				"bzz-raw://b3beaa37ee61e4ab615e250fbf01601ae481de843fd0ef55e6b44fd9d5fff8a7",
  				"dweb:/ipfs/QmeZUVwd26LzK4Mfp8Zba5JbQNkZFfTzFu1A6FVMMZDg9c"
  			],
  			license: "MIT"
  		},
  		"src/ChainlinkOracle.sol": {
  			keccak256: "0xd3a6904bd77d5ee4219b60b519e323268ac4347db771a43bea2c4e2c58b418ad",
  			urls: [
  				"bzz-raw://574ddf2d50bffc03e3457150f00a89105882ec86003405011bca28c76f87e635",
  				"dweb:/ipfs/QmXBDr2GGd7nnmaC3tbGPm6ASb2ebuqqds1v3rKxD5aDjw"
  			],
  			license: "AEL"
  		},
  		"src/IOracle.sol": {
  			keccak256: "0xbdb82189368be9100ec49015ca5838207a3bc5bfec11543d0aede20811cb07ad",
  			urls: [
  				"bzz-raw://d6f64b8238eaa188a9b9d7acac753ba0bfccc770b458be512c37c47bc8cafe4c",
  				"dweb:/ipfs/QmWB2nD9chE3EAKYa4joucZUsFstZNJDjRoDbrdXEKkYk1"
  			],
  			license: "AEL"
  		}
  	},
  	version: 1
  };
  var id$1 = 26;
  var chainlinkOracleArtifact = {
  	abi: abi$1,
  	bytecode: bytecode$1,
  	deployedBytecode: deployedBytecode$1,
  	methodIdentifiers: methodIdentifiers$1,
  	rawMetadata: rawMetadata$1,
  	metadata: metadata$1,
  	id: id$1
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
  var bytecode = {
  	object: "0x60c060405234156100105760006000fd5b6103b28038038060c00160c0811067ffffffffffffffff8211171561003157fe5b8060405250808260c039606081121561004a5760006000fd5b505060c05173ffffffffffffffffffffffffffffffffffffffff8116811415156100745760006000fd5b60e0516100856101005182846100ba565b505060805160a0516102cc806100e6600039818061011c528061029a52508280606a52806101ed5250806000f35050506100e4565b80608052818310156100c857fe5b818303604d8111156100d657fe5b80600a0a60a052505b505050565bfe6080604052600436101515610149576000803560e01c6323f5c02d81146100465763bef55ef381146100985763dddd9e9681146100d35763ed3437f881146100f857610146565b3415610050578182fd5b61005b366004610153565b61006482610196565b8061008f7f000000000000000000000000000000000000000000000000000000000000000083610169565b0381f350610146565b34156100a2578182fd5b6100ad366004610153565b6100b56101e1565b6100be83610196565b806100c98383610184565b0381f35050610146565b34156100dd578182fd5b6100e8366004610153565b816100f283610196565bf3610146565b3415610102578182fd5b61010d366004610153565b61011682610196565b806101417f000000000000000000000000000000000000000000000000000000000000000083610184565b0381f3505b50505b60006000fd6102cb565b600081830312156101645760006000fd5b5b5050565b60006020820190506001600160a01b03831682525b92915050565b60006020820190508282525b92915050565b6000604051905081810181811067ffffffffffffffff821117156101b657fe5b80604052505b919050565b60008160001904831182151516156101d557fe5b82820290505b92915050565b60006001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016803b1515610219578182fd5b6040516315f789a960e21b8152604081600483855afa9150811515610240573d83843e3d83fd5b82821561029557601f19601f3d011682016040526040823d8401031215610265578384fd5b815180601b0b81141515610277578485fd5b602083015163ffffffff81168114151561028f578586fd5b50809150505b6102c27f000000000000000000000000000000000000000000000000000000000000000082601b0b6101c1565b93505050505b90565b",
  	sourceMap: "",
  	linkReferences: {
  	}
  };
  var deployedBytecode = {
  	object: "0x",
  	sourceMap: "",
  	linkReferences: {
  	}
  };
  var methodIdentifiers = {
  	"acceptTermsOfService()": "dddd9e96",
  	"proxyAddress()": "23f5c02d",
  	"readData()": "bef55ef3",
  	"scalingFactor()": "ed3437f8"
  };
  var rawMetadata = "{\"compiler\":{\"version\":\"0.7.6+commit.7338295f\"},\"language\":\"Solidity\",\"output\":{\"abi\":[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"_proxyAddress\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"_api3Decimals\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_decimals\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"inputs\":[],\"name\":\"acceptTermsOfService\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"proxyAddress\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"readData\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"scalingFactor\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"}],\"devdoc\":{\"kind\":\"dev\",\"methods\":{},\"version\":1},\"userdoc\":{\"kind\":\"user\",\"methods\":{},\"version\":1}},\"settings\":{\"compilationTarget\":{\"src/API3Oracle.sol\":\"API3Oracle\"},\"evmVersion\":\"istanbul\",\"libraries\":{},\"metadata\":{\"bytecodeHash\":\"ipfs\"},\"optimizer\":{\"enabled\":true,\"runs\":200},\"remappings\":[\":@api3dao/=lib/contracts/\",\":@chainlink/contracts/=node_modules/@chainlink/contracts/\",\":@eth-optimism/=node_modules/@eth-optimism/\",\":@hebeswap/=lib/hebeswap-contract/\",\":@openzeppelin/=lib/openzeppelin-contracts/\",\":ds-test/=lib/forge-std/lib/ds-test/src/\",\":forge-std/=lib/forge-std/src/\",\":hebeswap-contract/=lib/hebeswap-contract/\",\":openzeppelin-contracts/=lib/openzeppelin-contracts/\",\":solmate/=lib/solmate/src/\"],\"viaIR\":true},\"sources\":{\"lib/contracts/contracts/v0.7/interfaces/IProxy.sol\":{\"keccak256\":\"0xb58d1bf2f49358e1a9313aa219df61458778f1c08019cb8d617ad1881a12c39f\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://5553487e888d4f8f5952282f6998b0272127bedfc74cb229e7b8e14636b1ac38\",\"dweb:/ipfs/QmbtEaueqxcfVNwPzTxsRdoBwQKWqcv5UUq5o79o6tCveL\"]},\"src/API3Oracle.sol\":{\"keccak256\":\"0xebf21858eba51f9ac83d4f6104bd076186de755a5342c834544b0a270d32d27b\",\"license\":\"AEL\",\"urls\":[\"bzz-raw://35ada8a00d86957055fb18b1ae7435984c12d8c4ea8b12507458a723af2d1caa\",\"dweb:/ipfs/QmRkz5BKkRDZ3uScuZZQLZ6M2oHxsoud8Xpws9ToPwx1Ub\"]}},\"version\":1}";
  var metadata = {
  	compiler: {
  		version: "0.7.6+commit.7338295f"
  	},
  	language: "Solidity",
  	output: {
  		abi: [
  			{
  				inputs: [
  					{
  						internalType: "address",
  						name: "_proxyAddress",
  						type: "address"
  					},
  					{
  						internalType: "uint256",
  						name: "_api3Decimals",
  						type: "uint256"
  					},
  					{
  						internalType: "uint256",
  						name: "_decimals",
  						type: "uint256"
  					}
  				],
  				stateMutability: "nonpayable",
  				type: "constructor"
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "nonpayable",
  				type: "function",
  				name: "acceptTermsOfService"
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "view",
  				type: "function",
  				name: "proxyAddress",
  				outputs: [
  					{
  						internalType: "address",
  						name: "",
  						type: "address"
  					}
  				]
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "view",
  				type: "function",
  				name: "readData",
  				outputs: [
  					{
  						internalType: "uint256",
  						name: "",
  						type: "uint256"
  					}
  				]
  			},
  			{
  				inputs: [
  				],
  				stateMutability: "view",
  				type: "function",
  				name: "scalingFactor",
  				outputs: [
  					{
  						internalType: "uint256",
  						name: "",
  						type: "uint256"
  					}
  				]
  			}
  		],
  		devdoc: {
  			kind: "dev",
  			methods: {
  			},
  			version: 1
  		},
  		userdoc: {
  			kind: "user",
  			methods: {
  			},
  			version: 1
  		}
  	},
  	settings: {
  		remappings: [
  			"@api3dao/=lib/contracts/",
  			"@chainlink/contracts/=node_modules/@chainlink/contracts/",
  			"@eth-optimism/=node_modules/@eth-optimism/",
  			"@hebeswap/=lib/hebeswap-contract/",
  			"@openzeppelin/=lib/openzeppelin-contracts/",
  			"ds-test/=lib/forge-std/lib/ds-test/src/",
  			"forge-std/=lib/forge-std/src/",
  			"hebeswap-contract/=lib/hebeswap-contract/",
  			"openzeppelin-contracts/=lib/openzeppelin-contracts/",
  			"solmate/=lib/solmate/src/"
  		],
  		optimizer: {
  			enabled: true,
  			runs: 200
  		},
  		metadata: {
  			bytecodeHash: "ipfs"
  		},
  		compilationTarget: {
  			"src/API3Oracle.sol": "API3Oracle"
  		},
  		evmVersion: "istanbul",
  		libraries: {
  		},
  		viaIR: true
  	},
  	sources: {
  		"lib/contracts/contracts/v0.7/interfaces/IProxy.sol": {
  			keccak256: "0xb58d1bf2f49358e1a9313aa219df61458778f1c08019cb8d617ad1881a12c39f",
  			urls: [
  				"bzz-raw://5553487e888d4f8f5952282f6998b0272127bedfc74cb229e7b8e14636b1ac38",
  				"dweb:/ipfs/QmbtEaueqxcfVNwPzTxsRdoBwQKWqcv5UUq5o79o6tCveL"
  			],
  			license: "MIT"
  		},
  		"src/API3Oracle.sol": {
  			keccak256: "0xebf21858eba51f9ac83d4f6104bd076186de755a5342c834544b0a270d32d27b",
  			urls: [
  				"bzz-raw://35ada8a00d86957055fb18b1ae7435984c12d8c4ea8b12507458a723af2d1caa",
  				"dweb:/ipfs/QmRkz5BKkRDZ3uScuZZQLZ6M2oHxsoud8Xpws9ToPwx1Ub"
  			],
  			license: "AEL"
  		}
  	},
  	version: 1
  };
  var id = 2;
  var api3OracleArtifact = {
  	abi: abi,
  	bytecode: bytecode,
  	deployedBytecode: deployedBytecode,
  	methodIdentifiers: methodIdentifiers,
  	rawMetadata: rawMetadata,
  	metadata: metadata,
  	id: id
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

  const getHebeSwapOracleContract = (web3, oracleAddress, msgSender) => {
    const oracle = new web3.eth.Contract(hebeSwapOracleArtifact.abi, oracleAddress, {
      from: msgSender
    });
    return oracle;
  };

  const getChainlinkOracleContract = (web3, oracleAddress, msgSender) => {
    const oracle = new web3.eth.Contract(chainlinkOracleArtifact.abi, oracleAddress, {
      from: msgSender
    });
    return oracle;
  };


  const getAPI3OracleContract = (web3, oracleAddress, msgSender) => {
    const oracle = new web3.eth.Contract(api3OracleArtifact.abi, oracleAddress, {
      from: msgSender
    });
    return oracle;
  };

  exports.FEE_UI_UNSCALED = FEE_UI_UNSCALED;
  exports.appendFees = appendFees;
  exports.approveTx = approveTx;
  exports.buyRcIsisTx = buyRcIsisTx;
  exports.buyRcTx = buyRcTx;
  exports.buyScIsisTx = buyScIsisTx;
  exports.buyScTx = buyScTx;
  exports.calculateBcUsdEquivalent = calculateBcUsdEquivalent;
  exports.calculateFutureScPrice = calculateFutureScPrice;
  exports.calculateIsRatioAboveMin = calculateIsRatioAboveMin;
  exports.calculateIsRatioBelowMax = calculateIsRatioBelowMax;
  exports.calculateRcUsdEquivalent = calculateRcUsdEquivalent;
  exports.calculateTxFees = calculateTxFees;
  exports.checkAllowance = checkAllowance;
  exports.convertToBC = convertToBC;
  exports.deductFees = deductFees;
  exports.getAPI3OracleContract = getAPI3OracleContract;
  exports.getAccountDetails = getAccountDetails;
  exports.getBcUsdEquivalent = getBcUsdEquivalent;
  exports.getChainlinkOracleContract = getChainlinkOracleContract;
  exports.getCoinContracts = getCoinContracts;
  exports.getCoinDetails = getCoinDetails;
  exports.getDecimals = getDecimals;
  exports.getDjedContract = getDjedContract;
  exports.getDjedIsisContract = getDjedIsisContract;
  exports.getDjedTefnutContract = getDjedTefnutContract;
  exports.getFees = getFees;
  exports.getHebeSwapOracleContract = getHebeSwapOracleContract;
  exports.getOracleAddress = getOracleAddress;
  exports.getOracleContract = getOracleContract;
  exports.getPastDjedEvents = getPastDjedEvents;
  exports.getRcUsdEquivalent = getRcUsdEquivalent;
  exports.getScAdaEquivalent = getScAdaEquivalent;
  exports.getSystemParams = getSystemParams;
  exports.getWeb3 = getWeb3;
  exports.isTxLimitReached = isTxLimitReached;
  exports.promiseTx = promiseTx;
  exports.scalingFactor = scalingFactor;
  exports.sellBothIsisTx = sellBothIsisTx;
  exports.sellBothTx = sellBothTx;
  exports.sellRcIsisTx = sellRcIsisTx;
  exports.sellRcTx = sellRcTx;
  exports.sellScIsisTx = sellScIsisTx;
  exports.sellScTx = sellScTx;
  exports.subscribeToDjedEvents = subscribeToDjedEvents;
  exports.tradeDataPriceBuyRc = tradeDataPriceBuyRc;
  exports.tradeDataPriceBuySc = tradeDataPriceBuySc;
  exports.tradeDataPriceCore = tradeDataPriceCore;
  exports.tradeDataPriceSellBoth = tradeDataPriceSellBoth;
  exports.tradeDataPriceSellRc = tradeDataPriceSellRc;
  exports.tradeDataPriceSellSc = tradeDataPriceSellSc;
  exports.verifyTx = verifyTx;

}));
