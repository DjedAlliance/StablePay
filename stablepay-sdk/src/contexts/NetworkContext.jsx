import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { TokenSelector } from '../core/TokenSelector';

const NetworkContext = createContext();

export const NetworkProvider = ({ children, networkSelector }) => {
  const [tokenSelector] = useState(() => new TokenSelector(networkSelector));
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);
  const [transactionDetails, setTransactionDetails] = useState(null);

  const resetState = useCallback(() => {
    setSelectedToken(null);
    setTransactionDetails(null);
  }, []);

  const selectNetwork = useCallback((networkKey) => {
    if (networkSelector.selectNetwork(networkKey)) {
      setSelectedNetwork(networkKey);
      resetState(); 
      return true;
    }
    return false;
  }, [networkSelector, resetState]);

  const selectToken = useCallback((tokenKey) => {
    if (tokenSelector.selectToken(tokenKey)) {
      const token = tokenSelector.getSelectedToken();
      setSelectedToken(token);
      return true;
    }
    return false;
  }, [tokenSelector]);

  const resetSelections = useCallback(() => {
    networkSelector.selectNetwork(null);
    setSelectedNetwork(null);
    resetState();
  }, [networkSelector, resetState]);

  // Synchronize context state with NetworkSelector
  useEffect(() => {
    setSelectedNetwork(networkSelector.selectedNetwork);
  }, [networkSelector.selectedNetwork]);

  const contextValue = useMemo(() => ({ 
    networkSelector,
    tokenSelector,
    selectedNetwork,
    selectedToken,
    transactionDetails,
    setTransactionDetails,
    selectNetwork,
    selectToken,
    resetSelections
  }), [
    networkSelector,
    tokenSelector,
    selectedNetwork,
    selectedToken,
    transactionDetails,
    selectNetwork,
    selectToken,
    resetSelections
  ]);

  return (
    <NetworkContext.Provider value={contextValue}>
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