import React, { useState } from "react";
import PayButton from "./PayButton";
import Dialog from "./Dialog";
import NetworkDropdown from "./NetworkDropdown";
import TokenDropdown from "./TokenDropdown";
import TransactionReview from "./TransactionReview";
import { NetworkProvider, useNetwork } from "../contexts/NetworkContext";
import { WalletProvider } from "../contexts/WalletContext";
import styles from "../styles/PricingCard.css";

const WidgetContent = ({ onClose, buttonSize }) => {
  const { resetSelections } = useNetwork(); //

  const handleClose = () => {
    resetSelections();
    onClose();
  };

  return (
    <Dialog onClose={handleClose} size={buttonSize}>
      <NetworkDropdown />
      <TokenDropdown />
      <TransactionReview />
    </Dialog>
  );
};

const WidgetWithProviders = ({ onClose, buttonSize, networkSelector }) => {
  return (
    <NetworkProvider networkSelector={networkSelector}>
      <WalletProvider>
        <WidgetContent onClose={onClose} buttonSize={buttonSize} />
      </WalletProvider>
    </NetworkProvider>
  );
};

export const Widget = ({ networkSelector, buttonSize = "medium" }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

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
        />
      )}
    </div>
  );
};

export default Widget;
