import {ethers} from 'ethers';
import djedArtifact from "../artifacts/DjedABI.json";
import coinArtifact from "../artifacts/CoinABI.json";
import { convertInt } from "../helpers";

//setting up djed
// export const getDjedContract = (web3, DJED_ADDRESS) => {
//   const djed = new web3.eth.Contract(djedArtifact.abi, DJED_ADDRESS);
//   return djed;
// };
export const getDjedContract = (providerOrSigner, DJED_ADDRESS) => {
  return new ethers.Contract(DJED_ADDRESS, djedArtifact.abi, providerOrSigner);
};

// export const getCoinContracts = async (djedContract, web3) => {
//   const [stableCoinAddress, reserveCoinAddress] = await Promise.all([
//     web3Promise(djedContract, "stableCoin"),
//     web3Promise(djedContract, "reserveCoin"),
//   ]);
//   const stableCoin = new web3.eth.Contract(coinArtifact.abi, stableCoinAddress);
//   const reserveCoin = new web3.eth.Contract(
//     coinArtifact.abi,
//     reserveCoinAddress
//   );
//   return { stableCoin, reserveCoin };
// };

export const getCoinContracts = async (djedContract, providerOrSigner) => {
  const [stableCoinAddress, reserveCoinAddress] = await Promise.all([
    djedContract.stableCoin(),
    djedContract.reserveCoin(),
  ]);

  const stableCoin = new ethers.Contract(stableCoinAddress, coinArtifact.abi, providerOrSigner);
  const reserveCoin = new ethers.Contract(reserveCoinAddress, coinArtifact.abi, providerOrSigner);

  return { stableCoin, reserveCoin };
};

// export const getDecimals = async (stableCoin, reserveCoin) => {
//   const [scDecimals, rcDecimals] = await Promise.all([
//     convertInt(web3Promise(stableCoin, "decimals")),
//     convertInt(web3Promise(reserveCoin, "decimals")),
//   ]);
//   return { scDecimals, rcDecimals };
// };

export const getDecimals = async (stableCoin, reserveCoin) => {
  const [scDecimals, rcDecimals] = await Promise.all([
    convertInt(await stableCoin.decimals()),
    convertInt(await reserveCoin.decimals()),
  ]);
  return { scDecimals, rcDecimals };
};