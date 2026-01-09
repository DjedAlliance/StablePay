export class Wallet {
  constructor(chainId) {
    this.chainId = chainId;
    this.client = null;
    this.account = null;
  }

  async connect() {
    if (!window.ethereum) {
      throw new Error('No Ethereum provider found');
    }

    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });

    const client = createWalletClient({
      chain: this.getChainConfig(this.chainId),
      transport: custom(window.ethereum)
    });

    this.client = client;
    this.account = accounts[0];

    return {
      client: this.client,
      account: this.account
    };
  }

  getChainConfig(chainId) {
    const chains = {
      1: mainnet,
      11155111: sepolia,
      // Add other chains as needed
    };
    return chains[chainId];
  }

  async disconnect() {
    this.client = null;
    this.account = null;
  }

  getClient() {
    return this.client;
  }

  getAccount() {
    return this.account;
  }
}