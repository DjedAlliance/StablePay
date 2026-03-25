import Web3 from "web3";

export const getWeb3 = async (URI) => {
  if (typeof window !== "undefined" && window.ethereum) {
    try {
      const web3 = new Web3(window.ethereum);

      // Request account access (important)
      await window.ethereum.request({ method: "eth_requestAccounts" });

      return web3;
    } catch (error) {
      const msg = error?.code === 4001
        ? "User denied account access"
        : "Failed to initialize wallet provider";
      console.error(msg, error);
      throw error;
    }
  }

  // Fallback to RPC
  if (!URI) {
    throw new Error("No injected provider found and no fallback URI supplied.");
  }
  // Fallback to RPC
  return new Web3(new Web3.providers.HttpProvider(URI));
};