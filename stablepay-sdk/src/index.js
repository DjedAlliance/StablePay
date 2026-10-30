// src/index.js
import { NetworkSelector } from './core/NetworkSelector';
import { Transaction } from './core/Transaction';
import { Config } from './core/MerchantConfig';
import { TectonicAdapter } from './core/adapters/TectonicAdapter.js';
import { networksConfig } from './utils/config';
import Widget from './widget/Widget.jsx';
import PayButton from './widget/PayButton.jsx';
import Dialog from './widget/Dialog.jsx';
import NetworkDropdown from './widget/NetworkDropdown.jsx';
import './styles/main.css';
import './styles/PricingCard.css';

const StablePay = {
  NetworkSelector,
  Transaction,
  Config,
  Widget,
  PayButton,
  Dialog,
  NetworkDropdown,

  // Chain access layer. Most integrations never touch this — Transaction wraps
  // it — but it is exported for tests and for embedders who need direct reads.
  TectonicAdapter,

  // Network registry.
  networksConfig,
};

export {
  NetworkSelector,
  Transaction,
  Config,
  Widget,
  PayButton,
  Dialog,
  NetworkDropdown,
  TectonicAdapter,
  networksConfig,
};

export default StablePay;
