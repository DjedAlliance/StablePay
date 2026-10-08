import {
  getWeb3,
  getDjedContract,
  getCoinContracts,
  getDecimals,
  getOracleAddress,
  getOracleContract,
  tradeDataPriceBuySc,
  buyScTx,
} from "djed-sdk";
import { formatEther, encodeFunctionData } from "viem";
import { ProtocolAdapter } from "./ProtocolAdapter.js";

/**
 * Fraction digits shown for a basecoin quote. Matches TectonicClient.quoteMint
 * (requiredBCFormatted, 8 decimals) so both adapters render the same way.
 * Display only: the amount sent is always the exact bigint.
 */
const QUOTE_DISPLAY_DECIMALS = 8;

/** Truncate a wei amount to a display string with QUOTE_DISPLAY_DECIMALS. */
function formatQuote(wei) {
  const [whole, fraction = ""] = formatEther(wei).split(".");
  const shown = fraction.slice(0, QUOTE_DISPLAY_DECIMALS).replace(/0+$/, "");
  return shown ? `${whole}.${shown}` : whole;
}

/**
 * Djed implementation of the protocol adapter.
 *
 * This wraps the pre-existing djed-sdk behaviour unchanged so that live Djed
 * deployments keep working while Tectonic is still local-only. When Tectonic
 * ships and the Djed networks are retired, delete this file, the djed-sdk
 * dependency, and the `protocol: "djed"` entries in utils/config.js.
 */
export class DjedAdapter extends ProtocolAdapter {
  constructor(config) {
    super(config);
    this.address = config.djedAddress;
    if (!this.address) {
      throw new Error("DjedAdapter: network config is missing `djedAddress`");
    }
  }

  async init() {
    this.web3 = await getWeb3(this.config.uri);
    this.djedContract = getDjedContract(this.web3, this.address);

    try {
      const { stableCoin, reserveCoin } = await getCoinContracts(this.djedContract, this.web3);
      const { scDecimals, rcDecimals } = await getDecimals(stableCoin, reserveCoin);
      this.stableCoin = stableCoin;
      this.reserveCoin = reserveCoin;
      this.scDecimals = scDecimals;
      this.rcDecimals = rcDecimals;

      const oracleAddress = await getOracleAddress(this.djedContract);
      this.oracleContract = getOracleContract(this.web3, oracleAddress, this.djedContract._address);
      this.oracleAddress = this.oracleContract._address;
    } catch (error) {
      throw new Error(
        `Failed to interact with Djed contract at ${this.address}.\n\n` +
          `Possible causes:\n` +
          `- The contract address may be incorrect\n` +
          `- The contract may not be deployed on this network\n` +
          `- The contract may not be a valid Djed contract\n\n` +
          `Underlying error: ${error?.shortMessage || error?.message || error}`
      );
    }
  }

  getStablecoinAddress() {
    // Djed deploys the stablecoin as a separate contract. Prefer the address
    // discovered on chain; fall back to config for offline rendering.
    return this.stableCoin?._address ?? this.config.tokens?.stablecoin?.address;
  }

  getDecimals() {
    return this.scDecimals ?? this.config.tokens?.stablecoin?.decimals ?? 18;
  }

  async quoteNativePayment(amountSC) {
    const trade = await tradeDataPriceBuySc(this.djedContract, this.scDecimals, String(amountSC));
    const totalBCUnscaled = trade?.totalBCUnscaled;

    if (totalBCUnscaled === undefined || totalBCUnscaled === null) {
      throw new Error("DjedAdapter: failed to compute the required payment amount");
    }

    // Build the amount to send from the exact wei figure. totalBCScaled is a
    // display string that djed-sdk's decimalScaling truncates to six
    // decimals; parsing it back with parseEther discards up to 1e12 wei and
    // underpays the mint, so the merchant is credited short.
    const requiredBC = BigInt(totalBCUnscaled);

    return {
      requiredBC,
      requiredBCFormatted: formatQuote(requiredBC),
    };
  }

  async buildMintTx({ payer, receiver, value }) {
    // The UI fee beneficiary is a Djed-only concept; Tectonic has no equivalent.
    const UI = this.config.uiFeeAddress ?? "0x0232556C83791b8291E9b23BfEa7d67405Bd9839";
    const tx = await buyScTx(this.djedContract, payer, receiver, value, UI, this.address);
    return { ...tx, value, account: payer };
  }

  buildTransferTx({ from, to, amount }) {
    const data = encodeFunctionData({
      abi: [
        {
          inputs: [
            { internalType: "address", name: "to", type: "address" },
            { internalType: "uint256", name: "amount", type: "uint256" },
          ],
          name: "transfer",
          outputs: [{ internalType: "bool", name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      functionName: "transfer",
      args: [to, amount],
    });
    return { to: this.getStablecoinAddress(), from, value: 0n, data, account: from };
  }

  getDetails() {
    return {
      protocol: "djed",
      protocolAddress: this.address,
      stableCoinAddress: this.getStablecoinAddress() ?? "N/A",
      reserveCoinAddress: this.reserveCoin?._address ?? "N/A",
      stableCoinDecimals: this.scDecimals,
      reserveCoinDecimals: this.rcDecimals,
      oracleAddress: this.oracleAddress ?? "N/A",
    };
  }
}

export default DjedAdapter;
