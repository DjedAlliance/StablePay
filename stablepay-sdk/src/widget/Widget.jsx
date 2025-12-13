import React, { useState } from "react";
import PayButton from "./PayButton";
import Dialog from "./Dialog";
import NetworkDropdown from "./NetworkDropdown";
import TokenDropdown from "./TokenDropdown";
import TransactionReview from "./TransactionReview";
import { NetworkProvider, useNetwork } from "../contexts/NetworkContext";
import { WalletProvider } from "../contexts/WalletContext";
import styles from "../styles/PricingCard.css";

const WidgetContent = ({ onClose, buttonSize, onTransactionComplete }) => {
  const { resetSelections } = useNetwork(); 

  const handleClose = () => {
    resetSelections(); // Reset selections when closing the widget
    onClose();
  };

  return (
    <Dialog onClose={handleClose} size={buttonSize}>
      <NetworkDropdown />
      <TokenDropdown />
      <TransactionReview onTransactionComplete={onTransactionComplete} />
    </Dialog>
  );
};

const WidgetWithProviders = ({ onClose, buttonSize, networkSelector, onTransactionComplete }) => {
  return (
    <NetworkProvider networkSelector={networkSelector}>
      <WalletProvider> 
        <WidgetContent onClose={onClose} buttonSize={buttonSize} onTransactionComplete={onTransactionComplete} />
      </WalletProvider>
    </NetworkProvider>
  );
};

export const Widget = ({ networkSelector, buttonSize = "medium", onTransactionComplete, onSuccess }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  // Support both onTransactionComplete and onSuccess for backwards compatibility
  const handleTransactionComplete = onTransactionComplete || onSuccess;

  return (
    <div className={styles.widgetContainer}>
      {!isDialogOpen && (
        <PayButton onClick={handleOpenDialog} size={buttonSize} />
      )}
      {isDialogOpen && (
        <WidgetWithProviders
          onClose={handleCloseDialog}
          buttonSize={buttonSize}
          networkSelector={networkSelector}
          onTransactionComplete={handleTransactionComplete}
        />
      )}
    </div>
  );
};

export default Widget;
