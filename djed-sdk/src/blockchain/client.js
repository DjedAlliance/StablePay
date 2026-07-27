import { createPublicClient, createWalletClient, http } from "viem"
import { mainnet } from "viem/chains"

export const createViemClients = (rpcUrl) => {
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(rpcUrl),
    })

    const walletClient = createWalletClient({
        chain: mainnet,
        transport: http(rpcUrl),
    })

    return { publicClient, walletClient }
}