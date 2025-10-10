import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { WalletProvider as WalletProviderClass } from '../core/WalletProvider';

const WalletContext = createContext(null);

/**
 * Custom hook to access the wallet context.
 * @returns {{
 *  client: object | null,
 *  account: string | null,
 *  error: string | null,
 *  isConnecting: boolean,
 *  isLoading: boolean,
 *  connect: (walletName: string) => Promise<boolean>,
 *  disconnect: () => Promise<void>,
 *  getAvailableWallets: () => Array<{name: string, id: string}>
 * }}
 */
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletContextProvider');
  }
  return context;
};

/**
 * Provider component for the wallet context.
 * Manages wallet state and connection logic.
 * @param {{children: React.ReactNode, chainId: number}} props
 */
export const WalletContextProvider = ({ children, chainId }) => {
  const [walletProvider] = useState(() => new WalletProviderClass(chainId));
  const [client, setClient] = useState(null);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // For initial session restoration

  const connect = useCallback(async (walletName) => {
    setIsConnecting(true);
    setError(null);
    try {
      const { client: newClient, account: newAccount } = await walletProvider.connect(walletName);
      setClient(newClient);
      setAccount(newAccount);
      return true;
    } catch (err) {
      console.error(`Error connecting with ${walletName}:`, err);
      setError(err.message);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [walletProvider]);

  const disconnect = useCallback(async () => {
    await walletProvider.disconnect();
    setClient(null);
    setAccount(null);
  }, [walletProvider]);
  
  // Attempt to restore session on initial load
  useEffect(() => {
    const restore = async () => {
      try {
        const session = await walletProvider.restoreSession();
        if (session) {
          setClient(session.client);
          setAccount(session.account);
        }
      } catch (err) {
        console.error('Error restoring session:', err);
        setError('Could not restore wallet session.');
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, [walletProvider]);

  const value = {
    client,
    account,
    error,
    isConnecting,
    isLoading,
    connect,
    disconnect,
    getAvailableWallets: () => walletProvider.getAvailableWallets(),
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};