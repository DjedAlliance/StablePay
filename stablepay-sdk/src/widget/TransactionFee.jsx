import React, { useState, useEffect, useMemo } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { GasEstimationService } from '../services/GasEstimationService';

const speedTiers = {
  slow: { label: 'Slow', time: '~5-10 min' },
  standard: { label: 'Standard', time: '~1-3 min' },
  fast: { label: 'Fast', time: '< 1 min' },
};

/**
 * @component TransactionFee
 * @description A component to display and select transaction fees.
 */
const TransactionFee = ({ onFeeSelect, isNativeTransaction }) => {
  const { client } = useWallet();
  const [gasPrices, setGasPrices] = useState(null);
  const [selectedSpeed, setSelectedSpeed] = useState('standard');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const gasService = useMemo(() => {
    if (!client) return null;
    return new GasEstimationService(client.transport);
  }, [client]);

  useEffect(() => {
    if (!gasService || !isNativeTransaction) {
      setIsLoading(false);
      return;
    }

    const fetchPrices = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const prices = await gasService.getGasPrices();
        setGasPrices(prices);
      } catch (err) {
        console.error('Failed to fetch gas prices:', err);
        setError('Could not load gas fees.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // Refresh every 60 seconds

    return () => clearInterval(interval);
  }, [gasService, isNativeTransaction]);

  useEffect(() => {
    if (gasPrices && onFeeSelect) {
      onFeeSelect({
        speed: selectedSpeed,
        gwei: gasPrices[selectedSpeed],
      });
    }
  }, [selectedSpeed, gasPrices, onFeeSelect]);

  if (!isNativeTransaction) {
    return null; // Don't render for non-native token transactions
  }

  if (isLoading) {
    return <div className="stablepay-fee-loading">Loading fee estimates...</div>;
  }
  
  if (error) {
    return <div className="stablepay-fee-error">{error}</div>;
  }

  return (
    <div className="stablepay-transaction-fee">
      <h4 className="stablepay-fee-title">Transaction Speed</h4>
      <div className="stablepay-fee-options">
        {Object.keys(speedTiers).map((speed) => (
          <div
            key={speed}
            className={`stablepay-fee-option ${selectedSpeed === speed ? 'selected' : ''}`}
            onClick={() => setSelectedSpeed(speed)}
          >
            <div className="stablepay-fee-label">{speedTiers[speed].label}</div>
            <div className="stablepay-fee-gwei">{gasPrices[speed]} Gwei</div>
            <div className="stablepay-fee-time">{speedTiers[speed].time}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransactionFee;