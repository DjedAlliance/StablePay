import { useState } from 'react';
import StablePay from 'stablepay-sdk';
import './App.css';

function App() {
  const [account, setAccount] = useState('');

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
      } catch (err) {
        console.error("User denied account access", err);
      }
    } else {
      alert("Please install MetaMask to connect your wallet.");
    }
  };

  // Configure merchant for a $5 demo payment
  const merchantConfig = new StablePay.Config({
    receivingAddress: '0x000000000000000000000000000000000000dEaD', // Demo receiving address
    amounts: {
      'sepolia': { stablecoin: 5 },
      'milkomeda-mainnet': { stablecoin: 5 },
      'ethereum-classic': { stablecoin: 5 }
    }
  });

  const networkSelector = new StablePay.NetworkSelector(merchantConfig);

  const handleTransactionComplete = (hash) => {
    alert(`Payment Successful! Transaction Hash: ${hash}`);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">Demo Shop</div>
        <button className="connect-wallet-btn" onClick={connectWallet}>
          {account 
            ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` 
            : 'Connect Wallet'}
        </button>
      </header>

      <main className="main-content">
        <div className="card">
          <h2>Premium Subscription</h2>
          <p className="price">$5.00</p>
          <p className="description">
            Get access to premium features for a one-time payment of $5. 
            Powered by StablePay.
          </p>
          <div className="widget-wrapper">
            <StablePay.Widget 
              networkSelector={networkSelector}
              onTransactionComplete={handleTransactionComplete}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
