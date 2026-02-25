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
    publicClient,
    isConnecting,
    ensureCorrectNetwork,
    expectedChainId,
  } = useWallet();

  const [transaction, setTransaction] = useState(null);
  const [tradeDataBuySc, setTradeDataBuySc] = useState(null);
  const [txData, setTxData] = useState(null);
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [isErrorDetailsVisible, setIsErrorDetailsVisible] = useState(false);

  // ✅ NEW STATE TO PREVENT DOUBLE TRANSACTIONS
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setTxData(null);
    setTradeDataBuySc(null);
    setMessage("");
    setError(null);
    setTxHash(null);
    setIsSending(false);
  }, [selectedNetwork, selectedToken]);

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
            tradeData = await newTransaction.handleTradeDataBuySc(
              String(tokenAmount)
            );
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
    return <div>Initializing transaction...</div>;
  }

  const handleConnectWallet = async () => {
    await connectWallet();
  };

  const handleSendTransaction = async () => {
    if (!account || !contextTransactionDetails || !transaction) {
      setMessage("❌ Wallet not connected or transaction details missing");
      return;
    }

    try {
      setTxData(null);
      setError(null);
      setMessage("⏳ Preparing transaction...");

      const receiver = contextTransactionDetails.receivingAddress;
      let builtTx;

      if (selectedToken.key === "native") {
        const UI = "0x0232556C83791b8291E9b23BfEa7d67405Bd9839";
        const amountToSend = tradeDataBuySc || "0";
        const valueInWei = parseEther(String(amountToSend));

        builtTx = await transaction.buyStablecoins(
          account,
          receiver,
          valueInWei,
          UI
        );

        builtTx = {
          ...builtTx,
          value: valueInWei,
          account: account,
        };
      } else {
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
          : "0";

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
                outputs: [
                  { internalType: "bool", name: "", type: "bool" },
                ],
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

  // ✅ SAFE TRANSACTION EXECUTION
  const handleBuySc = async () => {
    if (isSending) return; // Prevent double click

    setError(null);
    setIsSending(true);

    try {
      if (!account || !txData) {
        setMessage("❌ Wallet account or transaction data is missing");
        setIsSending(false);
        return;
      }

      const networkConfig = networkSelector.getSelectedNetworkConfig();

      setMessage("⏳ Verifying network...");

      const freshWalletClient = await ensureCorrectNetwork();
      if (!freshWalletClient) {
        setMessage("❌ Failed to switch network.");
        setIsSending(false);
        return;
      }

      setMessage("⏳ Sending transaction...");

      const txHash = await freshWalletClient.sendTransaction({
        ...txData,
        account: account,
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
    } catch (error) {
      setError(error);
      setMessage("❌ Transaction failed.");
      setIsSending(false); // Re-enable only on failure
    }
  };

  return (
    <div>
      <div>
        <strong>Network:</strong>{" "}
        {contextTransactionDetails.network}
      </div>

      <div>
        <strong>You Pay:</strong>{" "}
        {selectedToken.key === "stablecoin"
          ? `${contextTransactionDetails.amount} ${contextTransactionDetails.tokenSymbol}`
          : `${tradeDataBuySc || "Calculating..."} ${
              contextTransactionDetails.tokenSymbol
            }`}
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
        <button
          onClick={handleBuySc}
          disabled={isSending || txHash !== null}
        >
          {isSending ? "Sending..." : "Send Transaction"}
        </button>
      )}

      {message && <div>{message}</div>}

      {txHash && (
        <div>
          ✅ Transaction Hash:{" "}
          {txHash.slice(0, 6)}...{txHash.slice(-6)}
        </div>
      )}
    </div>
  );
};

export default TransactionReview;