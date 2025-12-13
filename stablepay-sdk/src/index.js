// src/index.js
import { NetworkSelector } from './core/NetworkSelector';
import { Transaction } from './core/Transaction';
import { Config } from './core/MerchantConfig';
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
  NetworkDropdown
};

export default StablePay;