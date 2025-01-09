// TokenSelector.js

export class TokenSelector {
  constructor(networkSelector) {
    this.networkSelector = networkSelector;
    this.selectedToken = null;
  }

  selectToken(tokenKey) {
    const networkConfig = this.networkSelector.getSelectedNetworkConfig();
    if (networkConfig && networkConfig.tokens[tokenKey]) {
      this.selectedToken = {
        key: tokenKey,
        ...networkConfig.tokens[tokenKey]
      };
      return true;
    }
    return false;
  }

  getSelectedToken() {
    return this.selectedToken;
  }

  getAvailableTokens() {
    const networkConfig = this.networkSelector.getSelectedNetworkConfig();
    if (!networkConfig) return [];

    return Object.entries(networkConfig.tokens).map(([key, config]) => ({
      key,
      ...config
    }));
  }

  resetSelection() {
    this.selectedToken = null;
  }
}