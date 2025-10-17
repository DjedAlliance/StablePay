import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createWalletClient, createPublicClient, custom, http } from 'viem';
import { mordor } from './chains';

const WalletContext = createContext(null);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const [walletClient, setWalletClient] = useState(null);
  const [publicClient, setPublicClient] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const expectedChainId = mordor.id; // Use Mordor Testnet

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask or another Web3 wallet');
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
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: `0x${expectedChainId.toString(16)}`,
                    chainName: 'Mordor Testnet',
                    nativeCurrency: {
                      name: 'Mordor ETC',
                      symbol: 'METC',
                      decimals: 18,
                    },
                    rpcUrls: ['https://rpc.mordor.etccooperative.org'],
                    blockExplorerUrls: ['https://etc-mordor.blockscout.com/'],
                  },
                ],
              });
            } catch (addError) {
              throw new Error('Failed to add Mordor Testnet to MetaMask');
            }
          } else {
            throw new Error('Please switch to Mordor Testnet in MetaMask');
          }
        }
      }

      const walletClient = createWalletClient({
        chain: mordor,
        transport: custom(window.ethereum),
      });

      setWalletClient(walletClient);
      setAccount(accounts[0]);
      setChainId(currentChainId);

      const publicClient = createPublicClient({ chain: mordor, transport: http() });
      const balance = await publicClient.getBalance({ address: accounts[0] });
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
  }, []);

  const connectPublicClient = useCallback(() => {
    setPublicClient(createPublicClient({ chain: mordor, transport: http() }));
  }, []);

  const handleChainChanged = async (chainIdHex) => {
    const newChainId = parseInt(chainIdHex, 16);
    setChainId(newChainId);

    if (newChainId !== expectedChainId) {
      setError(`Wrong network detected. Please switch to Mordor Testnet`);
      return;
    }

    if (window.ethereum) {
      const walletClient = createWalletClient({ chain: mordor, transport: custom(window.ethereum) });
      setWalletClient(walletClient);
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAccount(accounts[0]);

      const publicClient = createPublicClient({ chain: mordor, transport: http() });
      const balance = await publicClient.getBalance({ address: accounts[0] });
      setBalance(parseFloat(balance) / Math.pow(10, 18));
    }
  };

  const disconnectWallet = useCallback(() => {
    setWalletClient(null);
    setAccount(null);
    setChainId(null);
    setBalance(null);

    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
  }, []);

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
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};