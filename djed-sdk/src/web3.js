import Web3 from "web3";

export const getWeb3 = (BLOCKCHAIN_URI) =>
  new Promise((resolve, reject) => {
    if (window.ethereum) {
      try {
        const web3 = new Web3(BLOCKCHAIN_URI);
        resolve(web3);
      } catch (error) {
        reject(error);
      }
    } else {
      reject("Please install Metamask");
    }
  });
