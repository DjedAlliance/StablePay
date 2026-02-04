/**
 * Final Generalized Configuration
 * Supports multiple Djed deployments (Osiris, Isis, Tefnut) per network.
 */
export const networksConfig = {
  'sepolia': {
    uri: 'https://ethereum-sepolia.publicnode.com/',
    chainId: 11155111,
    stablecoins: [
      {
        id: 'djed-eth-sepolia',
        name: 'Djed (ETH Backed)',
        protocol: 'djed',
        contractAddress: '0x624FcD0a1F9B5820c950FefD48087531d38387f4',
        baseAsset: {
          symbol: 'ETH',
          decimals: 18,
          isNative: true,
          address: null
        },
        stableCoin: {
          symbol: 'SOD',
          address: '0x6b930182787F346F18666D167e8d32166dC5eFBD',
          decimals: 18,
          isDirectTransfer: true
        }
      }
    ],
    feeUI: 0
  },
  'milkomeda-mainnet': {
    uri: 'https://rpc-mainnet-cardano-evm.c1.milkomeda.com',
    chainId: 2001,
    stablecoins: [
      {
        id: 'djed-mada',
        name: 'Djed (mADA Backed)',
        protocol: 'djed',
        contractAddress: '0x67A30B399F5Ed499C1a6Bc0358FA6e42Ea4BCe76',
        baseAsset: {
          symbol: 'mADA',
          decimals: 18,
          isNative: true,
          address: null
        },
        stableCoin: {
          symbol: 'MOD',
          address: '0xcbA90fB1003b9D1bc6a2b66257D2585011b004e9',
          decimals: 18,
          isDirectTransfer: true
        }
      },
      {
        id: 'djed-usdt-isis',
        name: 'Djed (USDT Backed)',
        protocol: 'isis', // Triggers ERC20 Approval logic
        contractAddress: '0x0000000000000000000000000000000000000000', // Replace with live Isis address
        baseAsset: { 
          symbol: 'USDT', 
          decimals: 6, 
          isNative: false, 
          address: '0x0000000000000000000000000000000000000000' // Replace with live USDT address
        },
        stableCoin: {
          symbol: 'iUSD',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          isDirectTransfer: true
        }
      }
    ],
    feeUI: 0
  },
  'ethereum-classic': {
    uri: 'https://etc.rivet.link',
    chainId: 61,
    stablecoins: [
      {
        id: 'djed-etc',
        name: 'Djed (ETC Backed)',
        protocol: 'djed',
        contractAddress: '0xCc3664d7021FD36B1Fe2b136e2324710c8442cCf',
        baseAsset: {
          symbol: 'ETC',
          decimals: 18,
          isNative: true,
          address: null
        },
        stableCoin: {
          symbol: 'ECSD',
          address: '0x5A7Ca94F6E969C94bef4CE5e2f90ed9d4891918A',
          decimals: 18,
          isDirectTransfer: true
        }
      }
    ],
    feeUI: 0
  }
};