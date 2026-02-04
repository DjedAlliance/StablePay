import React, { useState } from "react";
import { useNetwork } from "../contexts/NetworkContext";
import { Transaction } from "../core/Transaction";
import styles from "../styles/PricingCard.css";

const TokenDropdown = () => {
  const {
    networkSelector,
    tokenSelector,
    selectedNetwork,
    selectedToken,
    selectToken,
    setTransactionDetails,
  } = useNetwork();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

 const handleTokenChange = async (event) => {
    const newValue = event.target.value; // e.g., 'djed-eth'
    setError(null);
    setLoading(true);

    try {
      if (selectToken(newValue)) {
        const networkConfig = networkSelector.getSelectedNetworkConfig();
        
        // Find the specific stablecoin object matching the selected ID
        const selectedStablecoin = networkConfig.stablecoins.find(
          (sc) => sc.id === newValue
        );

        if (!selectedStablecoin) {
          throw new Error("Stablecoin configuration not found");
        }

        // Pass the full stablecoin object (replaces the removed djedAddress)
        const transaction = new Transaction(
          networkConfig.uri,
          selectedStablecoin 
        );
        await transaction.init();

        const tokenAmount = networkSelector.getTokenAmount(newValue); 
        const blockchainDetails = transaction.getBlockchainDetails();

        setTransactionDetails({
          network: selectedNetwork,
          token: newValue,
          tokenSymbol: selectedStablecoin.stableCoin.symbol,
          amount: tokenAmount,
          receivingAddress: networkSelector.getReceivingAddress(),
          
          // Use properties from the selected stablecoin object
          djedContractAddress: selectedStablecoin.contractAddress,
          isDirectTransfer: selectedStablecoin.stableCoin.isDirectTransfer || false,
          baseAssetSymbol: selectedStablecoin.baseAsset.symbol,
          baseAssetDecimals: selectedStablecoin.baseAsset.decimals,
          baseAssetIsNative: selectedStablecoin.baseAsset.isNative,
          ...blockchainDetails,
        });
      }
    } catch (err) {
      console.error("Error updating transaction details:", err);
      setError("Failed to initialize transaction.");
    } finally {
      setLoading(false);
    }
  };

  const availableTokens = selectedNetwork
    ? tokenSelector.getAvailableTokens()
    : [];

  return (
    <div className={styles.selectField}>
      <label htmlFor="token-select">Select Token</label>
      <select
        id="token-select"
        onChange={handleTokenChange}
        value={selectedToken ? selectedToken.key : ""}
        disabled={!selectedNetwork || loading}
      >
        <option value="" disabled>
          {selectedNetwork
            ? loading
              ? "Loading..."
              : "Select a token"
            : "Please select a network first"}
        </option>
        {availableTokens.map((token) => (
          <option key={token.key} value={token.key}>
            {token.symbol} (
            {token.isDirectTransfer ? "Direct Transfer" : "Native"})
          </option>
        ))}
      </select>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
};

export default TokenDropdown;
