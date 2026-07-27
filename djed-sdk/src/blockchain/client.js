import { createPublicClient, createWalletClient, http } from "viem";
import { mainnet } from "viem/chains";

export const createViemClients = (rpcUrl, account) => {
  if (!rpcUrl || typeof rpcUrl !== "string" || !rpcUrl.trim()) {
    throw new Error("createViemClients: rpcUrl is required");
  }

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: mainnet,
    transport: http(rpcUrl),
    ...(account ? { account } : {}),   
  });

  return { publicClient, walletClient };
};