import { TectonicClient, RESERVE_HEALTH, fromBaseUnits } from "tectonic-sdk";

/**
 * Every chain interaction StablePay performs, in one place.
 *
 * Two structural points, because they are where assumptions carried over from
 * other stablecoin protocols tend to break:
 *
 *  1. The Tectonic contract IS the stablecoin ERC-20. There is no separate
 *     token address to look up; `tectonicAddress` serves as both.
 *  2. Fees and reserve ratios are scaled by 1e18 (the contract's `D`).
 *
 * Amounts crossing this boundary are bigint base units, never JS numbers: a
 * float cannot represent 18-decimal values exactly, and an invoice must be.
 */
export class TectonicAdapter {
  /** @param {object} config network config entry from utils/config.js */
  constructor(config) {
    if (!config) throw new Error("TectonicAdapter: network config is required");
    this.config = config;
    this.address = config.tectonicAddress;

    // The zero address is rejected explicitly, not just falsy values. It is a
    // common placeholder and it is truthy in JavaScript, so without this check
    // it produces an opaque RPC decode error deep in init() rather than a
    // message naming the actual problem.
    const ZERO = "0x0000000000000000000000000000000000000000";
    if (!this.address || this.address.toLowerCase() === ZERO) {
      throw new Error(
        "TectonicAdapter: network config has no usable `tectonicAddress`" +
          (this.address ? " (it is the zero address)" : "") +
          ". For the local development chain, call " +
          "StablePay.useLocalTectonic('0x...') with the address printed by " +
          "tectonic-local/script/DeployLocal.s.sol."
      );
    }
    this.client = new TectonicClient({
      address: this.address,
      rpcUrl: config.uri,
    });
  }

  async init() {
    this.params = await this.client.init();
    return this.params;
  }

  /** The protocol contract doubles as the stablecoin token. */
  getStablecoinAddress() {
    return this.address;
  }

  getDecimals() {
    return this.params?.decimals ?? 18;
  }

  async quoteNativePayment(amountSC) {
    const quote = await this.client.quoteMint(amountSC);
    return {
      requiredBC: quote.requiredBC,
      requiredBCFormatted: quote.requiredBCFormatted,
      scPrice: quote.scPriceMint,
    };
  }

  async buildMintTx({ payer, receiver, value }) {
    return this.client.buildMintTx({ payer, receiver, value });
  }

  buildTransferTx({ from, to, amount }) {
    return this.client.buildTransferTx({ from, to, amount });
  }

  getDetails() {
    return {
      protocolAddress: this.address,
      stableCoinAddress: this.address,
      equityCoinAddress: this.params?.equityCoin ?? "N/A",
      stableCoinDecimals: this.getDecimals(),
      oracleAddress: this.params?.oracle ?? "N/A",
      symbol: this.params?.symbol ?? "SC",
    };
  }

  /**
   * Two Tectonic behaviours materially affect a merchant accepting payment,
   * and neither is common to stablecoins generally. Surfacing them is a
   * correctness requirement,
   * not a nicety: a merchant who does not know about triggered redemptions may
   * find their stablecoin position converted to native currency without having
   * initiated anything.
   */
  async getWarnings() {
    let health;
    try {
      health = await this.client.getReserveHealth();
    } catch {
      return []; // never block a payment because a diagnostic read failed
    }

    if (health.health === RESERVE_HEALTH.CRITICAL) {
      return [
        {
          level: "warning",
          message:
            "This stablecoin's reserve ratio is below its critical threshold. " +
            "The protocol may automatically redeem stablecoin balances for native " +
            "currency, including balances received from this payment.",
        },
      ];
    }

    if (health.health === RESERVE_HEALTH.FEE_ACCRUING) {
      const dailyPercent = (Number(health.dailyStabilityFeeRate) / 1e18) * 100;
      return [
        {
          level: "info",
          message:
            `This stablecoin currently charges a stability fee of about ` +
            `${dailyPercent.toFixed(4)}% per day while its reserve ratio stays low. ` +
            `Balances shrink over time until reserves recover.`,
        },
      ];
    }

    return [];
  }

  /** Merchant-facing effective balance, net of accrued stability fees. */
  async getEffectiveBalance(account) {
    const { raw, effective } = await this.client.getBalance(account);
    return {
      raw,
      effective,
      formatted: fromBaseUnits(effective, this.getDecimals(), 6),
    };
  }
}

export default TectonicAdapter;
