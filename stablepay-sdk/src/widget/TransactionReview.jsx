import React, { useState, useEffect } from "react";
import { useNetwork } from "../contexts/NetworkContext";
import { useWallet } from "../contexts/WalletContext";
import { Transaction } from "../core/Transaction";
import { parseEther, encodeFunctionData, parseUnits } from "viem"; 
import styles from "../styles/PricingCard.css";

const STABLECOIN_CONTRACT_ADDRESS = "0xdc86935A9597aA3A9008d2f26232233043091284"; 

const TransactionReview = () => {
  const {
    networkSelector,
    selectedNetwork,
    selectedToken,
    transactionDetails: contextTransactionDetails,
    setTransactionDetails,
  } = useNetwork();

  const {
    connectWallet,
    account,
    walletClient,
    isConnecting,
  } = useWallet();

  const [transaction, setTransaction] = useState(null);
  const [tradeDataBuySc, setTradeDataBuySc] = useState(null);
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [isErrorDetailsVisible, setIsErrorDetailsVisible] = useState(false);

  useEffect(() => {
    const initializeTransaction = async () => {
      if (!selectedNetwork || !selectedToken) return;

      try {
        const networkConfig = networkSelector.getSelectedNetworkConfig();
        const receivingAddress = networkSelector.getReceivingAddress();
        const tokenAmount = networkSelector.getTokenAmount(selectedToken.key);

        const newTransaction = new Transaction(
          networkConfig.uri,
          networkConfig.djedAddress
        );
        await newTransaction.init();
        setTransaction(newTransaction);

        let tradeData = null;
        if (selectedToken.key === "native") {
          try {
            tradeData = await newTransaction.handleTradeDataBuySc(String(tokenAmount));
            setTradeDataBuySc(tradeData);
          } catch (tradeError) {
            console.error("Error fetching trade data:", tradeError);
          }
        }

        setTransactionDetails({
          network: selectedNetwork,
          token: selectedToken.key,
          tokenSymbol: selectedToken.symbol,
          amount: tokenAmount || "0",
          receivingAddress,
          djedContractAddress: networkConfig.djedAddress,
          isDirectTransfer: selectedToken.isDirectTransfer || false,
          isNativeToken: selectedToken.isNative || false,
          tradeAmount: tradeData ? tradeData.amount : null,
          ...newTransaction.getBlockchainDetails(),
        });
      } catch (err) {
        console.error("Error initializing transaction:", err);
      }
    };

    initializeTransaction();
  }, [selectedNetwork, selectedToken, networkSelector, setTransactionDetails]);

  if (!contextTransactionDetails) {
    return <div className={styles.loading}>Initializing transaction...</div>;
  }

  const handleConnectWallet = async () => {
    const success = await connectWallet();
    if (success) {
      console.log("Wallet connected:", account);
    }
  };
  
  // Single Pay function to prepare and send the transaction
  const handlePay = async () => {
    if (!account || !contextTransactionDetails || !transaction) {
      setMessage("❌ Wallet not connected or transaction details missing");
      return;
    }

    try {
      setMessage("⏳ Preparing transaction...");

      const receiver = contextTransactionDetails.receivingAddress;
      let builtTx;

      if (selectedToken.key === "native") {
        const UI = "0x0232556C83791b8291E9b23BfEa7d67405Bd9839";
        const amountToSend = tradeDataBuySc || "0";

        builtTx = await transaction.buyStablecoins(
          account,
          receiver,
          parseEther(String(amountToSend)),
          UI
        );
      } else {
        const amountToSend = contextTransactionDetails.amount
          ? parseUnits(
              String(contextTransactionDetails.amount),
              contextTransactionDetails.stableCoinDecimals
            )
          : "0";

        builtTx = {
          to: STABLECOIN_CONTRACT_ADDRESS,
          data: encodeFunctionData({
            abi: [
              {
                inputs: [
                  { internalType: "address", name: "to", type: "address" },
                  { internalType: "uint256", name: "amount", type: "uint256" },
                ],
                name: "transfer",
                outputs: [{ internalType: "bool", name: "", type: "bool" }],
                stateMutability: "nonpayable",
                type: "function",
              },
            ],
            functionName: "transfer",
            args: [receiver, amountToSend],
          }),
        };
      }

      // Now send it 
            setMessage("⏳ Sending transaction...");

      const txHash = await walletClient.sendTransaction({
        ...builtTx,
        account: account,
      });

      setTxHash(txHash);
      setMessage("✅ Transaction sent!");
    } catch (error) {
      setError(error);
      setMessage("❌ Transaction failed.");
    }
  };

  return (
    <div className={styles.transactionReview}>
      <div className={styles.transactionInfo}>
        <span className={styles.transactionLabel}>Network:</span>
        <span className={styles.transactionValue}>{contextTransactionDetails.network}</span>
      </div>

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

      <button className={styles.walletButton} onClick={handleConnectWallet} disabled={isConnecting}>
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
      
      {/* Single button to prepare and send transaction (Pay button) */}
      {account && (
        <button className={styles.walletButton} onClick={handlePay}>
          Pay
        </button> 
      )}

      {message && (
        <div className="message-box">
          {message}
          {error && (
            <button
              onClick={() => setIsErrorDetailsVisible(!isErrorDetailsVisible)}
              className={styles.detailsButton}
            >
              {isErrorDetailsVisible ? "Hide Details" : "Show Details"}
            </button>
          )}
        </div>
      )}

      {isErrorDetailsVisible && error && (
        <div className={styles.errorDetails}>
          <pre>{error.message}</pre>
        </div>
      )}

      {txHash && (
        <div className={styles.transactionLink}>
          ✅ Transaction Hash:{" "}
          <a
            href={`https://blockscout.com/etc/mordor/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.explorerLink}
            style={{ 
              color: "#007bff", 
              textDecoration: "underline", 
              fontWeight: "bold", 
              cursor: "pointer",
              wordBreak: "break-word" 
            }}
          >
            {txHash.slice(0, 6)}...{txHash.slice(-6)}
          </a>
        </div>
      )}
    </div>
  );
};

export default TransactionReview;
