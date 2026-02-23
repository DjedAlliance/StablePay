import Web3 from "web3";

export const getWeb3 = async (URI) => {
  if (typeof window !== "undefined" && window.ethereum) {
    try {
      const web3 = new Web3(window.ethereum);

      // Request account access (important)
      await window.ethereum.request({ method: "eth_requestAccounts" });

      return web3;
    } catch (error) {
      console.error("User denied account access", error);
      throw error;
    }
  }

  // Fallback to RPC
  return new Web3(new Web3.providers.HttpProvider(URI));
};