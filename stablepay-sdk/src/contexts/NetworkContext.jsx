import React, { createContext, useState, useContext, useEffect } from 'react';
import { TokenSelector } from '../core/TokenSelector';

const NetworkContext = createContext();

export const NetworkProvider = ({ children, networkSelector }) => {
  const [tokenSelector] = useState(() => new TokenSelector(networkSelector));
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);
  const [transactionDetails, setTransactionDetails] = useState(null);

  const resetState = () => {
    setSelectedToken(null);
    setTransactionDetails(null);
  };

  const selectNetwork = (networkKey) => {
    if (networkSelector.selectNetwork(networkKey)) {
      setSelectedNetwork(networkKey);
      resetState(); 
      return true;
    }
    return false;
  };

  const selectToken = (tokenKey) => {
    if (tokenSelector.selectToken(tokenKey)) {
      const token = tokenSelector.getSelectedToken();
      setSelectedToken(token);
      return true;
    }
    return false;
  };

  const resetSelections = () => {
    networkSelector.selectNetwork(null);
    setSelectedNetwork(null);
    resetState();
  };

  // Synchronize context state with NetworkSelector
  useEffect(() => {
    setSelectedNetwork(networkSelector.selectedNetwork);
  }, [networkSelector.selectedNetwork]);

  return (
    <NetworkContext.Provider value={{ 
      networkSelector,
      tokenSelector,
      selectedNetwork,
      selectedToken,
      transactionDetails,
      setTransactionDetails,
      selectNetwork,
      selectToken,
      resetSelections
    }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

export default NetworkContext;