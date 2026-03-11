export const BC_DECIMALS = 18;
export const SCALING_DECIMALS = 24;
export const TRANSACTION_USD_LIMIT = 10000;
export const FEE_UI = 0.01;
export const REFRESH_PERIOD = 4000;
export const CONFIRMATION_WAIT_PERIOD = REFRESH_PERIOD + 1000;

export const TRANSACTION_VALIDITY = {
  OK: "Transaction is valid.",
  WALLET_NOT_CONNECTED: "Wallet not connected",
  WRONG_NETWORK: "Wallet connected to the wrong network",
  NONNUMERIC_INPUT: "Amount has to be a number",
  NEGATIVE_INPUT: "Amount cannot be negative",
  ZERO_INPUT: "Amount cannot be zero",
  INSUFFICIENT_BC: "Insufficient balance",
  INSUFFICIENT_SC: "Insufficient StableCoin balance",
  INSUFFICIENT_RC: "Insufficient ReserveCoin balance",
  RESERVE_RATIO_LOW: "Reserve ratio would drop below the minimum",
  RESERVE_RATIO_HIGH: "Reserve ratio would rise above the maximum",
  TRANSACTION_LIMIT_REACHED: "Transaction limit reached"
};


export const NETWORKS = {
  sepolia: {
    name: "Sepolia",
    chainId: 11155111,
    rpcUrl: "https://sepolia.infura.io/v3/",
    djedAddress: "0xSEPOLIA_DJED_ADDRESS",
    oracleAddress: "0xSEPOLIA_ORACLE_ADDRESS"
  },
  mainnet: {
    name: "Ethereum Mainnet",
    chainId: 1,
    rpcUrl: "https://mainnet.infura.io/v3/",
    djedAddress: "0xMAINNET_DJED_ADDRESS",
    oracleAddress: "0xMAINNET_ORACLE_ADDRESS"
  }
};

export const getNetworkConfig = (networkName = "sepolia") => {
  const config = NETWORKS[networkName];

  if (!config) {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  return config;
};