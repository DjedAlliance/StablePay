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
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [isErrorDetailsVisible, setIsErrorDetailsVisible] = useState(false);
  const [interactionState, setInteractionState] = useState('IDLE');

  useEffect(() => {
    setTradeDataBuySc(null);
    setMessage("");
    setError(null);
    setTxHash(null);
    setInteractionState('IDLE');
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

  if (!selectedNetwork || !selectedToken) {
    return null;
  }

  if (!contextTransactionDetails) {
    if (typeof window !== 'undefined' && !window.ethereum) {
      return (
        <div className={styles.transactionReview}>
          <div className={styles.messageBox} style={{ textAlign: 'center', marginBottom: '1rem', color: '#ff4d4f' }}>
            No wallet found.
          </div>
          <div className={styles.walletButtonContainer}>
            <button 
              className={styles.walletButton} 
              onClick={() => window.open('https://metamask.io/download/', '_blank')}
            >
              Connect Wallet
            </button>
          </div>
        </div>
      );
    }
    return <div className={styles.loading}>Initializing transaction...</div>;
  }

  const handleConnectWallet = async () => {
    setMessage("");
    setError(null);
    try {
      await connectWallet();
    } catch (err) {
      setMessage(err.message || "Failed to connect wallet. Please open MetaMask to login.");
      setError(err);
    }
  };

  const executePayment = async () => {
    if (!account || !contextTransactionDetails || !transaction) {
      setMessage("Wallet not connected or transaction details missing");
      return;
    }

    setInteractionState('PROCESSING');
    setMessage("Preparing transaction...");
    setError(null);
    setTxHash(null);

    try {
      if (window.ethereum) {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      }
    } catch (err) {
      setError(err);
      setMessage("Failed to access wallet. Please unlock MetaMask.");
      setInteractionState('IDLE');
      return;
    }

    let builtTx;
    try {
      const receiver = contextTransactionDetails.receivingAddress;

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
    } catch (err) {
      setError(err);
      const reason = err.shortMessage || err.message || "Unknown error";
      setMessage(`Transaction preparation failed: ${reason}`);
      setInteractionState('IDLE');
      return;
    }

    setMessage("Please check your wallet to confirm the transaction...");
    
    try {
      const networkConfig = networkSelector.getSelectedNetworkConfig();
      if (!networkConfig) {
        throw new Error("Network configuration not found");
      }

      const freshWalletClient = await ensureCorrectNetwork();
      if (!freshWalletClient) {
        throw new Error("Failed to switch to correct network. Please approve the network switch in MetaMask.");
      }

      if (!window.ethereum) {
        throw new Error("MetaMask not available");
      }

      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainIdHex, 16);

      if (currentChainId !== networkConfig.chainId) {
        throw new Error(`Network mismatch. MetaMask is on chain ${currentChainId}, but ${selectedNetwork} requires chain ${networkConfig.chainId}. Please switch networks in MetaMask.`);
      }

      if (freshWalletClient.chain.id !== networkConfig.chainId) {
        throw new Error(`Wallet client chain mismatch. Wallet client is on chain ${freshWalletClient.chain.id}, but expected ${networkConfig.chainId}.`);
      }

      const txHash = await freshWalletClient.sendTransaction({
        ...builtTx,
        account: account,
      });

      setTxHash(txHash);
      setMessage(`Waiting for transaction confirmation...`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === 'success') {
        setMessage(`Transaction confirmed successfully!`);
        setInteractionState('SUCCESS');
        
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
      } else {
        throw new Error('Transaction reverted on-chain.');
      }
    } catch (err) {
      setError(err);
      
      let reason = "Unknown error";
      if (err.name === 'UserRejectedRequestError' || err.code === 4001) {
        reason = "User denied transaction";
      } else if (err.name === 'ContractFunctionRevertedError' || (err.data && err.data.message)) {
        reason = err.shortMessage || err.data?.message || err.message;
      } else if (err.message === 'Transaction reverted on-chain.') {
        reason = err.message;
      } else {
        reason = err.shortMessage || err.message || "Transaction failed";
      }
      
      setMessage(`Transaction failed: ${reason}`);
      setInteractionState('IDLE');
      console.error('Transaction error:', err);
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
        <span className={`${styles.transactionValue} ${styles.highlight}`}>
          {selectedToken.key === "stablecoin"
            ? `${contextTransactionDetails.amount} ${contextTransactionDetails.tokenSymbol}`
            : `${tradeDataBuySc ? tradeDataBuySc : "Calculating..."} ${
                contextTransactionDetails.tokenSymbol
              }`}
        </span>
      </div>

      {message && (
        <div className={styles.messageBox}>
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
          Transaction Hash:{" "}
          {getExplorerUrl() ? (
            <a
              href={getExplorerUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.explorerLink}
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

      {interactionState !== 'SUCCESS' && (
        <div className={styles.walletButtonContainer}>
          {!account && (
            <button className={styles.walletButton} onClick={handleConnectWallet} disabled={isConnecting}>
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}

          {account && interactionState === 'IDLE' && (
            <button className={styles.walletButton} onClick={executePayment}>
              Pay {contextTransactionDetails.amount} {contextTransactionDetails.tokenSymbol}
            </button>
          )}

          {account && interactionState === 'PROCESSING' && (
            <button className={styles.walletButton} disabled>
              Processing...
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TransactionReview;
