import { createWalletClient, custom } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

/**
 * @class CoinbaseWalletAdapter
 * @description Manages the connection to the Coinbase Wallet.
 */
export class CoinbaseWalletAdapter {
  constructor() {
    this.client = null;
    this.account = null;
    this.chainId = null;
    this.name = 'Coinbase Wallet';
  }

  /**
   * Checks if the Coinbase Wallet extension is installed and available.
   * @returns {boolean} True if Coinbase Wallet is available, false otherwise.
   */
  isAvailable() {
    return !!window.ethereum && (window.ethereum.isCoinbaseWallet || (window.ethereum.providers && window.ethereum.providers.find(p => p.isCoinbaseWallet)));
  }

  /**
   * Gets the injected Coinbase Wallet provider.
   * @private
   */
  getProvider() {
    if (!this.isAvailable()) {
      return null;
    }
    if (window.ethereum.isCoinbaseWallet) {
      return window.ethereum;
    }
    // If multiple wallets are injected, find the Coinbase Wallet provider
    return window.ethereum.providers.find(p => p.isCoinbaseWallet);
  }

  /**
   * Connects to the Coinbase Wallet.
   * @param {number} chainId - The ID of the chain to connect to.
   * @returns {Promise<{client: object, account: string, chainId: number}>} The wallet client, account address, and chain ID.
   */
  async connect(chainId) {
    const provider = this.getProvider();
    if (!provider) {
      throw new Error('Coinbase Wallet is not installed or not available.');
    }

    try {
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      });

      const client = createWalletClient({
        chain: this.getChainConfig(chainId),
        transport: custom(provider),
      });

      this.client = client;
      this.account = accounts[0];
      this.chainId = chainId;

      return {
        client: this.client,
        account: this.account,
        chainId: this.chainId,
      };
    } catch (error) {
      console.error('Error connecting to Coinbase Wallet:', error);
      throw new Error('Failed to connect to Coinbase Wallet.');
    }
  }

  /**
   * Disconnects from the wallet.
   */
  async disconnect() {
    this.client = null;
    this.account = null;
    this.chainId = null;
  }

  /**
   * Gets the wallet client instance.
   * @returns {object|null} The viem wallet client.
   */
  getClient() {
    return this.client;
  }

  /**
   * Gets the connected account address.
   * @returns {string|null} The account address.
   */
  getAccount() {
    return this.account;
  }

  /**
   * Gets the current chain ID.
   * @returns {number|null} The chain ID.
   */
  getChainId() {
    return this.chainId;
  }

  /**
   * Gets the chain configuration from a chain ID.
   * @private
   */
  getChainConfig(chainId) {
    const chains = {
      1: mainnet,
      11155111: sepolia,
    };
    const chain = chains[chainId];
    if (!chain) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    return chain;
  }
}