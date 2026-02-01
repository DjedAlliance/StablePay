export class TokenSelector {
  constructor(networkSelector) {
    this.networkSelector = networkSelector;
    this.selectedToken = null;
  }

  selectToken(tokenKey) {
    const tokens = this.getAvailableTokens();
    const foundToken = tokens.find(t => t.key === tokenKey);

    if (foundToken) {
      this.selectedToken = foundToken;
      return true;
    }
    return false;
  }

  getSelectedToken() {
    return this.selectedToken;
  }

  getAvailableTokens() {
    const networkConfig = this.networkSelector.getSelectedNetworkConfig();
    if (!networkConfig || !networkConfig.stablecoins) return [];

    // Map the stablecoins array to the UI format
    return networkConfig.stablecoins.map(sc => ({
      key: sc.id,
      name: sc.name,
      symbol: sc.stableCoin.symbol,
      baseAsset: sc.baseAsset.symbol,
      isDirectTransfer: sc.stableCoin.isDirectTransfer,
      // Store full config for Transaction usage
      config: sc 
    }));
  }

  resetSelection() {
    this.selectedToken = null;
  }
}
