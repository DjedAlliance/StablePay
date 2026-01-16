import { getWeb3, getDjedContract, getCoinContracts, getDecimals, getOracleAddress, getOracleContract, tradeDataPriceBuySc, buyScTx } from 'djed-sdk';

export class Transaction {
  constructor(networkUri, djedAddress) {
    this.networkUri = networkUri;
    this.djedAddress = djedAddress;
  }

  async init() {
    if (!this.networkUri || !this.djedAddress) {
      throw new Error('Network URI and DJED address are required');
    }

    try {
      this.web3 = await getWeb3(this.networkUri);
      this.djedContract = getDjedContract(this.web3, this.djedAddress);
      
      try {
      const { stableCoin, reserveCoin } = await getCoinContracts(this.djedContract, this.web3);
      const { scDecimals, rcDecimals } = await getDecimals(stableCoin, reserveCoin);
      this.stableCoin = stableCoin;
      this.reserveCoin = reserveCoin;
      this.scDecimals = scDecimals;
      this.rcDecimals = rcDecimals;

      this.oracleContract = await getOracleAddress(this.djedContract).then((addr) =>
        getOracleContract(this.web3, addr, this.djedContract._address)
      );

      this.oracleAddress = this.oracleContract._address;
      } catch (contractError) {
        console.error('[Transaction] Error fetching contract details:', contractError);
        if (contractError.message && contractError.message.includes('execution reverted')) {
          throw new Error(
            `Failed to interact with Djed contract at ${this.djedAddress} on Ethereum Classic.\n\n` +
            `Possible causes:\n` +
            `- The contract address may be incorrect\n` +
            `- The contract may not be deployed on Ethereum Classic mainnet\n` +
            `- The contract may not be a valid Djed contract\n\n` +
            `Please verify the contract address is correct for Ethereum Classic mainnet (Chain ID: 61).`
          );
        }
        throw contractError;
      }
    } catch (error) {
      console.error('[Transaction] Error initializing transaction:', error);
      if (error.message && (error.message.includes('CONNECTION ERROR') || error.message.includes('ERR_NAME_NOT_RESOLVED'))) {
        const networkName = this.networkUri.includes('milkomeda') ? 'Milkomeda' : 
                           this.networkUri.includes('mordor') ? 'Mordor' :
                           this.networkUri.includes('sepolia') ? 'Sepolia' : 'the selected network';
        throw new Error(
          `Failed to connect to ${networkName} RPC endpoint: ${this.networkUri}\n\n` +
          `Possible causes:\n` +
          `- The RPC endpoint may be temporarily unavailable\n` +
          `- DNS resolution issue (check your internet connection)\n` +
          `- Network firewall blocking the connection\n\n` +
          `Please try again in a few moments or check the network status.`
        );
      }
      throw error;
    }
  }

  getBlockchainDetails() {
    return {
      web3Available: !!this.web3,
      djedContractAvailable: !!this.djedContract,
      stableCoinAddress: this.stableCoin ? this.stableCoin._address : 'N/A',
      reserveCoinAddress: this.reserveCoin ? this.reserveCoin._address : 'N/A',
      stableCoinDecimals: this.scDecimals,
      reserveCoinDecimals: this.rcDecimals,
      oracleAddress: this.oracleAddress || 'N/A',
      oracleContractAvailable: !!this.oracleContract,
    };
  }

  async handleTradeDataBuySc(amountScaled) {
    if (!this.djedContract) {
      throw new Error("DJED contract is not initialized");
    }
    if (typeof amountScaled !== 'string') {
      throw new Error("Amount must be a string");
    }
    try {
      const result = await tradeDataPriceBuySc(this.djedContract, this.scDecimals, amountScaled);
      return result.totalBCScaled;
    } catch (error) {
      console.error("Error fetching trade data for buying stablecoins: ", error);
      throw error;
    }
  }

  async buyStablecoins(payer, receiver, value) {
    if (!this.djedContract) {
      throw new Error("DJED contract is not initialized");
    }
    try {
      const UI = '0x0232556C83791b8291E9b23BfEa7d67405Bd9839';

      const txData = await buyScTx(this.djedContract, payer, receiver, value, UI, this.djedAddress);

      return txData;
    } catch (error) {
      console.error("Error executing buyStablecoins transaction: ", error);
      throw error;
    }
  }
}
