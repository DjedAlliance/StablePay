import { TectonicAdapter } from "./adapters/TectonicAdapter.js";

/**
 * Transaction is the widget's entry point to the Tectonic stablecoin protocol.
 *
 * Tectonic is the only supported protocol, so this constructs the Tectonic
 * adapter directly. The adapter is kept as a separate class because it
 * isolates every chain interaction behind a small surface, which keeps this
 * file about orchestration rather than RPC detail.
 */
export class Transaction {
  /**
   * @param {object} networkConfig entry from utils/config.js. Must carry a
   *   `tectonicAddress` and an `uri`.
   */
  constructor(networkConfig) {
    if (!networkConfig) throw new Error("Network configuration is required");
    if (typeof networkConfig === "string") {
      // An older form took (uri, protocolAddress). It has been removed: the
      // network config carries both, plus the token metadata the widget needs.
      throw new Error(
        "Transaction: pass the whole network config object, not a URI string. " +
          "The (uri, address) form has been removed."
      );
    }

    this.config = networkConfig;
    this.networkUri = networkConfig.uri;
    this.adapter = new TectonicAdapter(networkConfig);
  }

  async init() {
    try {
      await this.adapter.init();
    } catch (error) {
      throw this._decorateConnectionError(error);
    }
  }

  /** Diagnostics shown on the transaction review screen. */
  getBlockchainDetails() {
    return {
      networkUri: this.networkUri,
      ...this.adapter.getDetails(),
    };
  }

  /**
   * How much native currency the consumer must send so that the merchant
   * receives `amountScaled` stablecoins.
   *
   * Returns a human-readable string for display. Use `quoteNativePayment` when
   * you need the exact wei value for building a transaction — never re-parse
   * the display string, which is rounded for presentation.
   *
   * @param {string} amountScaled human-readable stablecoin amount
   * @returns {Promise<string>}
   */
  async handleTradeDataBuySc(amountScaled) {
    const quote = await this.quoteNativePayment(amountScaled);
    return quote.requiredBCFormatted;
  }

  /**
   * Exact quote. Prefer this for anything other than display: `requiredBC` is
   * a bigint in wei and is exactly what must be sent.
   * @param {string|number} amountScaled
   */
  async quoteNativePayment(amountScaled) {
    if (amountScaled === undefined || amountScaled === null || amountScaled === "") {
      throw new Error("Amount is required");
    }
    this._lastQuote = await this.adapter.quoteNativePayment(String(amountScaled));
    return this._lastQuote;
  }

  /**
   * Build the native-payment transaction: `payer` funds it, `receiver` (the
   * merchant) is credited with stablecoins.
   *
   * @param {string} payer
   * @param {string} receiver
   * @param {bigint} value payment in wei, from quoteNativePayment().requiredBC
   */
  async buyStablecoins(payer, receiver, value) {
    if (typeof value !== "bigint") {
      throw new Error(
        "buyStablecoins: `value` must be a bigint in wei. " +
          "Use quoteNativePayment().requiredBC rather than parsing a display string."
      );
    }
    return this.adapter.buildMintTx({ payer, receiver, value });
  }

  /** Build a direct ERC-20 stablecoin transfer to the merchant. */
  buildTransferTx({ from, to, amount }) {
    return this.adapter.buildTransferTx({ from, to, amount });
  }

  /**
   * Stablecoin token address for the direct-transfer flow. Under Tectonic this
   * is the protocol contract itself — there is no separate token contract.
   */
  getStablecoinAddress() {
    return this.adapter.getStablecoinAddress();
  }

  getDecimals() {
    return this.adapter.getDecimals();
  }

  /**
   * Merchant-facing warnings specific to Tectonic: stability fees shrink a
   * held balance, and triggered redemptions can convert a merchant's
   * stablecoins to native currency without the merchant acting.
   */
  async getWarnings() {
    try {
      return await this.adapter.getWarnings();
    } catch {
      return [];
    }
  }

  _decorateConnectionError(error) {
    const isConnectionError =
      error.code === -32603 ||
      error.code === 4001 ||
      error.code === -32005 ||
      (error.message &&
        (error.message.includes("CONNECTION ERROR") ||
          error.message.includes("ERR_NAME_NOT_RESOLVED")));

    if (!isConnectionError) return error;

    return new Error(
      `Failed to connect to the RPC endpoint: ${this.networkUri}\n\n` +
        `Possible causes:\n` +
        `- The RPC endpoint may be temporarily unavailable\n` +
        `- DNS resolution issue (check your internet connection)\n` +
        `- Network firewall blocking the connection\n\n` +
        `Please try again in a few moments or check the network status.`
    );
  }
}

export default Transaction;
