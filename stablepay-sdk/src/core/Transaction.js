import { createAdapter } from "./adapters/index.js";

/**
 * Transaction is the widget's single entry point to a stablecoin protocol.
 *
 * It used to talk to djed-sdk directly. It now delegates to a ProtocolAdapter
 * chosen from the network config, so the widget works against either Djed or
 * Tectonic without knowing which. The public method names are unchanged
 * (`init`, `getBlockchainDetails`, `handleTradeDataBuySc`, `buyStablecoins`)
 * so existing widget code and merchant integrations keep working.
 *
 * Construction accepts either shape:
 *   new Transaction(networkConfig)                  // preferred
 *   new Transaction(networkUri, protocolAddress)    // legacy, Djed-only
 */
export class Transaction {
  constructor(networkConfigOrUri, legacyDjedAddress) {
    if (typeof networkConfigOrUri === "string") {
      // Legacy two-argument form. It always meant Djed, so assume that.
      if (!networkConfigOrUri || !legacyDjedAddress) {
        throw new Error("Network URI and protocol address are required");
      }
      this.config = {
        uri: networkConfigOrUri,
        djedAddress: legacyDjedAddress,
        protocol: "djed",
      };
    } else {
      if (!networkConfigOrUri) throw new Error("Network configuration is required");
      this.config = networkConfigOrUri;
    }

    this.networkUri = this.config.uri;
    this.protocol = this.config.protocol ?? "djed";
    this.adapter = createAdapter(this.config);

    // Retained for backwards compatibility with callers that read this field.
    this.djedAddress = this.config.djedAddress;
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
      protocol: this.protocol,
      networkUri: this.networkUri,
      ...this.adapter.getDetails(),
    };
  }

  /**
   * How much native currency the consumer must send so that the merchant
   * receives `amountScaled` stablecoins.
   *
   * Returns a human-readable string, matching this method's previous
   * behaviour. Use `quoteNativePayment` when you need the exact wei value for
   * building a transaction — never re-parse the display string, which is
   * rounded for presentation.
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

  /** Stablecoin token address for the direct-transfer flow. */
  getStablecoinAddress() {
    return this.adapter.getStablecoinAddress();
  }

  getDecimals() {
    return this.adapter.getDecimals();
  }

  /** Protocol-specific merchant warnings; empty for Djed. */
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
