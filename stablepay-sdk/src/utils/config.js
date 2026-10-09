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
// There are currently no public Tectonic deployments. Until upstream ships
// one, the only usable entry is the local development chain below. Add real
// networks here as they go live, following the same shape.

export const networksConfig = {
  // ---------------------------------------------------------------------
  // Local Tectonic development chain (anvil).
  //
  // Not a real deployment. Fill `tectonicAddress` from the output of
  // tectonic-local/script/DeployLocal.s.sol, which also writes
  // tectonic-local/deployments/local.json — or call useLocalTectonic() below.
  //
  // Keep this out of production builds, or have merchants blacklist chain
  // 31337 in their Config.
  // ---------------------------------------------------------------------
  'tectonic-local': {
    uri: 'http://127.0.0.1:8545',
    chainId: 31337,
    // null, not the zero address: the zero address is truthy in JS, so a
    // placeholder like '0x000...0' slips past the adapter's missing-address
    // check and fails later as an opaque decode error instead of "missing
    // tectonicAddress". Call useLocalTectonic() to populate both fields.
    tectonicAddress: null,
    tokens: {
      stablecoin: {
        symbol: 'SC',
        // Same address as the protocol: under Tectonic they are one contract.
        address: null,
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

/**
 * Point the widget at a freshly deployed local Tectonic without hand-editing
 * the same address in two places.
 *
 *   import StablePay from 'stablepay-sdk';
 *   StablePay.useLocalTectonic('0xabc...');
 *
 * @param {string} address deployed Tectonic contract address
 * @returns {object} the updated network config entry
 */
export function useLocalTectonic(address) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? '')) {
    throw new Error(`useLocalTectonic: "${address}" is not a valid address`);
  }
  networksConfig['tectonic-local'].tectonicAddress = address;
  networksConfig['tectonic-local'].tokens.stablecoin.address = address;
  return networksConfig['tectonic-local'];
}
