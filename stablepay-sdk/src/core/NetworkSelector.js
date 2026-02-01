import { networksConfig } from "../utils/config";

export class NetworkSelector {
  constructor(merchantConfig) {
    this.merchantConfig = merchantConfig;
    this.blacklist = merchantConfig.getBlacklist();
    this.availableNetworks = this.getAvailableNetworks();
    this.selectedNetwork = null;
  }

  getAvailableNetworks() {
    return Object.entries(networksConfig).reduce(
      (acc, [networkKey, networkConfig]) => {
        if (!this.blacklist.includes(networkConfig.chainId)) {
          acc[networkKey] = networkConfig;
        }
        return acc;
      },
      {}
    );
  }

  selectNetwork(networkKey) {
    if (networkKey === null) {
      this.selectedNetwork = null;
      console.log("Network selection reset");
      return true;
    }
    if (this.availableNetworks[networkKey]) {
      this.selectedNetwork = networkKey;
      console.log(`Network selected: ${networkKey}`);
      return true;
    }
    console.error(`Invalid network: ${networkKey}`);
    return false;
  }

  getSelectedNetworkConfig() {
    return this.selectedNetwork
      ? this.availableNetworks[this.selectedNetwork]
      : null;
  }

  getReceivingAddress() {
    return this.merchantConfig.getReceivingAddress();
  }

  // Updated to accept a specific token ID
   getTokenAmount(network, tokenKey) {
    console.log("Getting amount for network:", network);
    console.log("Amounts object:", this.amounts);
   const amount = this.amounts[network]?.[tokenKey] ?? this.amounts[network]?.stablecoin;
    return amount || 0;
  }
}
