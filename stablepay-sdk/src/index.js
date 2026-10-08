// src/index.js
import { NetworkSelector } from './core/NetworkSelector';
import { Transaction } from './core/Transaction';
import { Config } from './core/MerchantConfig';
import { createAdapter, TectonicAdapter, DjedAdapter, ProtocolAdapter } from './core/adapters/index.js';
import { networksConfig, useLocalTectonic } from './utils/config';
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

  // Protocol adapters. Most integrations never touch these — Transaction picks
  // the right one from the network config — but they are exported for tests
  // and for embedders adding a new protocol.
  createAdapter,
  ProtocolAdapter,
  TectonicAdapter,
  DjedAdapter,

  // Network registry and the local-development helper.
  networksConfig,
  useLocalTectonic,
};

export {
  NetworkSelector,
  Transaction,
  Config,
  Widget,
  PayButton,
  Dialog,
  NetworkDropdown,
  createAdapter,
  ProtocolAdapter,
  TectonicAdapter,
  DjedAdapter,
  networksConfig,
  useLocalTectonic,
};

export default StablePay;
