import React from 'react';
import { createRoot } from 'react-dom/client';
import { WalletContextProvider } from './contexts/WalletContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Widget from './widget/Widget';

import { MerchantConfig } from './core/MerchantConfig';
import { NetworkSelector } from './core/NetworkSelector';

// Export everything for direct React usage
export { Widget } from './widget/Widget';
export { WalletContextProvider } from './contexts/WalletContext';
export { ThemeProvider } from './contexts/ThemeContext';
export { useWallet } from './contexts/WalletContext';
export { useNetwork } from './contexts/NetworkContext';
export { MerchantConfig } from './core/MerchantConfig';
export { NetworkSelector } from './core/NetworkSelector';

/**
 * StablePay SDK - Main namespace
 * This allows both imperative (StablePay.init) and declarative (React components) usage
 */
const StablePay = {
  // Your existing classes
  MerchantConfig,
  NetworkSelector,
  Widget,
  
  /**
   * Initialize StablePay widget imperatively
   * This is useful for non-React apps or dynamic injection
   * 
   * @param {Object} config
   * @param {string} config.target - CSS selector for container
   * @param {NetworkSelector} config.networkSelector - Your NetworkSelector instance
   * @param {Object} [config.theme] - Theme configuration
   * @param {string} [config.buttonSize='medium'] - Button size
   * @returns {Object} Instance with destroy() method
   */
  init: ({ target, networkSelector, theme: themeConfig, buttonSize = 'medium', ...restConfig }) => {
    const targetElement = document.querySelector(target);

    if (!targetElement) {
      console.error(`StablePay Error: Target element "${target}" not found.`);
      return { destroy: () => {} };
    }

    if (!networkSelector) {
      console.error('StablePay Error: `networkSelector` is required.');
      return { destroy: () => {} };
    }

    const root = createRoot(targetElement);
    
    root.render(
      <React.StrictMode>
        <ThemeProvider themeConfig={themeConfig}>
          <Widget 
            networkSelector={networkSelector} 
            buttonSize={buttonSize}
            {...restConfig} 
          />
        </ThemeProvider>
      </React.StrictMode>
    );

    return {
      destroy: () => {
        root.unmount();
      }
    };
  },
};

export default StablePay;