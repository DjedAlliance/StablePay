import StablePay from 'stablepay-sdk';
import './App.css';

// ---------------------------------------------------------------------------
// Local Tectonic development mode.
//
// Set VITE_TECTONIC_ADDRESS to the address printed by
// tectonic-local/script/DeployLocal.s.sol (also in deployments/local.json) and
// the demo talks to your local anvil chain instead of the live Djed networks.
// Leave it unset for the normal Djed demo.
//
//   cd StablePay/stablepay-sdk/example
//   VITE_TECTONIC_ADDRESS=0xYourTectonicAddress npm run dev
//
// useLocalTectonic writes the address into both the protocol slot and the
// token slot, because under Tectonic they are the same contract.
// ---------------------------------------------------------------------------
const TECTONIC_ADDRESS = import.meta.env.VITE_TECTONIC_ADDRESS;
const isLocalTectonic = Boolean(TECTONIC_ADDRESS);

if (isLocalTectonic) {
  StablePay.useLocalTectonic(TECTONIC_ADDRESS);
}

function App() {
  // A $5 demo payment. In local Tectonic mode the only offered network is the
  // local chain; otherwise the usual Djed deployments.
  const merchantConfig = new StablePay.Config({
    // anvil account #1 when running locally, so the merchant is an account you
    // can actually inspect with `cast balance` / `cast call`.
    receivingAddress: isLocalTectonic
      ? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
      : '0x000000000000000000000000000000000000dEaD',
    amounts: isLocalTectonic
      ? { 'tectonic-local': { stablecoin: 5 } }
      : {
          'sepolia': { stablecoin: 5 },
          'milkomeda-mainnet': { stablecoin: 5 },
          'ethereum-classic': { stablecoin: 5 },
        },
    // Keep the dropdown from offering a network this demo has no price for.
    blacklist: isLocalTectonic ? [11155111, 2001, 61] : [31337],
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

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">Demo Shop</div>
        {isLocalTectonic && (
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
        )}
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
