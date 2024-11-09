import React from 'react';
import { useNetwork } from '../contexts/NetworkContext';
import styles from '../styles/PricingCard.css';

const NetworkDropdown = () => {
  const { networkSelector, selectedNetwork, selectNetwork } = useNetwork();

  const handleNetworkChange = (event) => {
    selectNetwork(event.target.value);
  };

  return (
    <div className={styles.selectField}>
      <label htmlFor="network-select">Select Network</label>
      <select 
        id="network-select"
        onChange={handleNetworkChange} 
        value={selectedNetwork || ""}
      >
        <option value="" disabled>Select a network</option>
        {Object.keys(networkSelector.availableNetworks).map((networkKey) => (
          <option key={networkKey} value={networkKey}>{networkKey}</option>
        ))}
      </select>
    </div>
  );
};

export default NetworkDropdown;