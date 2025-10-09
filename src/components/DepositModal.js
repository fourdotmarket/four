import React, { useState, useEffect } from 'react';
import './DepositModal.css';

export default function DepositModal({ walletAddress, onClose }) {
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    // Generate QR code using a public API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${walletAddress}&bgcolor=000000&color=FFD43B`;
    setQrCodeUrl(qrUrl);
  }, [walletAddress]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="deposit-modal-overlay" onClick={onClose}>
      <div className="deposit-modal" onClick={(e) => e.stopPropagation()}>
        <button className="deposit-modal-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="deposit-modal-header">
          <h2>Deposit BSC</h2>
          <p>Deposit funds by sending BSC to this wallet</p>
        </div>

        <div className="deposit-modal-content">
          <div className="deposit-qr-container">
            {qrCodeUrl && (
              <img 
                src={qrCodeUrl} 
                alt="Wallet QR Code" 
                className="deposit-qr-code"
              />
            )}
          </div>

          <div className="deposit-wallet-info">
            <div className="deposit-chain-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              <span>BSC</span>
            </div>

            <div className="deposit-address-container">
              <div className="deposit-address-label">Wallet Address</div>
              <div className="deposit-address-box">
                <span className="deposit-address-text">{walletAddress}</span>
                <button 
                  className="deposit-copy-btn"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
              </div>
              {copied && <div className="deposit-copied-message">Copied to clipboard!</div>}
            </div>

            <div className="deposit-warning">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <div>
                <strong>Only send BSC to this address.</strong>
                <br />
                Sending other tokens may result in permanent loss of funds.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}