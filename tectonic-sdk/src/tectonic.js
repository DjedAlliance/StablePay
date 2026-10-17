import { createPublicClient, http, encodeFunctionData } from "viem";
import { TECTONIC_ABI } from "./artifacts/TectonicABI.js";
import {
  D,
  SC_DECIMALS,
  GAS_LIMIT_MULTIPLIER_PERCENT,
  RESERVE_HEALTH,
} from "./constants.js";
import {
  requiredPaymentForStablecoins,
  stablecoinsForPayment,
  payoutForRedemption,
  toBaseUnits,
  fromBaseUnits,
} from "./pricing.js";

export { TECTONIC_ABI };

/**
 * Client for a single deployed Tectonic contract.
 *
 * Structural point worth internalising: **the Tectonic contract is itself the
 * stablecoin ERC-20.** There is no separate token contract to look up — the
 * protocol address and the token address are the same value. Only the equity
 * coin lives in its own contract.
 */
export class TectonicClient {
  /**
   * @param {object} options
   * @param {string} options.address deployed Tectonic contract address
   * @param {string} [options.rpcUrl] RPC endpoint; required unless publicClient is given
   * @param {object} [options.chain] viem chain object
   * @param {object} [options.publicClient] pre-built viem public client
   */
  constructor({ address, rpcUrl, chain, publicClient }) {
    if (!address) throw new Error("TectonicClient: contract address is required");
    if (!publicClient && !rpcUrl) {
      throw new Error("TectonicClient: either publicClient or rpcUrl is required");
    }

    this.address = address;
    this.chain = chain;
    this.publicClient =
      publicClient ?? createPublicClient({ chain, transport: http(rpcUrl) });

    /** @type {null | {fee: bigint, treasuryFee: bigint, decimals: number, criticalReserveRatio: bigint, safeReserveRatio: bigint, equityCoin: string, oracle: string, symbol: string}} */
    this.params = null;
  }

  /**
   * Read the immutable protocol parameters once and cache them.
   * Prices and ratios are deliberately NOT cached: they move every block.
   */
  async init() {
    const read = (functionName, args = []) =>
      this.publicClient.readContract({
        address: this.address,
        abi: TECTONIC_ABI,
        functionName,
        args,
      });

    try {
      const [fee, treasuryFee, decimals, criticalReserveRatio, safeReserveRatio, equityCoin, oracle, symbol] =
        await Promise.all([
          read("fee"),
          read("treasuryFee"),
          read("decimals"),
          read("criticalReserveRatio"),
          read("safeReserveRatio"),
          read("equityCoin"),
          read("oracle"),
          read("symbol"),
        ]);

      this.params = {
        fee: BigInt(fee),
        treasuryFee: BigInt(treasuryFee),
        decimals: Number(decimals),
        criticalReserveRatio: BigInt(criticalReserveRatio),
        safeReserveRatio: BigInt(safeReserveRatio),
        equityCoin,
        oracle,
        symbol,
      };
      return this.params;
    } catch (error) {
      throw new Error(
        `Failed to read Tectonic contract at ${this.address}.\n\n` +
          `Possible causes:\n` +
          `- The address is not a Tectonic contract\n` +
          `- The contract is not deployed on this chain\n` +
          `- The RPC endpoint is unreachable\n\n` +
          `Underlying error: ${error?.shortMessage || error?.message || error}`
      );
    }
  }

  /** @returns {{fee: bigint, treasuryFee: bigint}} */
  get fees() {
    this._requireInit();
    return { fee: this.params.fee, treasuryFee: this.params.treasuryFee };
  }

  _requireInit() {
    if (!this.params) {
      throw new Error("TectonicClient: call init() before using the client");
    }
  }

  _read(functionName, args = []) {
    return this.publicClient.readContract({
      address: this.address,
      abi: TECTONIC_ABI,
      functionName,
      args,
    });
  }

  // -------------------------------------------------------------------
  // Prices and state
  // -------------------------------------------------------------------

  /** Oracle target price: wei of basecoin per 1 whole stablecoin. */
  async scPriceMint() {
    return BigInt(await this._read("scPriceMint"));
  }

  /** Redemption price: min(target, reserve per stablecoin). */
  async scPriceRedeem() {
    return BigInt(await this._read("scPriceRedeem"));
  }

  /** Reserve, liabilities, equity and ratio, all in wei / D-scaled. */
  async getState() {
    const [reserve, liabilities, equity, ratio, totalSupply] = await Promise.all([
      this._read("R"),
      this._read("L"),
      this._read("E"),
      this._read("ratio"),
      this._read("totalSupply"),
    ]);
    return {
      reserve: BigInt(reserve),
      liabilities: BigInt(liabilities),
      equity: BigInt(equity),
      ratio: BigInt(ratio),
      totalSupply: BigInt(totalSupply),
    };
  }

  /**
   * Classify the protocol's reserve health so the widget can warn a merchant
   * that the stablecoins they are about to receive may accrue stability fees
   * or be subject to triggered redemption.
   *
   * @returns {Promise<{health: string, ratio: bigint, dailyStabilityFeeRate: bigint}>}
   */
  async getReserveHealth() {
    this._requireInit();
    const [ratioRaw, stabilityFeeRaw] = await Promise.all([
      this._read("ratio"),
      this._read("stabilityFee"),
    ]);
    const ratio = BigInt(ratioRaw);

    let health = RESERVE_HEALTH.HEALTHY;
    if (ratio < this.params.criticalReserveRatio) health = RESERVE_HEALTH.CRITICAL;
    else if (ratio <= this.params.safeReserveRatio) health = RESERVE_HEALTH.FEE_ACCRUING;

    return { health, ratio, dailyStabilityFeeRate: BigInt(stabilityFeeRaw) };
  }

  /**
   * Raw ERC-20 balance and the balance net of accrued stability fees.
   *
   * Always show the *effective* balance to merchants. Under Tectonic a raw
   * balanceOf overstates holdings whenever the reserve ratio is at or below the
   * safe threshold, because the accrued fee is burned on the next transfer.
   */
  async getBalance(account) {
    const [raw, effective] = await Promise.all([
      this._read("balanceOf", [account]),
      this._read("balanceOfAfterStabilityFee", [account]),
    ]);
    return { raw: BigInt(raw), effective: BigInt(effective) };
  }

  // -------------------------------------------------------------------
  // Quotes
  // -------------------------------------------------------------------

  /**
   * Quote the native-currency cost of minting a given stablecoin amount.
   *
   * @param {string|number|bigint} amountSC human amount ("10.5") or base units (bigint)
   * @returns {Promise<{amountSC: bigint, amountSCFormatted: string, requiredBC: bigint, requiredBCFormatted: string, scPriceMint: bigint}>}
   */
  async quoteMint(amountSC) {
    this._requireInit();
    const decimals = this.params.decimals ?? SC_DECIMALS;
    const amount = toBaseUnits(amountSC, decimals);
    const price = await this.scPriceMint();
    const requiredBC = requiredPaymentForStablecoins(amount, price, this.fees);

    return {
      amountSC: amount,
      amountSCFormatted: fromBaseUnits(amount, decimals, 6),
      requiredBC,
      requiredBCFormatted: fromBaseUnits(requiredBC, 18, 8),
      scPriceMint: price,
    };
  }

  /** Inverse quote: how many stablecoins a given payment mints. */
  async quotePayment(amountBC) {
    this._requireInit();
    const price = await this.scPriceMint();
    const value = typeof amountBC === "bigint" ? amountBC : toBaseUnits(amountBC, 18);
    const amountSC = stablecoinsForPayment(value, price, this.fees);
    return {
      amountBC: value,
      amountSC,
      amountSCFormatted: fromBaseUnits(amountSC, this.params.decimals ?? SC_DECIMALS, 6),
    };
  }

  /** Quote the payout for redeeming stablecoins back to native currency. */
  async quoteRedeem(amountSC) {
    this._requireInit();
    const decimals = this.params.decimals ?? SC_DECIMALS;
    const amount = toBaseUnits(amountSC, decimals);
    const price = await this.scPriceRedeem();
    const payoutBC = payoutForRedemption(amount, price, this.fees);
    return {
      amountSC: amount,
      payoutBC,
      payoutBCFormatted: fromBaseUnits(payoutBC, 18, 8),
      scPriceRedeem: price,
    };
  }

  // -------------------------------------------------------------------
  // Transaction builders
  // -------------------------------------------------------------------

  /**
   * Build the transaction for StablePay's native-payment flow: `payer` sends
   * basecoin, `receiver` (the merchant) is credited the stablecoins.
   *
   * Gas is estimated rather than hard-coded. When the reserve ratio is below
   * the critical threshold, mint() first runs up to 100 triggered redemptions,
   * and the true cost is only knowable at execution time — a fixed limit would
   * strand the transaction out of gas exactly when the protocol is stressed.
   *
   * @param {object} options
   * @param {string} options.payer address funding the transaction
   * @param {string} options.receiver address credited with the stablecoins
   * @param {bigint} options.value payment in wei (from quoteMint().requiredBC)
   * @returns {Promise<{to: string, from: string, value: bigint, data: string, gas?: bigint}>}
   */
  async buildMintTx({ payer, receiver, value }) {
    if (!payer) throw new Error("buildMintTx: payer is required");
    if (!receiver) throw new Error("buildMintTx: receiver is required");
    if (typeof value !== "bigint" || value <= 0n) {
      throw new Error("buildMintTx: value must be a positive bigint (wei)");
    }

    const data = encodeFunctionData({
      abi: TECTONIC_ABI,
      functionName: "mint",
      args: [receiver],
    });

    const tx = { to: this.address, from: payer, value, data };

    try {
      const estimate = await this.publicClient.estimateGas({
        account: payer,
        to: this.address,
        value,
        data,
      });
      tx.gas = (estimate * GAS_LIMIT_MULTIPLIER_PERCENT) / 100n;
    } catch (error) {
      // Estimation can fail for benign reasons (unfunded account in a preview,
      // node quirks). Surface the reason but let the wallet do its own
      // estimation rather than blocking the payment.
      console.warn(
        "[tectonic-sdk] gas estimation failed; falling back to wallet estimation:",
        error?.shortMessage || error?.message || error
      );
    }

    return tx;
  }

  /**
   * Build an ERC-20 transfer of the stablecoin itself (direct-payment flow).
   * Note the token address is this contract.
   */
  buildTransferTx({ from, to, amount }) {
    const data = encodeFunctionData({
      abi: TECTONIC_ABI,
      functionName: "transfer",
      args: [to, amount],
    });
    return { to: this.address, from, value: 0n, data };
  }

  /** Build a redeem transaction (stablecoins -> native currency). */
  buildRedeemTx({ from, receiver, amountSC }) {
    const data = encodeFunctionData({
      abi: TECTONIC_ABI,
      functionName: "redeem",
      args: [amountSC, receiver ?? from],
    });
    return { to: this.address, from, value: 0n, data };
  }
}

export { D, RESERVE_HEALTH };
