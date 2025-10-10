import { createWalletClient, custom } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

/**
 * @class MetaMaskAdapter
 * @description Manages the connection to the MetaMask wallet.
 */
export class MetaMaskAdapter {
  constructor() {
    this.client = null;
    this.account = null;
    this.chainId = null;
    this.name = 'MetaMask';
  }

  /**
   * Checks if MetaMask is installed and available.
   * @returns {boolean} True if MetaMask is available, false otherwise.
   */
  isAvailable() {
    return !!window.ethereum && window.ethereum.isMetaMask;
  }

  /**
   * Connects to the MetaMask wallet.
   * @param {number} chainId - The ID of the chain to connect to.
   * @returns {Promise<{client: object, account: string, chainId: number}>} The wallet client, account address, and chain ID.
   */
  async connect(chainId) {
    if (!this.isAvailable()) {
      throw new Error('MetaMask is not installed or not available.');
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const client = createWalletClient({
        chain: this.getChainConfig(chainId),
        transport: custom(window.ethereum),
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
      console.error('Error connecting to MetaMask:', error);
      throw new Error('Failed to connect to MetaMask.');
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