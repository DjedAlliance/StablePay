// import { convertInt,web3Promise } from "../helpers";
// import oracleArtifact from "../artifacts/OracleABI.json";

// export const getOracleAddress = async (djedContract) => {
//   return await web3Promise(djedContract, "oracle");
// };

// export const getOracleContract = (web3, oracleAddress, msgSender) => {
//   const oracle = new web3.eth.Contract(oracleArtifact.abi, oracleAddress, {
//     from: msgSender
//   });
//   return oracle;
// };
import { ethers } from "ethers";
import oracleArtifact from "../artifacts/OracleABI.json";

export const getOracleAddress = async (djedContract) => {
  return await djedContract.oracle(); // Direct Ethers.js contract call
};

export const getOracleContract = (providerOrSigner, oracleAddress) => {
  return new ethers.Contract(oracleAddress, oracleArtifact.abi, providerOrSigner);
};
