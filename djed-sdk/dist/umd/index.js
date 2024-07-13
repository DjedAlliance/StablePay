(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('web3')) :
  typeof define === 'function' && define.amd ? define(['exports', 'web3'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.DjedSdk = {}, global.Web3));
})(this, (function (exports, Web3) { 'use strict';

  var contractName$1 = "Djed";
  var abi$1 = [
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "oracleAddress",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "_scalingFactor",
  				type: "uint256"
  			},
  			{
  				internalType: "address",
  				name: "_treasury",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "_initialTreasuryFee",
  				type: "uint256"
  			},
  			{
  				internalType: "uint256",
  				name: "_treasuryRevenueTarget",
  				type: "uint256"
  			},
  			{
  				internalType: "uint256",
  				name: "_reserveRatioMin",
  				type: "uint256"
  			},
  			{
  				internalType: "uint256",
  				name: "_reserveRatioMax",
  				type: "uint256"
  			},
  			{
  				internalType: "uint256",
  				name: "_fee",
  				type: "uint256"
  			},
  			{
  				internalType: "uint256",
  				name: "_thresholdSupplySC",
  				type: "uint256"
  			},
  			{
  				internalType: "uint256",
  				name: "_rcMinPrice",
  				type: "uint256"
  			},
  			{
  				internalType: "uint256",
  				name: "_txLimit",
  				type: "uint256"
  			}
  		],
  		stateMutability: "payable",
  		type: "constructor"
  	},
  	{
  		anonymous: false,
  		inputs: [
  			{
  				indexed: true,
  				internalType: "address",
  				name: "buyer",
  				type: "address"
  			},
  			{
  				indexed: true,
  				internalType: "address",
  				name: "receiver",
  				type: "address"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "amountRC",
  				type: "uint256"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "amountBC",
  				type: "uint256"
  			}
  		],
  		name: "BoughtReserveCoins",
  		type: "event"
  	},
  	{
  		anonymous: false,
  		inputs: [
  			{
  				indexed: true,
  				internalType: "address",
  				name: "buyer",
  				type: "address"
  			},
  			{
  				indexed: true,
  				internalType: "address",
  				name: "receiver",
  				type: "address"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "amountSC",
  				type: "uint256"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "amountBC",
  				type: "uint256"
  			}
  		],
  		name: "BoughtStableCoins",
  		type: "event"
  	},
  	{
  		anonymous: false,
  		inputs: [
  			{
  				indexed: true,
  				internalType: "address",
  				name: "seller",
  				type: "address"
  			},
  			{
  				indexed: true,
  				internalType: "address",
  				name: "receiver",
  				type: "address"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "amountSC",
  				type: "uint256"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "amountRC",
  				type: "uint256"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "amountBC",
  				type: "uint256"
  			}
  		],
  		name: "SoldBothCoins",
  		type: "event"
  	},
  	{
  		anonymous: false,
  		inputs: [
  			{
  				indexed: true,
  				internalType: "address",
  				name: "seller",
  				type: "address"
  			},
  			{
  				indexed: true,
  				internalType: "address",
  				name: "receiver",
  				type: "address"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "amountRC",
  				type: "uint256"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "amountBC",
  				type: "uint256"
  			}
  		],
  		name: "SoldReserveCoins",
  		type: "event"
  	},
  	{
  		anonymous: false,
  		inputs: [
  			{
  				indexed: true,
  				internalType: "address",
  				name: "seller",
  				type: "address"
  			},
  			{
  				indexed: true,
  				internalType: "address",
  				name: "receiver",
  				type: "address"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "amountSC",
  				type: "uint256"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "amountBC",
  				type: "uint256"
  			}
  		],
  		name: "SoldStableCoins",
  		type: "event"
  	},
  	{
  		inputs: [
  			{
  				internalType: "uint256",
  				name: "_currentPaymentAmount",
  				type: "uint256"
  			}
  		],
  		name: "E",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "L",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "uint256",
  				name: "_currentPaymentAmount",
  				type: "uint256"
  			}
  		],
  		name: "R",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "receiver",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "fee_ui",
  				type: "uint256"
  			},
  			{
  				internalType: "address",
  				name: "ui",
  				type: "address"
  			}
  		],
  		name: "buyReserveCoins",
  		outputs: [
  		],
  		stateMutability: "payable",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "receiver",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "feeUI",
  				type: "uint256"
  			},
  			{
  				internalType: "address",
  				name: "ui",
  				type: "address"
  			}
  		],
  		name: "buyStableCoins",
  		outputs: [
  		],
  		stateMutability: "payable",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "fee",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "initialTreasuryFee",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "oracle",
  		outputs: [
  			{
  				internalType: "contract IFreeOracle",
  				name: "",
  				type: "address"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "ratio",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "uint256",
  				name: "_currentPaymentAmount",
  				type: "uint256"
  			}
  		],
  		name: "rcBuyingPrice",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "rcDecimalScalingFactor",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "rcMinPrice",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "uint256",
  				name: "_currentPaymentAmount",
  				type: "uint256"
  			}
  		],
  		name: "rcTargetPrice",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "reserveCoin",
  		outputs: [
  			{
  				internalType: "contract Coin",
  				name: "",
  				type: "address"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "reserveRatioMax",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "reserveRatioMin",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "scDecimalScalingFactor",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "uint256",
  				name: "_currentPaymentAmount",
  				type: "uint256"
  			}
  		],
  		name: "scPrice",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "scalingFactor",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "uint256",
  				name: "amountSC",
  				type: "uint256"
  			},
  			{
  				internalType: "uint256",
  				name: "amountRC",
  				type: "uint256"
  			},
  			{
  				internalType: "address",
  				name: "receiver",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "fee_ui",
  				type: "uint256"
  			},
  			{
  				internalType: "address",
  				name: "ui",
  				type: "address"
  			}
  		],
  		name: "sellBothCoins",
  		outputs: [
  		],
  		stateMutability: "nonpayable",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "uint256",
  				name: "amountRC",
  				type: "uint256"
  			},
  			{
  				internalType: "address",
  				name: "receiver",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "fee_ui",
  				type: "uint256"
  			},
  			{
  				internalType: "address",
  				name: "ui",
  				type: "address"
  			}
  		],
  		name: "sellReserveCoins",
  		outputs: [
  		],
  		stateMutability: "nonpayable",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "uint256",
  				name: "amountSC",
  				type: "uint256"
  			},
  			{
  				internalType: "address",
  				name: "receiver",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "feeUI",
  				type: "uint256"
  			},
  			{
  				internalType: "address",
  				name: "ui",
  				type: "address"
  			}
  		],
  		name: "sellStableCoins",
  		outputs: [
  		],
  		stateMutability: "nonpayable",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "stableCoin",
  		outputs: [
  			{
  				internalType: "contract Coin",
  				name: "",
  				type: "address"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "thresholdSupplySC",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "treasury",
  		outputs: [
  			{
  				internalType: "address",
  				name: "",
  				type: "address"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "treasuryFee",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "treasuryRevenue",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "treasuryRevenueTarget",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "txLimit",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	}
  ];
  var djedArtifact = {
  	contractName: contractName$1,
  	abi: abi$1
  };

  var contractName = "Coin";
  var abi = [
  	{
  		inputs: [
  			{
  				internalType: "string",
  				name: "name",
  				type: "string"
  			},
  			{
  				internalType: "string",
  				name: "symbol",
  				type: "string"
  			}
  		],
  		stateMutability: "nonpayable",
  		type: "constructor"
  	},
  	{
  		anonymous: false,
  		inputs: [
  			{
  				indexed: true,
  				internalType: "address",
  				name: "owner",
  				type: "address"
  			},
  			{
  				indexed: true,
  				internalType: "address",
  				name: "spender",
  				type: "address"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "value",
  				type: "uint256"
  			}
  		],
  		name: "Approval",
  		type: "event"
  	},
  	{
  		anonymous: false,
  		inputs: [
  			{
  				indexed: true,
  				internalType: "address",
  				name: "from",
  				type: "address"
  			},
  			{
  				indexed: true,
  				internalType: "address",
  				name: "to",
  				type: "address"
  			},
  			{
  				indexed: false,
  				internalType: "uint256",
  				name: "value",
  				type: "uint256"
  			}
  		],
  		name: "Transfer",
  		type: "event"
  	},
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "owner",
  				type: "address"
  			},
  			{
  				internalType: "address",
  				name: "spender",
  				type: "address"
  			}
  		],
  		name: "allowance",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "spender",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "amount",
  				type: "uint256"
  			}
  		],
  		name: "approve",
  		outputs: [
  			{
  				internalType: "bool",
  				name: "",
  				type: "bool"
  			}
  		],
  		stateMutability: "nonpayable",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "account",
  				type: "address"
  			}
  		],
  		name: "balanceOf",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "spender",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "subtractedValue",
  				type: "uint256"
  			}
  		],
  		name: "decreaseAllowance",
  		outputs: [
  			{
  				internalType: "bool",
  				name: "",
  				type: "bool"
  			}
  		],
  		stateMutability: "nonpayable",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "spender",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "addedValue",
  				type: "uint256"
  			}
  		],
  		name: "increaseAllowance",
  		outputs: [
  			{
  				internalType: "bool",
  				name: "",
  				type: "bool"
  			}
  		],
  		stateMutability: "nonpayable",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "name",
  		outputs: [
  			{
  				internalType: "string",
  				name: "",
  				type: "string"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "symbol",
  		outputs: [
  			{
  				internalType: "string",
  				name: "",
  				type: "string"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "totalSupply",
  		outputs: [
  			{
  				internalType: "uint256",
  				name: "",
  				type: "uint256"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "to",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "amount",
  				type: "uint256"
  			}
  		],
  		name: "transfer",
  		outputs: [
  			{
  				internalType: "bool",
  				name: "",
  				type: "bool"
  			}
  		],
  		stateMutability: "nonpayable",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "from",
  				type: "address"
  			},
  			{
  				internalType: "address",
  				name: "to",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "amount",
  				type: "uint256"
  			}
  		],
  		name: "transferFrom",
  		outputs: [
  			{
  				internalType: "bool",
  				name: "",
  				type: "bool"
  			}
  		],
  		stateMutability: "nonpayable",
  		type: "function"
  	},
  	{
  		inputs: [
  		],
  		name: "decimals",
  		outputs: [
  			{
  				internalType: "uint8",
  				name: "",
  				type: "uint8"
  			}
  		],
  		stateMutability: "view",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "to",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "amount",
  				type: "uint256"
  			}
  		],
  		name: "mint",
  		outputs: [
  		],
  		stateMutability: "nonpayable",
  		type: "function"
  	},
  	{
  		inputs: [
  			{
  				internalType: "address",
  				name: "from",
  				type: "address"
  			},
  			{
  				internalType: "uint256",
  				name: "amount",
  				type: "uint256"
  			}
  		],
  		name: "burn",
  		outputs: [
  		],
  		stateMutability: "nonpayable",
  		type: "function"
  	}
  ];
  var coinArtifact = {
  	contractName: contractName,
  	abi: abi
  };

  // Modify getWeb3 to accept BLOCKCHAIN_URI as a parameter
  const getWeb3 = (BLOCKCHAIN_URI) => {
    return new Promise((resolve, reject) => {
      try {
        const web3 = new Web3(BLOCKCHAIN_URI);
        resolve(web3);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Modify getDjedContract to accept DJED_ADDRESS as a parameter
  const getDjedContract = (web3, DJED_ADDRESS) => {
    return new web3.eth.Contract(djedArtifact.abi, DJED_ADDRESS);
  };

  const getOracleAddress = async (djedContract) => {
    return await djedContract.methods.oracle().call();
  };

  const getCoinContracts = async (djedContract, web3) => {
    const [stableCoinAddress, reserveCoinAddress] = await Promise.all([
      djedContract.methods.stableCoin().call(),
      djedContract.methods.reserveCoin().call()
    ]);
    const stableCoin = new web3.eth.Contract(coinArtifact.abi, stableCoinAddress);
    const reserveCoin = new web3.eth.Contract(coinArtifact.abi, reserveCoinAddress);
    return { stableCoin, reserveCoin };
  };

  exports.getCoinContracts = getCoinContracts;
  exports.getDjedContract = getDjedContract;
  exports.getOracleAddress = getOracleAddress;
  exports.getWeb3 = getWeb3;

}));
