import Web3 from "web3";
import djedArtifact from "./artifacts/DjedABI.json";
import coinArtifact from "./artifacts/CoinABI.json";
import oracleArtifact from "./artifacts/OracleABI.json";
import { convertInt,web3Promise } from "./helpers";

 const getWeb3 = (BLOCKCHAIN_URI) =>
  new Promise(async (resolve, reject) => {
    if (window.ethereum) {
      try {
        const web3 = new Web3(BLOCKCHAIN_URI);
        resolve(web3);
      } catch (error) {
        reject(error);
      }
    } else {
      reject("Install Metamask");
    }
  });

  const getOracleContract = (web3, oracleAddress, msgSender) => {
    const oracle = new web3.eth.Contract(oracleArtifact.abi, oracleAddress, {
      from: msgSender
    });
    return oracle;
  };

export const DjedInstance = async (BLOCKCHAIN_URI, DJED_ADDRESS,msgSender) => {
  try {
    
    const web3 = await getWeb3(BLOCKCHAIN_URI);


    
    const djedContract = new web3.eth.Contract(djedArtifact.abi, DJED_ADDRESS);

    
    const [oracleAddress, stableCoinAddress, reserveCoinAddress] = await Promise.all([
      djedContract.methods.oracle().call(), // Fetch the Oracle address
      djedContract.methods.stableCoin().call(), // Fetch the StableCoin address
      djedContract.methods.reserveCoin().call() // Fetch the ReserveCoin address
    ]);

   
    const stableCoin = new web3.eth.Contract(coinArtifact.abi, stableCoinAddress);
    const reserveCoin = new web3.eth.Contract(coinArtifact.abi, reserveCoinAddress);
    const oracleContract = getOracleContract(web3, oracleAddress, msgSender);
    
    const [scDecimals, rcDecimals] = await Promise.all([
      convertInt(web3Promise(stableCoin, "decimals")),
      convertInt(web3Promise(reserveCoin, "decimals"))
    ]);

    
    return {
      web3, 
      djedContract, 
      oracleAddress,
      oracleContract, 
      stableCoin, 
      reserveCoin, 
      scDecimals, 
      rcDecimals 
    };
  } catch (error) {
    // If any error occurs during the process, throw an error with a descriptive message.
    throw new Error(`Initialization failed: ${error.message}`);
  }
};
