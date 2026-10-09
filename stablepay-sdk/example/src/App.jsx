import StablePay from 'stablepay-sdk';
import './App.css';

// ---------------------------------------------------------------------------
// StablePay uses Tectonic exclusively, and there are no public Tectonic
// deployments yet — so this demo needs a local one to talk to.
//
// Deploy with tectonic-local/script/DeployLocal.s.sol, then pass the printed
// address (also written to tectonic-local/deployments/local.json):
//
//   cd StablePay/stablepay-sdk/example
//   VITE_TECTONIC_ADDRESS=0xYourTectonicAddress npm run dev
//
// useLocalTectonic writes the address into both the protocol slot and the
// token slot, because under Tectonic they are the same contract.
// ---------------------------------------------------------------------------
const TECTONIC_ADDRESS = import.meta.env.VITE_TECTONIC_ADDRESS;

if (TECTONIC_ADDRESS) {
  StablePay.useLocalTectonic(TECTONIC_ADDRESS);
}

function App() {
  const merchantConfig = new StablePay.Config({
    // anvil account #1, so the merchant is an account you can inspect with
    // `cast balance` and `cast call`.
    receivingAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    amounts: { 'tectonic-local': { stablecoin: 5 } },
  });

  const networkSelector = new StablePay.NetworkSelector(merchantConfig);

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

  if (!TECTONIC_ADDRESS) {
    return (
      <div className="app-container">
        <header className="header">
          <div className="logo">Demo Shop</div>
        </header>
        <main className="main-content">
          <div className="card">
            <h2>No Tectonic address configured</h2>
            <p className="description">
              Deploy Tectonic locally, then restart this demo with the address:
            </p>
            <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
{`cd StablePay/tectonic-local
anvil   # in another terminal
forge script script/DeployLocal.s.sol \\
  --rpc-url http://127.0.0.1:8545 --broadcast \\
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

cd ../stablepay-sdk/example
VITE_TECTONIC_ADDRESS=0x... npm run dev`}
            </pre>
          </div>
        </main>
      </div>
    );
  }

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
          local tectonic · {TECTONIC_ADDRESS.slice(0, 6)}…{TECTONIC_ADDRESS.slice(-4)}
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
