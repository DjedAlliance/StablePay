import React, { useState, useEffect } from "react";
import { useNetwork } from "../contexts/NetworkContext";
import { useWallet } from "../contexts/WalletContext";
import { Transaction } from "../core/Transaction";
import styles from "../styles/PricingCard.css";

const TransactionReview = () => {
  const {
    networkSelector,
    tokenSelector,
    selectedNetwork,
    selectedToken,
    transactionDetails: contextTransactionDetails,
    setTransactionDetails,
  } = useNetwork();

  const {
    connectWallet,
    account,
    chainId,
    error: walletError,
    networkError,
    isConnecting,
  } = useWallet();

  //  using Local transaction states here
  const [transaction, setTransaction] = useState(null);
  const [tradeDataBuySc, setTradeDataBuySc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeTransaction = async () => {
      if (selectedNetwork && selectedToken) {
        setLoading(true);
        setError(null);
        try {
          const networkConfig = networkSelector.getSelectedNetworkConfig();
          const receivingAddress = networkSelector.getReceivingAddress();
          const tokenAmount = networkSelector.getTokenAmount(selectedToken.key);

          console.log("Selected Token Key:", selectedToken.key);
          console.log("Token Amount:", tokenAmount);

          const newTransaction = new Transaction(
            networkConfig.uri,
            networkConfig.djedAddress
          );
          await newTransaction.init();
          setTransaction(newTransaction);

          const blockchainDetails = newTransaction.getBlockchainDetails();

          console.log("Blockchain Details:", blockchainDetails);

          // native token = fetch trade data asap
          let tradeData = null;
          if (selectedToken.key === "native") {
            console.log("Fetching trade data for native token");
            try {
              const amountString = String(tokenAmount);
              tradeData = await newTransaction.handleTradeDataBuySc(
                amountString
              );
              console.log("Trade data fetched:", tradeData);
              setTradeDataBuySc(tradeData);
            } catch (tradeError) {
              console.error("Error fetching trade data:", tradeError);
            }
          } else {
            console.log("Stablecoin selected, skipping trade data fetch");
          }

          console.log("Debug Information:", {
            tokenType: selectedToken.key,
            isDirectTransfer: selectedToken.isDirectTransfer,
            isNativeToken: selectedToken.isNative,
            tradeData: tradeData,
            receivingAddress: receivingAddress,
            djedContractAddress: networkConfig.djedAddress,
            blockchainDetails: blockchainDetails,
          });

          const details = {
            network: selectedNetwork,
            token: selectedToken.key,
            tokenSymbol: selectedToken.symbol,
            amount: tokenAmount,
            receivingAddress: receivingAddress,
            djedContractAddress: networkConfig.djedAddress,
            isDirectTransfer: selectedToken.isDirectTransfer || false,
            isNativeToken: selectedToken.isNative || false,
            tradeAmount: tradeData ? tradeData.amount : null,
            ...blockchainDetails,
          };

          setTransactionDetails(details);
        } catch (err) {
          console.error("Error initializing transaction:", err);
          setError("Failed to initialize transaction. Please try again.");
        } finally {
          setLoading(false);
        }
      }
    };

    initializeTransaction();
  }, [selectedNetwork, selectedToken, networkSelector, setTransactionDetails]);

  const handleConnectWallet = async () => {
    const success = await connectWallet();
    if (success) {
      console.log("Wallet connected:", account);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading transaction details...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!selectedNetwork || !selectedToken || !contextTransactionDetails) {
    return null;
  }

  return (
    <div className={styles.transactionReview}>
      {/* Network Info */}
      <div className={styles.transactionInfo}>
        <span className={styles.transactionLabel}>Network:</span>
        <span className={styles.transactionValue}>
          {contextTransactionDetails.network}
        </span>
      </div>

      {/* You Pay */}
      <div className={styles.transactionInfo}>
        <span className={styles.transactionLabel}>You Pay:</span>
        <span className={styles.transactionValue}>
          {selectedToken.key === "stablecoin"
            ? `${contextTransactionDetails.amount} ${contextTransactionDetails.tokenSymbol}`
            : `${tradeDataBuySc ? tradeDataBuySc : "Calculating..."} ${
                contextTransactionDetails.tokenSymbol
              }`}
        </span>
      </div>

      {/* Merchant Receives */}
      <div className={styles.transactionInfo}>
        <span className={styles.transactionLabel}>Merchant Receives:</span>
        <span className={styles.transactionValue}>
          {`${contextTransactionDetails.amount} ${
            selectedToken.key === "stablecoin"
              ? contextTransactionDetails.tokenSymbol
              : networkSelector.getSelectedNetworkConfig().tokens.stablecoin
                  .symbol
          }`}
        </span>
      </div>

      {/* Wallet Button */}
      <button
        className={styles.walletButton}
        onClick={handleConnectWallet}
        disabled={isConnecting}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
    </div>
  );
};

export default TransactionReview;
