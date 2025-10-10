import React from "react";
import { useNetwork } from "../contexts/NetworkContext";

const NetworkSelector = () => {
  const { selectNetwork, availableNetworks } = useNetwork();

  const handleNetworkChange = (event) => {
    selectNetwork(event.target.value);
  };

  const containerStyle = {
    backgroundColor: "var(--background)",
    color: "var(--text)",
    padding: "20px",
    borderRadius: "8px",
    border: "1px solid var(--secondary)",
  };

  const selectStyle = {
    backgroundColor: "var(--background)",
    color: "var(--text)",
    border: "1px solid var(--secondary)",
    padding: "8px",
    borderRadius: "4px",
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ color: "var(--primary)" }}>Select Network</h3>
      <select onChange={handleNetworkChange} style={selectStyle}>
        <option value="">Select a network</option>
        {Object.entries(availableNetworks).map(
          ([networkKey, networkConfig]) => (
            <option key={networkKey} value={networkKey}>
              {networkKey} (Chain ID: {networkConfig.chainId})
            </option>
          )
        )}
      </select>
    </div>
  );
};

export default NetworkSelector;