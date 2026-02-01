import { defineChain } from 'viem';
import { sepolia } from 'viem/chains';

export const mordor = defineChain({
  id: 63,
  name: 'Mordor Testnet',
  network: 'mordor',
  nativeCurrency: {
    decimals: 18,
    name: 'Mordor Ether',
    symbol: 'METC',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.mordor.etccooperative.org'],
      webSocket: ['wss://rpc.mordor.etccooperative.org/ws'],
    },
  },
  blockExplorers: {
    default: { name: 'BlockScout', url: 'https://blockscout.com/etc/mordor' },
  },
  testnet: true,
});

export const etcMainnet = defineChain({
  id: 61,
  name: 'Ethereum Classic',
  network: 'etc',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum Classic',
    symbol: 'ETC',
  },
  rpcUrls: {
    default: {
      http: ['https://etc.rivet.link'],
    },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://blockscout.com/etc/mainnet' },
  },
  testnet: false,
});

export const getChainByNetworkKey = (networkKey) => {
  switch (networkKey) {
    case 'sepolia':
      return sepolia;
    case 'ethereum-classic':
      return etcMainnet;
    default:
      return null;
  }
};

export const getChainConfigForWallet = (networkKey) => {
  switch (networkKey) {
    case 'sepolia':
      return {
        chainId: `0x${sepolia.id.toString(16)}`,
        chainName: 'Sepolia',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: sepolia.rpcUrls.default.http,
        blockExplorerUrls: sepolia.blockExplorers?.default?.url ? [sepolia.blockExplorers.default.url] : [],
      };
    case 'ethereum-classic':
      return {
        chainId: `0x${etcMainnet.id.toString(16)}`,
        chainName: 'Ethereum Classic',
        nativeCurrency: {
          name: 'Ethereum Classic',
          symbol: 'ETC',
          decimals: 18,
        },
        rpcUrls: ['https://etc.rivet.link'],
        blockExplorerUrls: ['https://blockscout.com/etc/mainnet'],
      };
    default:
      return null;
  }
};
