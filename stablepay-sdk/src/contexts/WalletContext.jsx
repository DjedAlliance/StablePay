import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createWalletClient, createPublicClient, custom, http } from 'viem';
import { useNetwork } from './NetworkContext';
import { getChainByNetworkKey, getChainConfigForWallet } from './chains';

const WalletContext = createContext(null);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

const switchToNetwork = async (networkKey) => {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  const chainConfig = getChainConfigForWallet(networkKey);
  if (!chainConfig) {
    throw new Error(`Unsupported network: ${networkKey}`);
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainConfig.chainId }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [chainConfig],
        });
      } catch (addError) {
        if (addError.code === 4001) {
          throw new Error(`User rejected adding ${chainConfig.chainName} to MetaMask. Please add it manually.`);
        }
        throw new Error(`Failed to add ${chainConfig.chainName} to MetaMask: ${addError.message}`);
      }
    } else if (switchError.code === 4001) {
      throw new Error(`User rejected switching to ${chainConfig.chainName}. Please switch manually in MetaMask.`);
    } else {
      throw new Error(`Failed to switch to ${chainConfig.chainName}: ${switchError.message}`);
    }
  }
};

export const WalletProvider = ({ children }) => {
  const { selectedNetwork } = useNetwork();
  const [walletClient, setWalletClient] = useState(null);
  const [publicClient, setPublicClient] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const selectedChain = selectedNetwork ? getChainByNetworkKey(selectedNetwork) : null;
  const expectedChainId = selectedChain ? selectedChain.id : null;

  const disconnectWalletInternal = useCallback(() => {
    setWalletClient(null);
    setPublicClient(null);
    setAccount(null);
    setChainId(null);
    setBalance(null);
    setError(null);
  }, []);

  const handleChainChanged = useCallback(async (chainIdHex) => {
    const newChainId = parseInt(chainIdHex, 16);
    setChainId(newChainId);

    if (selectedChain && newChainId === expectedChainId) {
      setError(null);
      if (window.ethereum && selectedChain) {
        const newWalletClient = createWalletClient({ 
          chain: selectedChain, 
          transport: custom(window.ethereum) 
        });
        setWalletClient(newWalletClient);
      }
    } else if (selectedChain && newChainId !== expectedChainId) {
      const chainName = selectedChain?.name || selectedNetwork || 'selected network';
      setError(`Wrong network detected. Please switch to ${chainName}`);
    }
  }, [selectedChain, expectedChainId, selectedNetwork]);

  const handleAccountsChanged = useCallback(async (accounts) => {
    if (accounts.length === 0) {
      disconnectWalletInternal();
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    } else {
      setAccount(accounts[0]);
      if (selectedChain) {
        const newPublicClient = createPublicClient({ chain: selectedChain, transport: http() });
        setPublicClient(newPublicClient);
        const balance = await newPublicClient.getBalance({ address: accounts[0] });
        setBalance(parseFloat(balance) / Math.pow(10, 18));
      }
    }
  }, [selectedChain, disconnectWalletInternal, handleChainChanged]);

  const disconnectWallet = useCallback(() => {
    disconnectWalletInternal();
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
  }, [disconnectWalletInternal, handleAccountsChanged, handleChainChanged]);

  const connectPublicClient = useCallback(() => {
    if (selectedChain) {
      setPublicClient(createPublicClient({ chain: selectedChain, transport: http() }));
    }
  }, [selectedChain]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask or another Web3 wallet');
      return false;
    }

    if (!selectedNetwork || !selectedChain) {
      setError('Please select a network first');
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      if (accounts.length === 0) {
        throw new Error('No wallet address found. Please unlock your wallet.');
      }

      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainIdHex, 16);

      if (currentChainId !== expectedChainId) {
        await switchToNetwork(selectedNetwork);
      }

      const newWalletClient = createWalletClient({
        chain: selectedChain,
        transport: custom(window.ethereum),
      });

      setWalletClient(newWalletClient);
      setAccount(accounts[0]);
      setChainId(expectedChainId);

      const newPublicClient = createPublicClient({ chain: selectedChain, transport: http() });
      setPublicClient(newPublicClient);
      const balance = await newPublicClient.getBalance({ address: accounts[0] });
      setBalance(parseFloat(balance) / Math.pow(10, 18));

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return true;
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError(err.message);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [selectedNetwork, selectedChain, expectedChainId, handleAccountsChanged, handleChainChanged]);

  const ensureCorrectNetwork = useCallback(async () => {
    if (!window.ethereum || !selectedNetwork || !selectedChain || !account) {
      const errorMsg = 'Wallet not connected or network not selected';
      setError(errorMsg);
      return null;
    }

    try {
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainIdHex, 16);

      if (currentChainId !== expectedChainId) {
        setError(null);
        await switchToNetwork(selectedNetwork);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const newChainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        const newChainId = parseInt(newChainIdHex, 16);
        if (newChainId !== expectedChainId) {
          throw new Error(`Failed to switch network. MetaMask is still on chain ${newChainId}, expected ${expectedChainId}`);
        }
      }

      const freshWalletClient = createWalletClient({
        chain: selectedChain,
        transport: custom(window.ethereum),
      });

      setWalletClient(freshWalletClient);
      setChainId(expectedChainId);
      setError(null);
      return freshWalletClient;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [selectedNetwork, selectedChain, expectedChainId, account]);

  const prevNetworkRef = useRef(selectedNetwork);

  useEffect(() => {
    if (prevNetworkRef.current !== null && 
        prevNetworkRef.current !== selectedNetwork && 
        account) {
      disconnectWalletInternal();
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
    }
    prevNetworkRef.current = selectedNetwork;
  }, [selectedNetwork, account, disconnectWalletInternal, handleAccountsChanged, handleChainChanged]);

  useEffect(() => {
    connectPublicClient();
  }, [connectPublicClient]);

  return (
    <WalletContext.Provider
      value={{
        walletClient,
        publicClient,
        account,
        chainId,
        balance,
        error,
        isConnecting,
        connectWallet,
        disconnectWallet,
        ensureCorrectNetwork,
        expectedChainId,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};