import React from 'react';
import { useNetwork } from '../contexts/NetworkContext';

const NetworkSelector = () => {
  const { selectNetwork, availableNetworks } = useNetwork();

  const handleNetworkChange = (event) => {
    selectNetwork(event.target.value);
  };

  return (
    <div>
      <h3>Select Network</h3>
      <select onChange={handleNetworkChange}>
        <option value="">Select a network</option>
        {Object.entries(availableNetworks).map(([networkKey, networkConfig]) => (
          <option key={networkKey} value={networkKey}>
            {networkKey} (Chain ID: {networkConfig.chainId})
          </option>
        ))}
      </select>
    </div>
  );
};

export default NetworkSelector;