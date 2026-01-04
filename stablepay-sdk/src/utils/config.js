// src/utils/config.js
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
  'eprotocol: 'djed',
    thereum-classic': {  //Mordor Testnet details
    uri: 'https://rpc.mordor.etccooperative.org',  // Mordor RPC
    chainId: 63,  
    djedAddress: '0xD4548F4b6d08852B56cdabC6be7Fd90953179d68',  //Mordor DJED contract
    tokens: {
      stablecoin: {
        symbol: 'ECSD',
        address: '0xffD4505B3452Dc22f8473616d50503bA9E1710Ac',  //  Mordor Stablecoin
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
  }
};