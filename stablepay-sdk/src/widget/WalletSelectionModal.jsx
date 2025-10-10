import React from 'react';
import { useWallet } from '../contexts/WalletContext';
import Dialog from './Dialog';

/**
 * @component WalletSelectionModal
 * @description A modal component to select and connect a wallet.
 */
const WalletSelectionModal = ({ isOpen, onClose }) => {
  const { connect, getAvailableWallets, isConnecting, error } = useWallet();
  const availableWallets = getAvailableWallets();

  const handleWalletSelect = async (walletId) => {
    const success = await connect(walletId);
    if (success) {
      onClose();
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Connect a Wallet">
      <div className="stablepay-wallet-selection">
        <ul className="stablepay-wallet-list">
          {availableWallets.map((wallet) => (
            <li key={wallet.id}>
              <button
                className="stablepay-wallet-button"
                onClick={() => handleWalletSelect(wallet.id)}
                disabled={isConnecting}
              >
                {/* We can add wallet logos later */}
                <span>{wallet.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {isConnecting && <p className="stablepay-connecting-message">Connecting...</p>}
        {error && <p className="stablepay-error-message">{error}</p>}
      </div>
    </Dialog>
  );
};

export default WalletSelectionModal;