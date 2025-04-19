// import Web3 from "web3";

// export const getWeb3 = (BLOCKCHAIN_URI) =>
//   new Promise((resolve, reject) => {
//     if (window.ethereum) {
//       try {
//         const web3 = new Web3(BLOCKCHAIN_URI);
//         resolve(web3);
//       } catch (error) {
//         reject(error);
//       }
//     } else {
//       reject("Please install Metamask");
//     }
//   });
import { ethers } from "ethers";

export const getEthers = async (BLOCKCHAIN_URI) => {
  if (window.ethereum) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []); 
      return provider;
    } catch (error) {
      throw error;
    }
  } else {
    throw new Error("Please install Metamask");
  }
};
