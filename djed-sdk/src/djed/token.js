import { buildTx } from "../helpers";

export const approveTx = (tokenContract, owner, spender, amount) => {
  const data = tokenContract.methods.approve(spender, amount).encodeABI();
  return buildTx(owner, tokenContract.options.address, 0, data);
};

export const checkAllowance = async (tokenContract, owner, spender) => {
  return await tokenContract.methods.allowance(owner, spender).call();
};
