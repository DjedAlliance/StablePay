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
    const newValue = event.target.value;
    setError(null);
    setLoading(true);

    try {
      if (selectToken(newValue)) {
        const networkConfig = networkSelector.getSelectedNetworkConfig();
        const transaction = new Transaction(
          networkConfig.uri,
          networkConfig.djedAddress,
          networkConfig.protocol,
          networkConfig.routerAddress
        );
        await transaction.init();

        const tokenAmount = networkSelector.getTokenAmount(newValue);
        const blockchainDetails = transaction.getBlockchainDetails();

        let tradeData = null;
        if (newValue === "native") {
          tradeData = await transaction.handleTradeDataBuySc(
            String(tokenAmount)
          );
        }

        setTransactionDetails({
          network: selectedNetwork,
          token: newValue,
          tokenSymbol: tokenSelector.getSelectedToken().symbol,
          amount: tokenAmount,
          receivingAddress: networkSelector.getReceivingAddress(),
          djedContractAddress: networkConfig.djedAddress,
          isDirectTransfer:
            tokenSelector.getSelectedToken().isDirectTransfer || false,
          isNativeToken: tokenSelector.getSelectedToken().isNative || false,
          tradeAmount: tradeData ? tradeData.amount : null,
          ...blockchainDetails,
        });
      }
    } catch (err) {
      console.error("Error fetching transaction details:", err);
      setError("Failed to fetch transaction details. Please try again.");
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
