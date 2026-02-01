import djedArtifact from "../artifacts/DjedABI.json";
import djedIsisArtifact from "../artifacts/DjedIsisABI.json";
import djedTefnutArtifact from "../artifacts/DjedTefnutABI.json";
import coinArtifact from "../artifacts/CoinABI.json";
import { convertInt, web3Promise } from "../helpers";

//setting up djed
export const getDjedContract = (web3, DJED_ADDRESS) => {
  const djed = new web3.eth.Contract(djedArtifact.abi, DJED_ADDRESS);
  return djed;
};

export const getDjedIsisContract = (web3, DJED_ADDRESS) => {
  const djed = new web3.eth.Contract(djedIsisArtifact.abi, DJED_ADDRESS);
  return djed;
};

export const getDjedTefnutContract = (web3, DJED_ADDRESS) => {
  const djed = new web3.eth.Contract(djedTefnutArtifact.abi, DJED_ADDRESS);
  return djed;
};

export const getCoinContracts = async (djedContract, web3) => {
  const [stableCoinAddress, reserveCoinAddress] = await Promise.all([
    web3Promise(djedContract, "stableCoin"),
    web3Promise(djedContract, "reserveCoin"),
  ]);
  const stableCoin = new web3.eth.Contract(coinArtifact.abi, stableCoinAddress);
  const reserveCoin = new web3.eth.Contract(
    coinArtifact.abi,
    reserveCoinAddress
  );
  return { stableCoin, reserveCoin };
};
export const getDecimals = async (stableCoin, reserveCoin) => {
  const [scDecimals, rcDecimals] = await Promise.all([
    convertInt(web3Promise(stableCoin, "decimals")),
    convertInt(web3Promise(reserveCoin, "decimals")),
  ]);
  return { scDecimals, rcDecimals };
};

export const checkIfShu = async (djedContract) => {
  try {
    // Check if scMaxPrice exists on the contract
    await djedContract.methods.scMaxPrice(0).call();
    return true;
  } catch (e) {
    return false;
  }
};
