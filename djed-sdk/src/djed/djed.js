import djedArtifact from "../artifacts/DjedABI.json";
import coinArtifact from "../artifacts/CoinABI.json";
import { convertInt, web3Promise, buildTx } from "../helpers";
import { createDjedAdapter } from "../adapters/djedAdapter";

//setting up djed
export const getDjedContract = (web3, DJED_ADDRESS) => {
  const djed = new web3.eth.Contract(djedArtifact.abi, DJED_ADDRESS);
  return djed;
};

export const getCoinContracts = async (djedContract, web3) => {
  const [stableCoinAddress, reserveCoinAddress] = await Promise.all([
    web3Promise(djedContract, "stableCoin"),
    web3Promise(djedContract, "reserveCoin"),
  ]);
  const stableCoin = new web3.eth.Contract(coinArtifact.abi, stableCoinAddress);
  const reserveCoin = new web3.eth.Contract(
    coinArtifact.abi,
    reserveCoinAddress
  );
  return { stableCoin, reserveCoin };
};
export const getDecimals = async (stableCoin, reserveCoin) => {
  const [scDecimals, rcDecimals] = await Promise.all([
    convertInt(web3Promise(stableCoin, "decimals")),
    convertInt(web3Promise(reserveCoin, "decimals")),
  ]);
  return { scDecimals, rcDecimals };
};

const buyScTx = (djed, payer, receiver, value, UI, DJED_ADDRESS) => {
  const adapter = createDjedAdapter(djed);
  const data = adapter.buyStableCoins(receiver, UI).encodeABI();
  return buildTx(payer, DJED_ADDRESS, value, data);
};

const sellScTx = (djed, account, amount, UI, DJED_ADDRESS) => {
  const adapter = createDjedAdapter(djed);
  const data = adapter.sellStableCoins(amount, account, UI).encodeABI();
  return buildTx(account, DJED_ADDRESS, 0, data);
};
