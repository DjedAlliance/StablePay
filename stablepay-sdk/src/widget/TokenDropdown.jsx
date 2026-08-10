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
        // Pass the whole config: the adapter layer selects the protocol from
        // it. The old two-argument form assumed Djed and passed
        // `networkConfig.djedAddress`, which is undefined on a Tectonic
        // network and threw before any RPC call was made.
        const transaction = new Transaction(networkConfig);
        await transaction.init();

        const tokenAmount = networkSelector.getTokenAmount(newValue);
        const blockchainDetails = transaction.getBlockchainDetails();

        let quote = null;
        if (newValue === "native") {
          quote = await transaction.quoteNativePayment(String(tokenAmount));
        }

        setTransactionDetails({
          network: selectedNetwork,
          token: newValue,
          tokenSymbol: tokenSelector.getSelectedToken().symbol,
          amount: tokenAmount,
          receivingAddress: networkSelector.getReceivingAddress(),
          isDirectTransfer:
            tokenSelector.getSelectedToken().isDirectTransfer || false,
          isNativeToken: tokenSelector.getSelectedToken().isNative || false,
          tradeAmount: quote ? quote.requiredBCFormatted : null,
          ...blockchainDetails,
        });
      }
    } catch (err) {
      console.error("Error fetching transaction details:", err);
      if (typeof window !== 'undefined' && !window.ethereum) {
        setError("No wallet found. Please install a Web3 wallet.");
      } else {
        setError("Failed to fetch transaction details. Please try again.");
      }
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
