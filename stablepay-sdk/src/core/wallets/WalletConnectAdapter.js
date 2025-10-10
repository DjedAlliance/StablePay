import { createWalletClient, custom } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { EthereumProvider } from '@walletconnect/ethereum-provider';
import dotenv from 'dotenv';
dotenv.config();

/**
 * @class WalletConnectAdapter
 * @description Manages the connection to WalletConnect.
 */
export class WalletConnectAdapter {
  constructor() {
    this.provider = null;
    this.client = null;
    this.account = null;
    this.chainId = null;
    this.name = 'WalletConnect';
  }

  /**
   * Checks if WalletConnect is available (it's a protocol, so it's always available).
   * @returns {boolean} True.
   */
  isAvailable() {
    return true;
  }

  /**
   * Connects to a wallet using WalletConnect.
   * @param {number} chainId - The ID of the chain to connect to.
   * @returns {Promise<{client: object, account: string, chainId: number}>} The wallet client, account address, and chain ID.
   */
  async connect(chainId) {
    const projectId = process.env.PROJECT_ID;
    if (!projectId) {
      throw new Error('WalletConnect projectId is not configured.');
    }

    try {
      this.provider = await EthereumProvider.init({
        projectId,
        chains: [chainId],
        showQrModal: true,
      });

      await this.provider.enable();

      const client = createWalletClient({
        chain: this.getChainConfig(chainId),
        transport: custom(this.provider),
      });

      const accounts = await client.getAddresses();
      
      this.client = client;
      this.account = accounts[0];
      this.chainId = chainId;

      return {
        client: this.client,
        account: this.account,
        chainId: this.chainId,
      };
    } catch (error) {
      console.error('Error connecting to WalletConnect:', error);
      throw new Error('Failed to connect with WalletConnect.');
    }
  }

  /**
   * Disconnects from the wallet.
   */
  async disconnect() {
    if (this.provider) {
      await this.provider.disconnect();
    }
    this.provider = null;
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