/**
 * Protocol adapter interface.
 *
 * StablePay supports more than one stablecoin protocol (Djed today, Tectonic
 * as it comes online). Rather than branching on protocol throughout the widget,
 * every protocol implements this small interface and the widget stays ignorant
 * of which one it is talking to.
 *
 * The contract each adapter must honour:
 *
 *   init()                  -> resolve contract handles; throw a human-readable
 *                              Error if the address is wrong or unreachable
 *   getStablecoinAddress()  -> ERC-20 address used for direct transfers
 *   getDecimals()           -> stablecoin decimals
 *   quoteNativePayment(amt) -> { requiredBC, requiredBCFormatted } for minting
 *                              `amt` stablecoins to the merchant
 *   buildMintTx({...})      -> unsigned tx crediting the merchant
 *   buildTransferTx({...})  -> unsigned ERC-20 transfer to the merchant
 *   getDetails()            -> diagnostic bag for the review screen
 *
 * Amounts crossing this boundary are bigint base units, never JS numbers:
 * a float cannot represent 18-decimal values exactly and an invoice must be.
 */
export class ProtocolAdapter {
  /** @param {object} config network config entry from utils/config.js */
  constructor(config) {
    if (new.target === ProtocolAdapter) {
      throw new Error("ProtocolAdapter is abstract; use a concrete adapter");
    }
    this.config = config;
  }

  /** @returns {Promise<void>} */
  async init() {
    throw new Error("init() not implemented");
  }

  /** @returns {string} */
  getStablecoinAddress() {
    throw new Error("getStablecoinAddress() not implemented");
  }

  /** @returns {number} */
  getDecimals() {
    throw new Error("getDecimals() not implemented");
  }

  /**
   * @param {string|number} amountSC human-readable stablecoin amount
   * @returns {Promise<{requiredBC: bigint, requiredBCFormatted: string}>}
   */
  async quoteNativePayment() {
    throw new Error("quoteNativePayment() not implemented");
  }

  /**
   * @param {{payer: string, receiver: string, value: bigint}} args
   * @returns {Promise<object>} unsigned transaction
   */
  async buildMintTx() {
    throw new Error("buildMintTx() not implemented");
  }

  /**
   * @param {{from: string, to: string, amount: bigint}} args
   * @returns {object} unsigned transaction
   */
  buildTransferTx() {
    throw new Error("buildTransferTx() not implemented");
  }

  /** @returns {object} diagnostics for display */
  getDetails() {
    return {};
  }

  /**
   * Protocol-specific warnings the merchant should see before accepting
   * payment (e.g. Tectonic stability fees). Empty by default.
   * @returns {Promise<Array<{level: 'info'|'warning', message: string}>>}
   */
  async getWarnings() {
    return [];
  }
}

export default ProtocolAdapter;
