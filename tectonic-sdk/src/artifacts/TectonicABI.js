/**
 * Minimal Tectonic ABI — only the members StablePay needs.
 *
 * Deliberately a .js module rather than a .json file. Importing JSON from ESM
 * requires an import attribute (`with { type: "json" }`), which is not portable:
 * Node 20.10+ wants `with`, older Node wants `assert`, and Rollup needs a JSON
 * plugin. A plain JS export works identically in every Node version, in every
 * bundler, and in the browser, with no build configuration at all.
 *
 * Hand-maintained so the SDK does not depend on a Foundry build. To regenerate
 * the complete ABI once upstream stabilises:
 *
 *     forge inspect Tectonic abi
 *
 * and paste the array below. Keep it in sync with
 * StablePay/tectonic-local/src/Tectonic.sol.
 */
export const TECTONIC_ABI = [
  // --- protocol parameters (public state variables) ---
  { inputs: [], name: "D", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "oracle", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "equityCoin", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "treasury", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "fee", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "treasuryFee", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "criticalReserveRatio", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "safeReserveRatio", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },

  // --- reserve accounting ---
  { inputs: [], name: "R", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "L", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "E", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "ratio", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },

  // --- prices ---
  { inputs: [], name: "scPriceMint", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "scPriceRedeem", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "ecPrice", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },

  // --- stability fees ---
  { inputs: [], name: "stabilityFee", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  {
    inputs: [{ name: "a", type: "address" }],
    name: "stabilityFeeAmount",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "a", type: "address" }],
    name: "balanceOfAfterStabilityFee",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  // --- operations ---
  { inputs: [{ name: "receiver", type: "address" }], name: "mint", outputs: [], stateMutability: "payable", type: "function" },
  {
    inputs: [{ name: "amountSC", type: "uint256" }, { name: "receiver", type: "address" }],
    name: "redeem",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "receiver", type: "address" }],
    name: "mintEquityCoins",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "amountRC", type: "uint256" }, { name: "receiver", type: "address" }],
    name: "redeemEquityCoins",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // --- ERC-20 (the Tectonic contract is itself the stablecoin) ---
  { inputs: [], name: "name", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }],
    name: "transfer",
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },

  // --- events ---
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "minter", type: "address" },
      { indexed: true, name: "receiver", type: "address" },
      { indexed: false, name: "amountSC", type: "uint256" },
      { indexed: false, name: "amountBC", type: "uint256" },
    ],
    name: "Minted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "redeemer", type: "address" },
      { indexed: true, name: "receiver", type: "address" },
      { indexed: false, name: "amountSC", type: "uint256" },
      { indexed: false, name: "amountBC", type: "uint256" },
    ],
    name: "Redeemed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
];

export default TECTONIC_ABI;
