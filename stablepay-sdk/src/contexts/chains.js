import { defineChain } from 'viem';

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
    default: { name: 'BlockScout', url: 'https://etc.blockscout.com/mordor' },
  },
  testnet: true,
});
