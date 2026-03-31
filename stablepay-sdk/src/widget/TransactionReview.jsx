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

  useEffect(() => {
    setTxData(null);
    setTradeDataBuySc(null);
    setMessage("");
    setError(null);
    setTxHash(null);
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

  useEffect(() => {
   
    if (!transaction || !selectedToken || selectedToken.key !== "native") return;

    const refreshPrice = async () => {
      try {
        const tokenAmount = networkSelector.getTokenAmount(selectedToken.key);
        if (tokenAmount) {
          const tradeData = await transaction.handleTradeDataBuySc(String(tokenAmount));
          setTradeDataBuySc(tradeData);
        }
      } catch (refreshError) {
        console.warn("Failed to refresh price data:", refreshError);
      }
    };

    const intervalId = setInterval(refreshPrice, 15000); 

    return () => clearInterval(intervalId);
  }, [transaction, selectedToken, networkSelector]);

  if (!contextTransactionDetails) {
    return <div className={styles.loading}>Initializing transaction...</div>;
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
        const stablecoinAddress = networkConfig?.tokens?.stablecoin?.address;
        
        if (!stablecoinAddress) {
          throw new Error('Stablecoin address not found in network configuration');
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
      setMessage(`❌ Transaction preparation failed.`);
    }
  };

  const handleBuySc = async () => {
    setError(null);
    
    try {
      if (!account || !txData) {
        setMessage("❌ Wallet account or transaction data is missing");
        return;
      }

      if (!selectedNetwork) {
        setMessage("❌ Network not selected");
        return;
      }

      const networkConfig = networkSelector.getSelectedNetworkConfig();
      if (!networkConfig) {
        setMessage("❌ Network configuration not found");
        return;
      }

      setMessage("⏳ Verifying network...");

      const freshWalletClient = await ensureCorrectNetwork();
      if (!freshWalletClient) {
        setMessage("❌ Failed to switch to correct network. Please approve the network switch in MetaMask and try again.");
        return;
      }

      if (!window.ethereum) {
        setMessage("❌ MetaMask not available");
        return;
      }

      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainIdHex, 16);

      if (currentChainId !== networkConfig.chainId) {
        const errorMsg = `Network mismatch. MetaMask is on chain ${currentChainId}, but ${selectedNetwork} requires chain ${networkConfig.chainId}. Please switch networks in MetaMask.`;
        setMessage(`❌ ${errorMsg}`);
        setError(new Error(errorMsg));
        return;
      }

      if (freshWalletClient.chain.id !== networkConfig.chainId) {
        const errorMsg = `Wallet client chain mismatch. Wallet client is on chain ${freshWalletClient.chain.id}, but expected ${networkConfig.chainId}.`;
        setMessage(`❌ ${errorMsg}`);
        setError(new Error(errorMsg));
        return;
      }

      setMessage("⏳ Sending transaction...");

      const txHash = await freshWalletClient.sendTransaction({
        ...txData,
        account: account,
      });

      setTxHash(txHash);
      setMessage(`✅ Transaction sent!`);
      
      if (onTransactionComplete) {
        onTransactionComplete({
          txHash,
          network: selectedNetwork,
          token: selectedToken?.key,
          tokenSymbol: selectedToken?.symbol,
          amount: contextTransactionDetails?.amount,
          receivingAddress: contextTransactionDetails?.receivingAddress,
        });
      }
    } catch (error) {
      setError(error);
      setMessage(`❌ Transaction failed.`);
      console.error('Transaction error:', error);
    }
  };

  const getExplorerUrl = () => {
    if (!txHash || !selectedNetwork) return null;

    const explorerBaseUrls = {
      "ethereum-classic": "https://blockscout.com/etc/mainnet/tx/",
      "sepolia": "https://sepolia.etherscan.io/tx/",
      "milkomeda-mainnet": "https://explorer-mainnet-cardano-evm.c1.milkomeda.com/tx/",
    };

    return explorerBaseUrls[selectedNetwork]
      ? `${explorerBaseUrls[selectedNetwork]}${txHash}`
      : null;
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

      {account && !txData && (
        <button className={styles.walletButton} onClick={handleSendTransaction}>
          Prepare Transaction
        </button>
      )}
      {account && txData && (
  <button 
    className={styles.walletButton} 
    onClick={handleBuySc} 
    disabled={txHash !== null} // Disable the button when txHash is set
  >
    Send Transaction
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
          {getExplorerUrl() ? (
    <a
              href={getExplorerUrl()}
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
          ) : (
            <span style={{ wordBreak: "break-word" }}>
              {txHash}
            </span>
          )}
  </div>
)}

    </div>
  );
};

export default TransactionReview;
