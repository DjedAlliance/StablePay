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

export const milkomeda = defineChain({
  id: 2001,
  name: 'Milkomeda C1 Mainnet',
  network: 'milkomeda',
  nativeCurrency: {
    decimals: 18,
    name: 'Milkomeda ADA',
    symbol: 'mADA',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-mainnet-cardano-evm.c1.milkomeda.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Milkomeda Explorer', url: 'https://explorer-mainnet-cardano-evm.c1.milkomeda.com' },
  },
  testnet: false,
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
    case 'milkomeda-mainnet':
      return milkomeda;
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
    case 'milkomeda-mainnet':
      return {
        chainId: `0x${milkomeda.id.toString(16)}`,
        chainName: 'Milkomeda C1 Mainnet',
        nativeCurrency: {
          name: 'Milkomeda ADA',
          symbol: 'mADA',
          decimals: 18,
        },
        rpcUrls: ['https://rpc-mainnet-cardano-evm.c1.milkomeda.com'],
        blockExplorerUrls: ['https://explorer-mainnet-cardano-evm.c1.milkomeda.com'],
      };
    default:
      return null;
  }
};
