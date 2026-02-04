import React, { useState, useEffect } from "react";
import { useNetwork } from "../contexts/NetworkContext";
import { useWallet } from "../contexts/WalletContext";
import { Transaction } from "../core/Transaction";
import { parseUnits } from "viem"; 
import styles from "../styles/PricingCard.css"; 

const TransactionReview = ({ onTransactionComplete }) => {
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
    walletClient,
    ensureCorrectNetwork,
    isConnecting,
  } = useWallet();

  const [transaction, setTransaction] = useState(null);
  const [txData, setTxData] = useState(null);
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [isErrorDetailsVisible, setIsErrorDetailsVisible] = useState(false);
  
  // Approval States
  const [isApproved, setIsApproved] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    setTxData(null);
    setMessage("");
    setError(null);
    setTxHash(null);
    setIsApproved(false);
  }, [selectedNetwork, selectedToken]);

  useEffect(() => {
    const initializeTransaction = async () => {
      if (!selectedNetwork || !selectedToken) return;

      try {
        const networkConfig = networkSelector.getSelectedNetworkConfig();
        const selectedTokenObj = tokenSelector.getSelectedToken();
        const stablecoinConfig = selectedTokenObj.config;
        
        const newTransaction = new Transaction(
          networkConfig.uri,
          stablecoinConfig
        );
        
        await newTransaction.init();
        setTransaction(newTransaction);

        const tokenAmount = networkSelector.getTokenAmount(selectedToken.key);
        let tradeDataAmount = null;

        try {
            tradeDataAmount = await newTransaction.handleTradeDataBuySc(String(tokenAmount));
        } catch (tradeError) {
            console.error("Error fetching trade data:", tradeError);
        }

        setTransactionDetails({
          network: selectedNetwork,
          token: selectedToken.key,
          tokenSymbol: selectedToken.symbol,
          amount: tokenAmount || "0",
          receivingAddress: networkSelector.getReceivingAddress(),
          tradeAmount: tradeDataAmount, 
          ...newTransaction.getBlockchainDetails(),
        });
        
        if (account) {
            if (!stablecoinConfig.baseAsset.isNative && tradeDataAmount) {
                 checkAllowance(newTransaction, account, tradeDataAmount, stablecoinConfig.baseAsset.decimals);
            } else if (stablecoinConfig.baseAsset.isNative) {
                 setIsApproved(true);
            }
        }

      } catch (err) {
        console.error("Error initializing transaction:", err);
      }
    };

    initializeTransaction();
  }, [selectedNetwork, selectedToken, networkSelector, account]); 

  const checkAllowance = async (txInstance, userAccount, amountStr, decimals) => {
      try {
          const amountBigInt = parseUnits(String(amountStr), decimals);
          const hasAllowance = await txInstance.checkBaseAssetAllowance(userAccount, amountBigInt);
          setIsApproved(hasAllowance);
      } catch (e) {
          console.error("Error checking allowance", e);
      }
  };

  const handleConnectWallet = async () => {
    await connectWallet();
  };
  
  const handleApprove = async () => {
      if (!transaction || !account) return;
      setIsApproving(true);
      setMessage("⏳ Approving token usage...");
      try {
          const { tradeAmount, baseAssetDecimals } = contextTransactionDetails;
          const amount = parseUnits(String(tradeAmount), baseAssetDecimals);
          
          const approveData = await transaction.approveBaseAsset(account, amount);
          const freshWalletClient = await ensureCorrectNetwork();
          
          const hash = await freshWalletClient.sendTransaction({
             ...approveData,
             account
          });
          
          setMessage(`⏳ Approval Sent. Waiting...`);
          
         
          const receipt = await walletClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'success') {
                setIsApproved(true);
                setMessage("✅ Approved! You can now send the payment.");
            } else {
                setMessage("❌ Approval transaction failed on-chain.");
            }
          setIsApproving(false);
          
      } catch(e) {
          console.error(e);
          setError(e);
          setMessage("❌ Approval failed.");
          setIsApproving(false);
      }
  };

  const handlePrepareTransaction = async () => {
    if (!account || !transaction) return;

    try {
      setTxData(null);
      setError(null);
      setMessage("⏳ Preparing transaction...");

      const { tradeAmount, receivingAddress, baseAssetDecimals, baseAssetIsNative } = contextTransactionDetails;
      const valueInUnits = parseUnits(String(tradeAmount), baseAssetDecimals);

      const builtTx = await transaction.buyStablecoins(
        account,
        receivingAddress,
        valueInUnits
      );

      const finalTx = { ...builtTx, account: account };
      
      if (baseAssetIsNative) {
          finalTx.value = valueInUnits;
      } else {
          finalTx.value = 0n; // ERC20s send 0 value (uses data payload)
      }

      setTxData(finalTx);
      setMessage("✅ Transaction ready! Click 'Send Transaction' to proceed.");
    } catch (error) {
      setError(error);
      setMessage(`❌ Transaction preparation failed.`);
    }
  };

  const handleSendTransaction = async () => {
    try {
      if (!account || !txData) return;
      
      const freshWalletClient = await ensureCorrectNetwork();
      setMessage("⏳ Sending transaction...");
      
      const txHash = await freshWalletClient.sendTransaction(txData);

      setTxHash(txHash);
      setMessage(`✅ Transaction sent!`);
      
      if (onTransactionComplete) {
        onTransactionComplete({
          txHash,
          network: selectedNetwork,
          amount: contextTransactionDetails?.amount,
        });
      }
    } catch (error) {
      setError(error);
      setMessage(`❌ Transaction failed.`);
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
          {contextTransactionDetails.tradeAmount 
            ? `${contextTransactionDetails.tradeAmount} ${contextTransactionDetails.baseAssetSymbol}`
            : "Calculating..."}
        </span>
      </div>

      <button className={styles.walletButton} onClick={handleConnectWallet} disabled={isConnecting}>
        {isConnecting ? "Connecting..." : account ? `Connected: ${account.slice(0,6)}...` : "Connect Wallet"}
      </button>

      {account && !contextTransactionDetails.baseAssetIsNative && !isApproved && (
         <button className={styles.walletButton} onClick={handleApprove} disabled={isApproving}>
            {isApproving ? "Approving..." : `Approve ${contextTransactionDetails.baseAssetSymbol}`}
         </button>
      )}

      {account && (contextTransactionDetails.baseAssetIsNative || isApproved) && !txData && (
        <button className={styles.walletButton} onClick={handlePrepareTransaction}>
          Prepare Transaction
        </button>
      )}
      
      {account && txData && (
        <button className={styles.walletButton} onClick={handleSendTransaction} disabled={txHash !== null}>
          Send Transaction
        </button>
      )}

      {message && <div className="message-box">{message}</div>}
      
      {txHash && (
        <div className={styles.transactionLink}>
            ✅ Transaction Hash: {txHash.slice(0, 10)}...
        </div>
      )}
    </div>
  );
};

export default TransactionReview;
