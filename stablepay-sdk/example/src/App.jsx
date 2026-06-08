import StablePay from 'stablepay-sdk';
import './App.css';

function App() {

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

  const handleTransactionComplete = ({ txHash, network, tokenSymbol, amount }) => {
    alert(`Payment Successful!\nTransaction Hash: ${txHash}\nNetwork: ${network}\nAmount: ${amount} ${tokenSymbol}`);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">Demo Shop</div>
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
