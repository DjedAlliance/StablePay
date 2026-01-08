import { getWeb3, getDjedContract, getCoinContracts, getDecimals, getOracleAddress, getOracleContract, tradeDataPriceBuySc, buyScTx } from 'djed-sdk';
import { Gluon } from '../../../gluon-sdk/src/gluon';
import GluonABI from '../../../gluon-sdk/artifacts/GluonABI.json';
import GluonRouterABI from '../../../gluon-sdk/artifacts/GluonRouterABI.json';

export class Transaction {
  constructor(networkUri, djedAddress, protocol = 'djed', routerAddress = null) {
    this.networkUri = networkUri;
    this.djedAddress = djedAddress;
    this.protocol = protocol;
    this.routerAddress = routerAddress;
  }

  async init() {
    if (!this.networkUri || !this.djedAddress) {
      throw new Error('Network URI and DJED address are required');
    }

    try {
      this.web3 = await getWeb3(this.networkUri);

      if (this.protocol === 'gluon') {
        this.gluon = new Gluon(this.web3, this.djedAddress, GluonABI, this.routerAddress, GluonRouterABI);
        this.djedContract = this.gluon.contract;
        
        const { proton, neutron } = await this.gluon.getCoinContracts();
        const { protonDecimals, neutronDecimals } = await this.gluon.getDecimals(proton, neutron);
        
        // Neutron is Stable, Proton is Reserve/Volatile
        this.stableCoin = neutron;
        this.reserveCoin = proton;
        this.scDecimals = neutronDecimals;
        this.rcDecimals = protonDecimals;
        
        this.oracleAddress = 'N/A'; 
        this.oracleContract = null;
      } else {
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
      }

      console.log('Transaction initialized successfully');
    } catch (error) {
      console.error('Error initializing transaction:', error);
      throw error;
    }
  }

  getBlockchainDetails() {
    return {
      protocol: this.protocol,
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

    if (this.protocol === 'gluon') {
      const reserve = await this.gluon.contract.methods.reserve().call();
      const neutronSupply = await this.stableCoin.methods.totalSupply().call(); 
      const fissionFee = await this.gluon.contract.methods.FISSION_FEE().call();
      
      const input = this.gluon.calculateRequiredInputForNeutrons(amountScaled, reserve, neutronSupply, fissionFee);
      return input.toString();
    }

    try {
      const result = await tradeDataPriceBuySc(this.djedContract, this.scDecimals, amountScaled);
      return result.totalBCScaled; //converted ETH equivalent
    } catch (error) {
      console.error("Error fetching trade data for buying stablecoins: ", error);
      throw error;
    }
  }

  // use buyScTx directly
  async buyStablecoins(payer, receiver, value) {
    if (!this.djedContract) {
      throw new Error("DJED contract is not initialized");
    }
    try {
      console.log(`Building stablecoin purchase transaction from ${payer} to ${receiver} with value ${value}`);

      if (this.protocol === 'gluon') {
        const txData = await this.gluon.fission(payer, value, receiver);
        console.log("Transaction built:", txData);
        return txData;
      }

      //Hardcoded UI address
      const UI = '0x0232556C83791b8291E9b23BfEa7d67405Bd9839';

      //buyScTx from djed-sdk
      const txData = await buyScTx(this.djedContract, payer, receiver, value, UI, this.djedAddress);

      console.log("Transaction built:", txData);
      return txData;
    } catch (error) {
      console.error("Error executing buyStablecoins transaction: ", error);
      throw error;
    }
  }
}
