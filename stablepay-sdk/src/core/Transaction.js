import { 
  getWeb3, 
  getDjedContract, 
  getCoinContracts, 
  getDecimals, 
  getOracleAddress, 
  getOracleContract, 
  tradeDataPriceBuySc, 
  buyScTx, 
  buyScIsisTx, 
  checkAllowance, 
  approveTx 
} from 'djed-sdk';
import coinArtifact from 'djed-sdk/src/artifacts/CoinABI.json'; 

export class Transaction {
  /**
   * @param {string} networkUri
   * @param {object} stablecoinConfig - The specific config object for the selected stablecoin
   */
  constructor(networkUri, stablecoinConfig) {
    this.networkUri = networkUri;
    this.config = stablecoinConfig;
    this.djedAddress = stablecoinConfig.contractAddress;
    this.baseAsset = stablecoinConfig.baseAsset;
  }

  async init() {
    if (!this.networkUri || !this.djedAddress) {
      throw new Error('Network URI and DJED address are required');
    }

    try {
      this.web3 = await getWeb3(this.networkUri);
      this.djedContract = getDjedContract(this.web3, this.djedAddress);

      // Initialize Base Asset contract if it is ERC20
      if (!this.baseAsset.isNative && this.baseAsset.address) {
        this.baseAssetContract = new this.web3.eth.Contract(coinArtifact.abi, this.baseAsset.address);
      }
      
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
        throw contractError;
      }
    } catch (error) {
      console.error('[Transaction] Error initializing transaction:', error);
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
      baseAssetSymbol: this.baseAsset.symbol,
      baseAssetIsNative: this.baseAsset.isNative,
      baseAssetDecimals: this.baseAsset.decimals
    };
  }

  async handleTradeDataBuySc(amountScaled) {
    if (!this.djedContract) throw new Error("DJED contract is not initialized");
    try {
      const result = await tradeDataPriceBuySc(this.djedContract, this.scDecimals, amountScaled);
      return result.totalBCScaled;
    } catch (error) {
      console.error("Error fetching trade data for buying stablecoins: ", error);
      throw error;
    }
  }

  async buyStablecoins(payer, receiver, value) {
    if (!this.djedContract) throw new Error("DJED contract is not initialized");
    
    try {
      const UI = '0x0232556C83791b8291E9b23BfEa7d67405Bd9839';

      if (!this.baseAsset.isNative) {
        // Use Isis transaction builder for ERC20
        if (!this.baseAssetContract) throw new Error("Base Asset contract not initialized for ERC20 flow");
        return buyScIsisTx(this.djedContract, payer, receiver, value, UI, this.djedAddress);
      } else {
        // Use Standard transaction builder for Native
        return buyScTx(this.djedContract, payer, receiver, value, UI, this.djedAddress);
      }
    } catch (error) {
      console.error("Error executing buyStablecoins transaction: ", error);
      throw error;
    }
  }

  async approveBaseAsset(payer, amount) {
    if (this.baseAsset.isNative) throw new Error("Cannot approve native asset");
    if (!this.baseAssetContract) throw new Error("No Base Asset contract to approve");
    
    return approveTx(this.baseAssetContract, payer, this.djedAddress, amount);
  }

  async checkBaseAssetAllowance(owner, amount) {
     if (this.baseAsset.isNative) return true;
     if (!this.baseAssetContract) return false;
     
     const allowance = await checkAllowance(this.baseAssetContract, owner, this.djedAddress);
     return BigInt(allowance) >= BigInt(amount);
  }
}
