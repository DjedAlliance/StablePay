import { getWeb3, getDjedContract, getCoinContracts, getDecimals,getOracleAddress,getOracleContract,tradeDataPriceBuySc } from 'djed-sdk';

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
      const { stableCoin, reserveCoin } = await getCoinContracts(this.djedContract, this.web3);
      const { scDecimals, rcDecimals } = await getDecimals(stableCoin, reserveCoin);
      this.stableCoin = stableCoin;
      this.reserveCoin = reserveCoin;
      this.scDecimals = scDecimals;
      this.rcDecimals = rcDecimals;

      // Get the oracle contract
      this.oracleContract = await getOracleAddress(this.djedContract).then((addr) =>
        getOracleContract(this.web3, addr, this.djedContract._address)
      );

      this.oracleAddress = this.oracleContract._address;

      console.log('Transaction initialized successfully');
    } catch (error) {
      console.error('Error initializing transaction:', error);
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
}
