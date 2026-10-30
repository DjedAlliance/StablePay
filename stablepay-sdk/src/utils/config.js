// src/utils/config.js
//
// Registry of supported networks.
//
// StablePay uses Tectonic exclusively. Every entry here is a Tectonic
// deployment and needs a `tectonicAddress`.
//
// Note that the Tectonic contract IS the stablecoin ERC-20 — there is no
// separate token contract the way other stablecoin protocols have one — so
// `tokens.stablecoin.address` is always the same value as `tectonicAddress`.
// Keeping both is what lets the direct-transfer path read a token address
// without special-casing.
//
// Deployed addresses and parameters are recorded in Deployments.md in
// Tectonic-EVM-Contracts. Add networks here as they go live, following the
// same shape.

export const networksConfig = {
  sepolia: {
    uri: 'https://ethereum-sepolia-rpc.publicnode.com',
    chainId: 11155111,
    tectonicAddress: '0xea262fB18992ddE398a5b6fa7A4F879FfB262aC1',
    tokens: {
      stablecoin: {
        symbol: 'SC',
        address: '0xea262fB18992ddE398a5b6fa7A4F879FfB262aC1',
        decimals: 18,
        isDirectTransfer: true
      },
      native: {
        symbol: 'ETH',
        decimals: 18,
        isNative: true
      }
    }
  }
};
