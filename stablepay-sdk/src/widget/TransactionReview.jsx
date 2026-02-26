import React, { useState, useEffect } from "react";
import { useNetwork } from "../contexts/NetworkContext";
import { useWallet } from "../contexts/WalletContext";
import { Transaction } from "../core/Transaction";
import { parseEther, encodeFunctionData, parseUnits } from "viem";
import styles from "../styles/PricingCard.css";

const TransactionReview = ({ onTransactionComplete }) => {
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
    ensureCorrectNetwork,
  } = useWallet();

  const [transaction, setTransaction] = useState(null);
  const [tradeDataBuySc, setTradeDataBuySc] = useState(null);
  const [txData, setTxData] = useState(null);
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [isErrorDetailsVisible, setIsErrorDetailsVisible] = useState(false);

  // Reset when network/token changes
  useEffect(() => {
    setTxData(null);
    setTradeDataBuySc(null);
    setMessage("");
    setError(null);
    setTxHash(null);
  }, [selectedNetwork, selectedToken]);

  // Initialize transaction
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
          tradeData = await newTransaction.handleTradeDataBuySc(
            String(tokenAmount)
          );
          setTradeDataBuySc(tradeData);
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
          tradeAmount: tradeData || null,
          ...newTransaction.getBlockchainDetails(),
        });
      } catch (err) {
        console.error("Error initializing transaction:", err);
      }
    };

    initializeTransaction();
  }, [selectedNetwork, selectedToken]);

  if (!contextTransactionDetails) {
    return <div className={styles.loading}>Initializing transaction...</div>;
  }

  // Connect wallet
  const handleConnectWallet = async () => {
    await connectWallet();
  };

  // Prepare transaction
  const handleSendTransaction = async () => {
    if (!account || !transaction) {
      setMessage("❌ Wallet not connected or transaction not ready");
      return;
    }

    try {
      setTxData(null);
      setError(null);
      setMessage("⏳ Preparing transaction...");

      const receiver = contextTransactionDetails.receivingAddress;
      let builtTx;

      // -------------------------
      // NATIVE (Buy Stablecoins)
      // -------------------------
      if (selectedToken.key === "native") {
        if (!walletClient) {
          setMessage("❌ Wallet client not available");
          return;
        }

        const amountToSend = tradeDataBuySc || "0";
        const valueInWei = parseEther(String(amountToSend));

        builtTx = await transaction.buyStablecoins(
          walletClient,
          receiver,
          valueInWei
        );
      }

      // -------------------------
      // STABLECOIN TRANSFER
      // -------------------------
      else {
        const networkConfig = networkSelector.getSelectedNetworkConfig();
        const stablecoinAddress =
          networkConfig?.tokens?.stablecoin?.address;

        if (!stablecoinAddress) {
          throw new Error(
            "Stablecoin address not found in network configuration"
          );
        }

        const amountToSend = contextTransactionDetails.amount
          ? parseUnits(
              String(contextTransactionDetails.amount),
              contextTransactionDetails.stableCoinDecimals
            )
          : 0n;

        builtTx = {
          to: stablecoinAddress,
          value: 0n,
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
          account: account,
        };
      }

      setTxData(builtTx);
      setMessage("✅ Transaction ready! Click 'Send Transaction' to proceed.");
    } catch (error) {
      setError(error);
      setMessage("❌ Transaction preparation failed.");
    }
  };

  // Send transaction
  const handleBuySc = async () => {
    try {
      if (!account || !txData) {
        setMessage("❌ Wallet account or transaction missing");
        return;
      }

      setMessage("⏳ Verifying network...");

      const freshWalletClient = await ensureCorrectNetwork();
      if (!freshWalletClient) {
        setMessage("❌ Failed to switch network");
        return;
      }

      setMessage("⏳ Sending transaction...");

      const txHash = await freshWalletClient.sendTransaction({
        ...txData,
        account,
      });

      setTxHash(txHash);
      setMessage("✅ Transaction sent!");

      if (onTransactionComplete) {
        onTransactionComplete({
          txHash,
          network: selectedNetwork,
          token: selectedToken?.key,
          tokenSymbol: selectedToken?.symbol,
          amount: contextTransactionDetails?.amount,
          receivingAddress:
            contextTransactionDetails?.receivingAddress,
        });
      }
    } catch (err) {
      setError(err);
      setMessage("❌ Transaction failed.");
      console.error(err);
    }
  };

  const getExplorerUrl = () => {
    if (!txHash || !selectedNetwork) return null;

    const explorerBaseUrls = {
      "ethereum-classic":
        "https://blockscout.com/etc/mainnet/tx/",
      sepolia: "https://sepolia.etherscan.io/tx/",
      "milkomeda-mainnet":
        "https://explorer-mainnet-cardano-evm.c1.milkomeda.com/tx/",
    };

    return explorerBaseUrls[selectedNetwork]
      ? `${explorerBaseUrls[selectedNetwork]}${txHash}`
      : null;
  };

  return (
    <div className={styles.transactionReview}>
      <div className={styles.transactionInfo}>
        <span>Network:</span>
        <span>{contextTransactionDetails.network}</span>
      </div>

      <div className={styles.transactionInfo}>
        <span>You Pay:</span>
        <span>
          {selectedToken.key === "stablecoin"
            ? `${contextTransactionDetails.amount} ${contextTransactionDetails.tokenSymbol}`
            : `${tradeDataBuySc || "Calculating..."} ${
                contextTransactionDetails.tokenSymbol
              }`}
        </span>
      </div>

      <button onClick={handleConnectWallet} disabled={isConnecting}>
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>

      {account && !txData && (
        <button onClick={handleSendTransaction}>
          Prepare Transaction
        </button>
      )}

      {account && txData && (
        <button onClick={handleBuySc} disabled={!!txHash}>
          Send Transaction
        </button>
      )}

      {message && <div>{message}</div>}

      {txHash && (
        <div>
          ✅ Transaction Hash:{" "}
          {getExplorerUrl() ? (
            <a href={getExplorerUrl()} target="_blank" rel="noreferrer">
              {txHash.slice(0, 6)}...{txHash.slice(-6)}
            </a>
          ) : (
            txHash
          )}
        </div>
      )}
    </div>
  );
};

export default TransactionReview;