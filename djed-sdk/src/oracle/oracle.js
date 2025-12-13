import { ethers } from "ethers";
import { convertInt, web3Promise } from "../helpers";
import oracleArtifact from "../artifacts/OracleABI.json";

export const getOracleAddress = async (djedContract) => {
  return await web3Promise(djedContract, "oracle");
};

export const getOracleContract = (provider, oracleAddress) => {
  const oracle = new ethers.Contract(
    oracleAddress,
    oracleArtifact.abi,
    provider
  );
  return oracle;
};
