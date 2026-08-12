// src/utils/config.js
//
// Registry of supported networks.
//
// The `protocol` field selects the adapter (see core/adapters/). It defaults to
// "djed" when omitted, so pre-existing entries keep working.
//
//   protocol: "djed"      -> requires `djedAddress` plus a separate
//                            tokens.stablecoin.address
//   protocol: "tectonic"  -> requires `tectonicAddress`. The Tectonic contract
//                            IS the stablecoin ERC-20, so the token address is
//                            the same value; there is no second address.

export const networksConfig = {
  'sepolia': {
    protocol: 'djed',
    uri: 'https://ethereum-sepolia.publicnode.com/',
    chainId: 11155111,
    djedAddress: '0x624FcD0a1F9B5820c950FefD48087531d38387f4',
    tokens: {
      stablecoin: {
        symbol: 'SOD',
        address: '0x6b930182787F346F18666D167e8d32166dC5eFBD',
        decimals: 18,
        isDirectTransfer: true
      },
      native: {
        symbol: 'ETH',
        decimals: 18,
        isNative: true
      }
    },
    feeUI: 0
  },
  'milkomeda-mainnet': {
    protocol: 'djed',
    uri: 'https://rpc-mainnet-cardano-evm.c1.milkomeda.com',
    chainId: 2001,
    djedAddress: '0x67A30B399F5Ed499C1a6Bc0358FA6e42Ea4BCe76',
    tokens: {
      stablecoin: {
        symbol: 'MOD',
        address: '0xcbA90fB1003b9D1bc6a2b66257D2585011b004e9',
        decimals: 18,
        isDirectTransfer: true
      },
      native: {
        symbol: 'mADA',
        decimals: 18,
        isNative: true
      }
    },
    feeUI: 0
  },
  'ethereum-classic': {
    protocol: 'djed',
    uri: 'https://etc.rivet.link',
    chainId: 61,
    djedAddress: '0xCc3664d7021FD36B1Fe2b136e2324710c8442cCf',
    tokens: {
      stablecoin: {
        symbol: 'ECSD',
        address: '0x5A7Ca94F6E969C94bef4CE5e2f90ed9d4891918A',
        decimals: 18,
        isDirectTransfer: true
      },
      native: {
        symbol: 'ETC',
        decimals: 18,
        isNative: true
      }
    },
    feeUI: 0
  },

  // ---------------------------------------------------------------------
  // Local Tectonic development chain.
  //
  // Not a real deployment. Fill `tectonicAddress` from the output of
  // tectonic-local/script/DeployLocal.s.sol, which also writes
  // tectonic-local/deployments/local.json — or call useLocalTectonic() below.
  //
  // Keep this out of production builds, or have merchants blacklist chain
  // 31337 in their Config.
  // ---------------------------------------------------------------------
  'tectonic-local': {
    protocol: 'tectonic',
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
