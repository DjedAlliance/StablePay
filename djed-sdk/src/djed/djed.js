import { ethers } from "ethers";
import djedArtifact from "../artifacts/DjedABI.json";
import coinArtifact from "../artifacts/CoinABI.json";
import { convertInt, web3Promise } from "../helpers";

// Create ethers contract instance for read-only operations
export const getDjedContract = (provider, DJED_ADDRESS) => {
  const djed = new ethers.Contract(DJED_ADDRESS, djedArtifact.abi, provider);
  return djed;
};

export const getCoinContracts = async (djedContract, provider) => {
  const [stableCoinAddress, reserveCoinAddress] = await Promise.all([
    web3Promise(djedContract, "stableCoin"),
    web3Promise(djedContract, "reserveCoin"),
  ]);
  const stableCoin = new ethers.Contract(
    stableCoinAddress,
    coinArtifact.abi,
    provider
  );
  const reserveCoin = new ethers.Contract(
    reserveCoinAddress,
    coinArtifact.abi,
    provider
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
