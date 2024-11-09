import React, { createContext, useContext, useState, useCallback } from "react";
import { createWalletClient, custom } from "viem";
import { sepolia, mainnet } from "viem/chains";

const WalletContext = createContext(null);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};

export const WalletProvider = ({ children, networkConfig }) => {
  const [walletClient, setWalletClient] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [networkError, setNetworkError] = useState(null);

  const getChainConfig = (chainId) => {
    const chains = {
      1: mainnet,
      11155111: sepolia,
      //to-do:add more chains here
    };
    return chains[chainId];
  };

  const checkNetwork = async (currentChainId) => {
    const expectedChainId = getExpectedChainId();

    if (currentChainId !== expectedChainId) {
      const errorMsg = `Wrong network detected. Please switch to ${getNetworkName(
        expectedChainId
      )}`;
      console.log(errorMsg);
      setNetworkError(errorMsg);
      return false;
    }

    setNetworkError(null);
    return true;
  };

  const getExpectedChainId = () => {
    return 11155111;
  };

  const getNetworkName = (chainId) => {
    const networks = {
      1: "Ethereum Mainnet",
      11155111: "Sepolia Testnet",
    };
    return networks[chainId] || "Unknown Network";
  };

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("Please install MetaMask or another Web3 wallet");
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const chainIdHex = await window.ethereum.request({
        method: "eth_chainId",
      });
      const currentChainId = parseInt(chainIdHex, 16);

      await checkNetwork(currentChainId);

      const chain = getChainConfig(currentChainId);
      if (!chain) {
        throw new Error("Unsupported chain");
      }

      const client = createWalletClient({
        chain,
        transport: custom(window.ethereum),
      });

      setWalletClient(client);
      setAccount(accounts[0]);
      setChainId(currentChainId);

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return true;
    } catch (err) {
      console.error("Error connecting wallet:", err);
      setError(err.message);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const handleChainChanged = async (chainIdHex) => {
    const newChainId = parseInt(chainIdHex, 16);
    setChainId(newChainId);

    await checkNetwork(newChainId);

    const chain = getChainConfig(newChainId);
    if (chain && window.ethereum) {
      const client = createWalletClient({
        chain,
        transport: custom(window.ethereum),
      });
      setWalletClient(client);
    }
  };

  const disconnectWallet = useCallback(() => {
    setWalletClient(null);
    setAccount(null);
    setChainId(null);
    setNetworkError(null);

    if (window.ethereum) {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    }
  }, []);

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAccount(accounts[0]);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        walletClient,
        account,
        chainId,
        error,
        networkError,
        isConnecting,
        connectWallet,
        disconnectWallet,
        checkNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
