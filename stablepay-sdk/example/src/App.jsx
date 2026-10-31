import StablePay from 'stablepay-sdk';
import './App.css';

// ---------------------------------------------------------------------------
// StablePay uses Tectonic exclusively. This demo pays into the Tectonic
// deployment on Ethereum Sepolia, crediting the merchant address passed in:
//
//   cd StablePay/stablepay-sdk/example
//   VITE_MERCHANT_ADDRESS=0xYourSepoliaAddress npm run dev
// ---------------------------------------------------------------------------
const MERCHANT_ADDRESS = import.meta.env.VITE_MERCHANT_ADDRESS;
const TECTONIC_ADDRESS = StablePay.networksConfig.sepolia.tectonicAddress;

function App() {
  const handleTransactionComplete = ({
    txHash,
    network,
    tokenSymbol,
    amount,
    amountReceived,
    receivedSymbol,
  }) => {
    // Two distinct quantities. On the native path the consumer pays basecoin
    // and the merchant is credited stablecoins, so a receipt that shows only
    // one of them is misleading.
    alert(
      `Payment Successful!\n\n` +
        `Paid:     ${amount} ${tokenSymbol}\n` +
        `Received: ${amountReceived} ${receivedSymbol}\n\n` +
        `Network: ${network}\n` +
        `Transaction Hash: ${txHash}`
    );
  };

  if (!MERCHANT_ADDRESS) {
    return (
      <div className="app-container">
        <header className="header">
          <div className="logo">Demo Shop</div>
        </header>
        <main className="main-content">
          <div className="card">
            <h2>No merchant address configured</h2>
            <p className="description">
              Restart this demo with the Sepolia address that should receive payments:
            </p>
            <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
{`cd StablePay/stablepay-sdk/example
VITE_MERCHANT_ADDRESS=0x... npm run dev`}
            </pre>
          </div>
        </main>
      </div>
    );
  }

  const merchantConfig = new StablePay.Config({
    receivingAddress: MERCHANT_ADDRESS,
    amounts: { sepolia: { stablecoin: 5 } },
  });

  const networkSelector = new StablePay.NetworkSelector(merchantConfig);

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">Demo Shop</div>
        <div
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.6rem',
            borderRadius: '999px',
            background: '#2d2d2d',
            color: '#f7941d',
            fontFamily: 'monospace',
          }}
          title={TECTONIC_ADDRESS}
        >
          sepolia tectonic · {TECTONIC_ADDRESS.slice(0, 6)}…{TECTONIC_ADDRESS.slice(-4)}
        </div>
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
