import { scaledUnscaledPromise, web3Promise } from "./helpers"; 
import { BC_DECIMALS } from "./constants"; 

export const getAccountDetails = async (account, djedInstance) => {
  const { web3, stableCoin, reserveCoin, scDecimals, rcDecimals } = djedInstance;

  const [
    [scaledBalanceSc, unscaledBalanceSc],
    [scaledBalanceRc, unscaledBalanceRc],
    [scaledBalanceBc, unscaledBalanceBc]
  ] = await Promise.all([
    scaledUnscaledPromise(web3Promise(stableCoin, "balanceOf", account), scDecimals),
    scaledUnscaledPromise(web3Promise(reserveCoin, "balanceOf", account), rcDecimals),
    scaledUnscaledPromise(web3.eth.getBalance(account), BC_DECIMALS)
  ]);

  return {
    scaledBalanceSc,
    unscaledBalanceSc,
    scaledBalanceRc,
    unscaledBalanceRc,
    scaledBalanceBc,
    unscaledBalanceBc
  };
};
