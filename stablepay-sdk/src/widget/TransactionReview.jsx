import React, { useState, useEffect } from "react";
import { useNetwork } from "../contexts/NetworkContext";
import { useWallet } from "../contexts/WalletContext";
import { Transaction } from "../core/Transaction";
import { parseUnits } from "viem";
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
  // Display string only. The exact wei amount is re-quoted immediately before
  // signing and never derived by parsing this back.
  const [tradeDataBuySc, setTradeDataBuySc] = useState(null);
  const [protocolWarnings, setProtocolWarnings] = useState([]);
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [isErrorDetailsVisible, setIsErrorDetailsVisible] = useState(false);
  const [interactionState, setInteractionState] = useState('IDLE');

  useEffect(() => {
    setTradeDataBuySc(null);
    setProtocolWarnings([]);
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

        // The whole network config is passed now: the adapter layer picks the
        // protocol (Djed or Tectonic) from it.
        const newTransaction = new Transaction(networkConfig);
        await newTransaction.init();
        setTransaction(newTransaction);

        let quote = null;
        if (selectedToken.key === "native") {
          try {
            quote = await newTransaction.quoteNativePayment(String(tokenAmount));

            setTradeDataBuySc(quote.requiredBCFormatted);
          } catch (tradeError) {
            console.error("Error fetching trade data:", tradeError);
          }
        }

        // Protocol-specific merchant warnings (Tectonic stability fees and
        // triggered redemptions have no Djed equivalent).
        newTransaction.getWarnings().then(setProtocolWarnings);

        setTransactionDetails({
          network: selectedNetwork,
          token: selectedToken.key,
          tokenSymbol: selectedToken.symbol,
          amount: tokenAmount || "0",
          receivingAddress,
          isDirectTransfer: selectedToken.isDirectTransfer || false,
          isNativeToken: selectedToken.isNative || false,
          tradeAmount: quote ? quote.requiredBCFormatted : null,
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

  // Single source of truth for the symbol the merchant is credited in.
  //
  // The on-screen invoice and the value reported to the merchant's integration
  // must agree, so both read this one value. It comes from the network config
  // rather than the adapter's live on-chain symbol for two reasons: the config
  // is what the merchant configured and reconciles against, and DjedAdapter
  // does not expose a symbol at all, so an adapter-sourced value silently fell
  // back to "SC" on every Djed network.
  const stablecoinSymbol =
    networkSelector.getSelectedNetworkConfig()?.tokens?.stablecoin?.symbol ?? "SC";

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
    // What the CONSUMER hands over, which is not the same as what the merchant
    // receives. On the native path the consumer pays basecoin (e.g. 0.00255102
    // ETH) and the merchant receives the invoice in stablecoins (5 SC).
    // Conflating the two produces nonsense like "5 ETH".
    let paidAmount = contextTransactionDetails.amount;
    let paidSymbol = selectedToken.symbol;

    try {
      const receiver = contextTransactionDetails.receivingAddress;

      if (selectedToken.key === "native") {
        // Re-quote immediately before signing. The oracle price moves, and a
        // quote fetched when the dialog opened may no longer buy the invoiced
        // amount of stablecoins.
        const quote = await transaction.quoteNativePayment(
          String(contextTransactionDetails.amount)
        );

        setTradeDataBuySc(quote.requiredBCFormatted);
        paidAmount = quote.requiredBCFormatted; // basecoin, not the SC invoice

        builtTx = await transaction.buyStablecoins(account, receiver, quote.requiredBC);
        builtTx = { ...builtTx, value: quote.requiredBC, account };
      } else {
        // The stablecoin address comes from the adapter: under Tectonic the
        // protocol contract is itself the token, so there is no separate
        // address to read out of the config.
        const stablecoinAddress = transaction.getStablecoinAddress();
        if (!stablecoinAddress) {
          throw new Error('Stablecoin address could not be resolved for this network');
        }

        const amountToSend = contextTransactionDetails.amount
          ? parseUnits(
              String(contextTransactionDetails.amount),
              transaction.getDecimals()
            )
          : 0n;

        builtTx = {
          ...transaction.buildTransferTx({
            from: account,
            to: receiver,
            amount: amountToSend,
          }),
          account,
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

            // What the consumer paid. On the native path this is basecoin
            // (0.00255102 ETH), NOT the stablecoin invoice.
            amount: paidAmount,
            tokenSymbol: paidSymbol,

            // What the merchant receives — always denominated in stablecoins,
            // whichever token the consumer chose to pay with. This is the
            // figure a merchant should reconcile against their invoice.
            amountReceived: contextTransactionDetails?.amount,
            receivedSymbol: stablecoinSymbol,

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

      {/* On the native path the consumer pays basecoin but the merchant is
          credited stablecoins. Showing only one side invites the reading that
          the invoice itself is denominated in ETH. */}
      {selectedToken.key === "native" && (
        <div className={styles.transactionInfo}>
          <span className={styles.transactionLabel}>Merchant Receives:</span>
          <span className={styles.transactionValue}>
            {contextTransactionDetails.amount}{" "}
            {stablecoinSymbol}
          </span>
        </div>
      )}

      {protocolWarnings.map((warning, index) => (
        <div
          key={index}
          className={styles.messageBox}
          style={{
            fontSize: "0.85em",
            color: warning.level === "warning" ? "#ff4d4f" : "inherit",
          }}
        >
          {warning.message}
        </div>
      ))}

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
              {/* Must match the "You Pay" row above: on the native path the
                  consumer pays basecoin, not the stablecoin invoice amount. */}
              Pay{" "}
              {selectedToken.key === "stablecoin"
                ? contextTransactionDetails.amount
                : tradeDataBuySc ?? "…"}{" "}
              {contextTransactionDetails.tokenSymbol}
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
