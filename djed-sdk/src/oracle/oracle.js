import { convertInt,web3Promise } from "../helpers";
import oracleArtifact from "../artifacts/OracleABI.json";
import hebeSwapOracleArtifact from "../artifacts/HebeSwapOracleABI.json";
import chainlinkOracleArtifact from "../artifacts/ChainlinkOracleABI.json";
import api3OracleArtifact from "../artifacts/API3OracleABI.json";

export const getOracleAddress = async (djedContract) => {
  return await web3Promise(djedContract, "oracle");
};

export const getOracleContract = (web3, oracleAddress, msgSender) => {
  const oracle = new web3.eth.Contract(oracleArtifact.abi, oracleAddress, {
    from: msgSender
  });
  return oracle;
};

export const getHebeSwapOracleContract = (web3, oracleAddress, msgSender) => {
  const oracle = new web3.eth.Contract(hebeSwapOracleArtifact.abi, oracleAddress, {
    from: msgSender
  });
  return oracle;
};

export const getChainlinkOracleContract = (web3, oracleAddress, msgSender) => {
  const oracle = new web3.eth.Contract(chainlinkOracleArtifact.abi, oracleAddress, {
    from: msgSender
  });
  return oracle;
};


export const getAPI3OracleContract = (web3, oracleAddress, msgSender) => {
  const oracle = new web3.eth.Contract(api3OracleArtifact.abi, oracleAddress, {
    from: msgSender
  });
  return oracle;
};
