import { networksConfig } from "../utils/config";

export class MerchantConfig {
  constructor(options = {}) {
    this.receivingAddress = options.receivingAddress || "";
    this.blacklist = options.blacklist || [];
    this.amounts = options.Amounts || {}; // Note the capital 'A' in Amounts
    this.validateConfig();
  }

  validateConfig() {
    if (!this.receivingAddress) {
      throw new Error("Receiving address is required");
    }
    // Validate stablecoin amounts
    for (const [network, tokens] of Object.entries(this.amounts)) {
      if (!networksConfig[network]) {
        throw new Error(`Invalid network: ${network}`);
      }
      if (
        !tokens.stablecoin ||
        typeof tokens.stablecoin !== "number" ||
        tokens.stablecoin <= 0
      ) {
        throw new Error(`Invalid stablecoin amount for network ${network}`);
      }
    }
  }

  getBlacklist() {
    return this.blacklist;
  }

  getReceivingAddress() {
    return this.receivingAddress;
  }

  // getTokenAmount(network, token) {
  //   const networkConfig = networksConfig[network];
  //   if (!networkConfig) return 0;

  //   const stablecoinSymbol = networkConfig.tokens.stablecoin.symbol;

  //   if (token === 'stablecoin') {
  //     return this.amounts[network]?.stablecoin || 0;
  //   }
  //   // For native tokens, return 0 as it's not specified in the new structure
  //   return 0;
  // }
  getTokenAmount(network) {
    console.log("Getting amount for network:", network);
    console.log("Amounts object:", this.amounts);

    // Directly return the stablecoin amount for the network
    const amount = this.amounts[network]?.stablecoin;
    console.log("Returning amount:", amount);

    return amount || 0;
  }
}

export default MerchantConfig;
