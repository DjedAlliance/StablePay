import { FEE_UI_UNSCALED } from "./tradeUtils";
import { buildTx } from "../helpers";

// # ISIS / TEFNUT Transaction Functions (ERC20 Base Asset)

/**
 * Buy StableCoins (Isis/Tefnut Variant - ERC20 Base Asset)
 * Note: Caller must APPROVE the Djed contract to spend `amountBC` of the Base Asset before calling this.
 */
export const buyScIsisTx = (djed, payer, receiver, amountBC, UI, DJED_ADDRESS) => {
  // Signature: buyStableCoins(uint256 amountBC, address receiver, uint256 feeUI, address ui)
  const data = djed.methods
    .buyStableCoins(amountBC, receiver, FEE_UI_UNSCALED, UI)
    .encodeABI();
  
  // Value is 0 because Base Asset is ERC20 transferFrom, not msg.value
  return buildTx(payer, DJED_ADDRESS, 0, data);
};

export const sellScIsisTx = (djed, account, amountSC, UI, DJED_ADDRESS) => {
    // Signature: sellStableCoins(uint256 amountSC, address receiver, uint256 feeUI, address ui)
    const data = djed.methods
      .sellStableCoins(amountSC, account, FEE_UI_UNSCALED, UI)
      .encodeABI();
    return buildTx(account, DJED_ADDRESS, 0, data);
};

export const buyRcIsisTx = (djed, payer, receiver, amountBC, UI, DJED_ADDRESS) => {
    // Signature: buyReserveCoins(uint256 amountBC, address receiver, uint256 feeUI, address ui)
    const data = djed.methods
      .buyReserveCoins(amountBC, receiver, FEE_UI_UNSCALED, UI)
      .encodeABI();
    
    return buildTx(payer, DJED_ADDRESS, 0, data);
  };
  
export const sellRcIsisTx = (djed, account, amountRC, UI, DJED_ADDRESS) => {
    // Signature: sellReserveCoins(uint256 amountRC, address receiver, uint256 feeUI, address ui)
    const data = djed.methods
      .sellReserveCoins(amountRC, account, FEE_UI_UNSCALED, UI)
      .encodeABI();
    return buildTx(account, DJED_ADDRESS, 0, data);
};

export const sellBothIsisTx = (djed, account, amountSC, amountRC, UI, DJED_ADDRESS) => {
    // Signature: sellBothCoins(uint256 amountSC, uint256 amountRC, address receiver, uint256 feeUI, address ui)
    const data = djed.methods
      .sellBothCoins(amountSC, amountRC, account, FEE_UI_UNSCALED, UI)
      .encodeABI();
    return buildTx(account, DJED_ADDRESS, 0, data);
};