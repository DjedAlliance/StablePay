import { TectonicClient, RESERVE_HEALTH, fromBaseUnits } from "tectonic-sdk";
import { ProtocolAdapter } from "./ProtocolAdapter.js";

/**
 * Tectonic implementation of the protocol adapter.
 *
 * Two things differ structurally from the Djed adapter and are worth stating
 * plainly, because they are the source of most porting mistakes:
 *
 *  1. The Tectonic contract IS the stablecoin ERC-20. There is no separate
 *     token address to look up; `tectonicAddress` serves as both.
 *  2. Fees and ratios are scaled by 1e18, not Djed's 1e24.
 */
export class TectonicAdapter extends ProtocolAdapter {
  constructor(config) {
    super(config);
    this.address = config.tectonicAddress;
    if (!this.address) {
      throw new Error(
        "TectonicAdapter: network config is missing `tectonicAddress`. " +
          "Check utils/config.js for this network."
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
      protocol: "tectonic",
      protocolAddress: this.address,
      stableCoinAddress: this.address,
      equityCoinAddress: this.params?.equityCoin ?? "N/A",
      stableCoinDecimals: this.getDecimals(),
      oracleAddress: this.params?.oracle ?? "N/A",
      symbol: this.params?.symbol ?? "SC",
    };
  }

  /**
   * Tectonic has two behaviours with no Djed equivalent that materially affect
   * a merchant accepting payment. Surfacing them is a correctness requirement,
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
