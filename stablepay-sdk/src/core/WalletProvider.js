import { MetaMaskAdapter } from './wallets/MetaMaskAdapter';
import { WalletConnectAdapter } from './wallets/WalletConnectAdapter';
import { CoinbaseWalletAdapter } from './wallets/CoinbaseWalletAdapter';
import CryptoJS from 'crypto-js';

const SESSION_STORAGE_KEY = 'stablepay_wallet_session';
const ENCRYPTION_KEY = 'stablepay-super-secret-key'; // This should be handled more securely in a real app
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

/**
 * @class WalletProvider
 * @description Manages connections to different crypto wallets and persists the session.
 */
export class WalletProvider {
  constructor(chainId) {
    this.chainId = chainId;
    this.adapters = {
      metamask: new MetaMaskAdapter(),
      walletconnect: new WalletConnectAdapter(),
      coinbase: new CoinbaseWalletAdapter(),
    };
    this.activeAdapter = null;
    this.client = null;
    this.account = null;
  }

  /**
   * Connects to a specified wallet.
   * @param {string} walletName - The name of the wallet to connect to ('metamask', 'walletconnect', 'coinbase').
   * @returns {Promise<{client: object, account: string}>}
   */
  async connect(walletName) {
    const adapter = this.adapters[walletName.toLowerCase()];
    if (!adapter) {
      throw new Error(`Wallet "${walletName}" is not supported.`);
    }

    if (!adapter.isAvailable()) {
      throw new Error(`Wallet "${walletName}" is not available.`);
    }

    const { client, account, chainId } = await adapter.connect(this.chainId);
    this.activeAdapter = adapter;
    this.client = client;
    this.account = account;

    this.saveSession(walletName);

    return { client, account, chainId };
  }

  /**
   * Disconnects from the currently active wallet.
   */
  async disconnect() {
    if (this.activeAdapter) {
      await this.activeAdapter.disconnect();
    }
    this.clearSession();
    this.activeAdapter = null;
    this.client = null;
    this.account = null;
  }

  /**
   * Saves the current wallet session to localStorage.
   * @private
   */
  saveSession(walletName) {
    const session = {
      walletName,
      timestamp: Date.now(),
    };
    const encryptedSession = CryptoJS.AES.encrypt(JSON.stringify(session), ENCRYPTION_KEY).toString();
    localStorage.setItem(SESSION_STORAGE_KEY, encryptedSession);
  }

  /**
   * Clears the wallet session from localStorage.
   */
  clearSession() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  /**
   * Restores a wallet session if a valid one exists.
   * @returns {Promise<{client: object, account: string} | null>}
   */
  async restoreSession() {
    const encryptedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!encryptedSession) {
      return null;
    }

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedSession, ENCRYPTION_KEY);
      const decryptedSession = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

      if (Date.now() - decryptedSession.timestamp > SESSION_TIMEOUT) {
        this.clearSession();
        return null;
      }

      return await this.connect(decryptedSession.walletName);
    } catch (error) {
      console.error('Failed to restore session:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Gets the currently active wallet client.
   * @returns {object|null}
   */
  getClient() {
    return this.client;
  }

  /**
   * Gets the currently connected account.
   * @returns {string|null}
   */
  getAccount() {
    return this.account;
  }

  /**
   * Gets the list of available wallet adapters.
   * @returns {Array<object>}
   */
  getAvailableWallets() {
    return Object.values(this.adapters)
      .filter(adapter => adapter.isAvailable())
      .map(adapter => ({ name: adapter.name, id: adapter.name.toLowerCase().replace(' ', '') }));
  }
}