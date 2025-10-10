import Web3 from 'web3';

/**
 * @class GasEstimationService
 * @description Provides utility methods for gas price estimation and fee calculation.
 */
export class GasEstimationService {
  /**
   * @param {object} provider - An Ethereum provider instance (e.g., from a wallet client).
   */
  constructor(provider) {
    if (!provider) {
      throw new Error('A provider is required for GasEstimationService.');
    }
    this.web3 = new Web3(provider);
    this.gasPriceCache = {
      prices: null,
      timestamp: 0,
    };
  }

  /**
   * Fetches and caches gas prices.
   * @param {boolean} forceRefresh - If true, fetches new prices regardless of cache.
   * @returns {Promise<{slow: string, standard: string, fast: string}>}
   */
  async getGasPrices(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.gasPriceCache.prices && (now - this.gasPriceCache.timestamp < 60000)) { // 1-minute cache
      return this.gasPriceCache.prices;
    }

    try {
      const gasPrice = await this.web3.eth.getGasPrice(); // In Wei
      const basePriceGwei = parseFloat(this.web3.utils.fromWei(gasPrice, 'gwei'));

      const prices = {
        slow: basePriceGwei.toFixed(2),
        standard: (basePriceGwei * 1.2).toFixed(2),
        fast: (basePriceGwei * 1.5).toFixed(2),
      };
      
      this.gasPriceCache = { prices, timestamp: now };
      return prices;
    } catch (error) {
      console.error('Error fetching gas prices:', error);
      // Return fallback values
      return { slow: '5', standard: '10', fast: '15' };
    }
  }

  /**
   * Estimates the gas limit for a transaction.
   * @param {object} tx - The transaction object.
   * @returns {Promise<number>} The estimated gas limit with a buffer.
   */
  async estimateGasLimit(tx) {
    try {
      const gasLimit = await this.web3.eth.estimateGas(tx);
      return Math.ceil(gasLimit * 1.2); // Add 20% buffer
    } catch (error) {
      console.error('Error estimating gas limit:', error);
      return 100000; // Fallback gas limit
    }
  }

  /**
   * Calculates the transaction fee.
   * @param {string} speed - The desired speed ('slow', 'standard', 'fast').
   * @param {number} gasLimit - The gas limit for the transaction.
   * @returns {Promise<string>} The transaction fee in Ether.
   */
  async calculateFee(speed, gasLimit) {
    const prices = await this.getGasPrices();
    const priceGwei = prices[speed] || prices.standard;
    const priceWei = this.web3.utils.toWei(priceGwei, 'gwei');
    const feeWei = BigInt(priceWei) * BigInt(gasLimit);
    return this.web3.utils.fromWei(feeWei.toString(), 'ether');
  }

  /**
   * Calculates the maximum amount that can be sent, accounting for fees.
   * @param {string} balance - The user's balance in Ether.
   * @param {string} speed - The desired transaction speed.
   * @param {number} gasLimit - The gas limit for the transaction.
   * @returns {Promise<string>} The maximum transferable amount in Ether.
   */
  async getMaxAmount(balance, speed, gasLimit) {
    const feeEther = await this.calculateFee(speed, gasLimit);
    const balanceWei = BigInt(this.web3.utils.toWei(balance, 'ether'));
    const feeWei = BigInt(this.web3.utils.toWei(feeEther, 'ether'));

    if (balanceWei > feeWei) {
      const maxAmountWei = balanceWei - feeWei;
      return this.web3.utils.fromWei(maxAmountWei.toString(), 'ether');
    }
    return '0';
  }
}