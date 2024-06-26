import Web3 from "web3";
import djedArtifact from "./artifacts/DjedABI.json";
import coinArtifact from "./artifacts/CoinABI.json";

// Modify getWeb3 to accept BLOCKCHAIN_URI as a parameter
export const getWeb3 = (BLOCKCHAIN_URI) => {
  return new Promise((resolve, reject) => {
    try {
      const web3 = new Web3(BLOCKCHAIN_URI);
      resolve(web3);
    } catch (error) {
      reject(error);
    }
  });
};

// Modify getDjedContract to accept DJED_ADDRESS as a parameter
export const getDjedContract = (web3, DJED_ADDRESS) => {
  return new web3.eth.Contract(djedArtifact.abi, DJED_ADDRESS);
};

export const getOracleAddress = async (djedContract) => {
  return await djedContract.methods.oracle().call();
};

export const getCoinContracts = async (djedContract, web3) => {
  const [stableCoinAddress, reserveCoinAddress] = await Promise.all([
    djedContract.methods.stableCoin().call(),
    djedContract.methods.reserveCoin().call()
  ]);
  const stableCoin = new web3.eth.Contract(coinArtifact.abi, stableCoinAddress);
  const reserveCoin = new web3.eth.Contract(coinArtifact.abi, reserveCoinAddress);
  return { stableCoin, reserveCoin };
};
