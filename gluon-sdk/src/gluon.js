import Web3 from 'web3';

const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
      "constant": true,
      "inputs": [{"name": "_owner", "type": "address"}],
      "name": "balanceOf",
      "outputs": [{"name": "balance", "type": "uint256"}],
      "type": "function"
  },
   {
      "constant": true,
      "inputs": [],
      "name": "totalSupply",
      "outputs": [{"name": "", "type": "uint256"}],
      "type": "function"
  }
];

export class Gluon {
    constructor(web3, contractAddress, abi, routerAddress = null, routerAbi = null) {
        this.web3 = web3;
        this.contract = new web3.eth.Contract(abi, contractAddress);
        if (routerAddress) {
            this.router = new web3.eth.Contract(routerAbi, routerAddress);
        }
        this.BN = web3.utils.BN;
    }

    /**
     * @param {string|number} amountIn Amount of Base Asset deposited (in wei/base units)
     * @param {string|number} reserve Current Reserve (R)
     * @param {string|number} neutronSupply Current Neutron Supply (S_n)
     * @param {string|number} protonSupply Current Proton Supply (S_p)
     * @param {string|number} fissionFee Fission Fee (WAD, e.g. 0.01 * 1e18)
     * @param {string|number} priceTarget Target Price of Neutron from Oracle (WAD) - Usually 1e18 ($1)
     * @param {string|number} basePrice Base Asset Price from Oracle (WAD) - Needed for bootstrap
     * @returns {Object} { neutronOut: BN, protonOut: BN, feeAmount: BN }
     */

    calculateFission(amountIn, reserve, neutronSupply, protonSupply, fissionFee, priceTarget, basePrice) {
        const m = new this.BN(amountIn);
        const R = new this.BN(reserve);
        const Sn = new this.BN(neutronSupply);
        const Sp = new this.BN(protonSupply);
        const feeRate = new this.BN(fissionFee);
        const WAD = new this.BN("1000000000000000000"); // 1e18

        // Calculate Fee
        // feeAmount = m * fissionFee / WAD
        const feeAmount = m.mul(feeRate).div(WAD);
        const net = m.sub(feeAmount);

        if (net.isZero()) {
            return { neutronOut: new this.BN(0), protonOut: new this.BN(0), feeAmount };
        }

        // Bootstrap Case: R=0, Sn=0, Sp=0
        if (R.isZero() && Sn.isZero() && Sp.isZero()) {
            return this._calculateBootstrapFission(net, basePrice);
        }

        // Standard Case
        // neutronOut = net * Sn / R
        // protonOut = net * Sp / R

        // Handling R=0 in standard case is technically impossible if Sn/Sp > 0 due to invariants, 
        // but physically R could be 0 if hacked or drained. Code requires R > 0.
        if (R.isZero()) {
            throw new Error("Reserve is zero but supplies are not zero. Invalid state.");
        }

        const neutronOut = Sn.isZero() ? new this.BN(0) : net.mul(Sn).div(R);
        const protonOut = Sp.isZero() ? new this.BN(0) : net.mul(Sp).div(R);

        return {
            neutronOut,
            protonOut,
            feeAmount
        };
    }

    /**
     * Calculates required Native Input (m) to get a specific amount of Neutrons (N).
     * Formula derived from Gluon Paper Table 3 (v3): N = m * (1 - phi) * (Sn / R)
     * Therefore: m = (N * R) / (Sn * (1 - phi))
     */
    calculateRequiredInputForNeutrons(desiredNeutrons, reserve, neutronSupply, fissionFee) {
        const N = new this.BN(desiredNeutrons);
        const R = new this.BN(reserve);
        const Sn = new this.BN(neutronSupply);
        const WAD = new this.BN("1000000000000000000"); // 1e18
        const feeRate = new this.BN(fissionFee);

        // 1. Calculate the efficiency factor: (Sn * (1 - phi))
        // effectiveSupply = Sn * (WAD - feeRate) / WAD
        const oneMinusPhi = WAD.sub(feeRate);
        const effectiveSupply = Sn.mul(oneMinusPhi).div(WAD);

        if (effectiveSupply.isZero()) {
            // Handle edge case or bootstrap (use different formula for R=0)
            throw new Error("Supply too low or R=0 (Bootstrap needed)");
        }

        // 2. Calculate Input m = (N * R) / effectiveSupply
        const requiredInput = N.mul(R).div(effectiveSupply);

        // Add a small buffer (e.g. 1%) for rounding errors/slippage if needed
        return requiredInput;
    }

    _calculateBootstrapFission(netBase, basePriceWad) {
        const net = new this.BN(netBase);
        const price = new this.BN(basePriceWad);
        const WAD = new this.BN("1000000000000000000");

        if (price.isZero()) throw new Error("Bad price: 0");

        // depositValueWad = net * price / WAD
        const depositValueWad = net.mul(price).div(WAD);

        // neutronValueWad = depositValueWad / 3
        const neutronValueWad = depositValueWad.div(new this.BN(3));

        // baseForNeutronWad = neutronValueWad * WAD / price
        const baseForNeutronWad = neutronValueWad.mul(WAD).div(price);

        const protonBaseWad = net.sub(baseForNeutronWad);

        // In bootstrap, neutronOut is the value (assuming $1 peg) ?
        // Code: return (neutronValueWad, protonBaseWad)
        // Correct, matches Solidity _bootstrapFissionOutputs

        return {
            neutronOut: neutronValueWad,
            protonOut: protonBaseWad,
            feeAmount: new this.BN(0) 
        };
    }

    /**
     * Executes the fission transaction.
     * @param {string} fromAddress User's address
     * @param {string|number} amountIn Amount of Base Asset to deposit
     * @param {string} toAddress Recipient of minted tokens
     * @param {Array} updateData Pyth update data (optional)
     * @param {string|number} pythFee Fee for Pyth update (optional)
     */
    async fission(fromAddress, amountIn, toAddress, updateData = [], pythFee = 0) {
        const amount = new this.BN(amountIn);
        const pFee = new this.BN(pythFee);
        const totalValue = amount.add(pFee);

        // Standard Fission (Mixed output to 'toAddress')
        // Used if no router is configured or explicit call
        if (!this.router) {
            const tx = this.contract.methods.fission(amount, toAddress, updateData);
            return {
                from: fromAddress,
                to: this.contract.options.address,
                data: tx.encodeABI(),
                value: totalValue.toString()
            };
        }

        // Router Fission (Neutrons -> toAddress, Protons -> fromAddress)
        const tx = this.router.methods.payWithFission(toAddress, updateData);
        return {
            from: fromAddress,
            to: this.router.options.address,
            data: tx.encodeABI(),
            value: totalValue.toString()
        }
    }

    async getCoinContracts() {
        const neutronAddress = await this.contract.methods.NEUTRON_TOKEN().call();
        const protonAddress = await this.contract.methods.PROTON_TOKEN().call();
        return {
            neutron: new this.web3.eth.Contract(ERC20_ABI, neutronAddress),
            proton: new this.web3.eth.Contract(ERC20_ABI, protonAddress)
        };
    }

    async getDecimals(protonContract, neutronContract) {
        const protonDecimals = await protonContract.methods.decimals().call();
        const neutronDecimals = await neutronContract.methods.decimals().call();
        return { protonDecimals, neutronDecimals };
    }
}
