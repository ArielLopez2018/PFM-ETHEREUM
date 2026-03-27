import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.css';
import App from './App';
import { WalletProvider } from './context/WalletContext';
import { BlockchainProvider } from './context/BlockchainContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <WalletProvider>
      <BlockchainProvider>
        <App />
      </BlockchainProvider>
    </WalletProvider>
  </React.StrictMode>
);
