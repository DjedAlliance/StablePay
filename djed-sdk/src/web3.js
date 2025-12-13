import { ethers } from "ethers";

// Returns an ethers.Provider - Web3Provider for browser environment
export const getWeb3 = (BLOCKCHAIN_URI) =>
  new Promise((resolve, reject) => {
    if (window.ethereum) {
      try {
        // Use Web3Provider for browser-based wallet integration (MetaMask, etc.)
        const provider = new ethers.BrowserProvider(window.ethereum);
        resolve(provider);
      } catch (error) {
        reject(error);
      }
    } else {
      reject("Please install Metamask");
    }
  });
