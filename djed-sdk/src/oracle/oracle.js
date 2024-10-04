import { convertInt,web3Promise } from "../helpers";
import oracleArtifact from "../artifacts/OracleABI.json";

export const getOracleAddress = async (djedContract) => {
  return await web3Promise(djedContract, "oracle");
};

export const getOracleContract = (web3, oracleAddress, msgSender) => {
  const oracle = new web3.eth.Contract(oracleArtifact.abi, oracleAddress, {
    from: msgSender
  });
  return oracle;
};
