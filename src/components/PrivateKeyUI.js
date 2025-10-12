import React, { useState } from 'react';
import './PrivateKeyUI.css';

export default function PrivateKeyUI({ privateKey, walletAddress, onClose }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(privateKey);
    setCopied(true);
    // Don't reset - stays green permanently once copied
  };

  const downloadPrivateKey = () => {
    const content = `FOUR.MARKET WALLET BACKUP
==============================

⚠️ KEEP THIS FILE SECURE AND PRIVATE ⚠️

Wallet Address: ${walletAddress}
Private Key: ${privateKey}

Created: ${new Date().toLocaleString()}

==============================
SECURITY WARNINGS:
- Never share your private key with anyone
- Store this file in a secure location
- Anyone with this key can access your funds
- Four.market will never ask for your private key
==============================`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `four-market-wallet-${walletAddress.slice(0, 8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    setDownloaded(true);
    // Don't reset - stays green permanently once downloaded
  };

  const handleContinue = () => {
    if (understood && (copied || downloaded)) {
      onClose();
    }
  };

  return (
    <div className="pkui-overlay">
      <div className="pkui-modal">
        {/* Warning Icon */}
        <div className="pkui-icon-wrapper">
          <svg className="pkui-warning-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>

        {/* Header */}
        <div className="pkui-header">
          <h2 className="pkui-title">SAVE YOUR PRIVATE KEY</h2>
          <p className="pkui-subtitle">This is your ONLY chance to save your wallet's private key</p>
        </div>

        {/* Warning Box */}
        <div className="pkui-warning-box">
          <div className="pkui-warning-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>CRITICAL SECURITY WARNING</span>
          </div>
          <ul className="pkui-warning-list">
            <li>We will <strong>NEVER</strong> show you this private key again</li>
            <li>Anyone with this key can <strong>STEAL ALL YOUR FUNDS</strong></li>
            <li>We <strong>CANNOT</strong> recover your funds if you lose this key</li>
            <li>Store it in a <strong>SECURE LOCATION</strong> offline</li>
          </ul>
        </div>

        {/* Wallet Info */}
        <div className="pkui-wallet-section">
          <div className="pkui-field">
            <label className="pkui-label">YOUR WALLET ADDRESS</label>
            <div className="pkui-value-box wallet-address">
              <code>{walletAddress}</code>
            </div>
          </div>

          <div className="pkui-field">
            <label className="pkui-label">YOUR PRIVATE KEY</label>
            <div className="pkui-value-box private-key">
              <code>{privateKey}</code>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pkui-actions">
          <button 
            className={`pkui-action-btn copy-btn ${copied ? 'copied' : ''}`}
            onClick={copyToClipboard}
            disabled={copied}
          >
            {copied ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                COPIED TO CLIPBOARD
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                COPY PRIVATE KEY
              </>
            )}
          </button>

          <button 
            className={`pkui-action-btn download-btn ${downloaded ? 'downloaded' : ''}`}
            onClick={downloadPrivateKey}
            disabled={downloaded}
          >
            {downloaded ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                DOWNLOADED BACKUP FILE
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                DOWNLOAD BACKUP FILE
              </>
            )}
          </button>
        </div>

        {/* Confirmation Checkbox */}
        <div className="pkui-confirmation">
          <label className="pkui-checkbox-label">
            <input 
              type="checkbox" 
              className="pkui-checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
            />
            <span className="pkui-checkbox-text">
              I understand that <strong>this is my only chance</strong> to save my private key. 
              If I lose it, I will <strong>permanently lose access</strong> to my wallet and all funds.
            </span>
          </label>
        </div>

        {/* Continue Button */}
        <button 
          className="pkui-continue-btn"
          onClick={handleContinue}
          disabled={!understood || (!copied && !downloaded)}
        >
          {!understood ? (
            'CONFIRM YOU UNDERSTAND'
          ) : (!copied && !downloaded) ? (
            'COPY OR DOWNLOAD KEY FIRST'
          ) : (
            'I HAVE SAVED MY PRIVATE KEY'
          )}
        </button>

        {/* Status Indicators */}
        <div className="pkui-status">
          <div className={`pkui-status-item ${copied ? 'completed' : ''}`}>
            <div className="pkui-status-icon">
              {copied ? '✓' : '○'}
            </div>
            <span>Copied to clipboard</span>
          </div>
          <div className={`pkui-status-item ${downloaded ? 'completed' : ''}`}>
            <div className="pkui-status-icon">
              {downloaded ? '✓' : '○'}
            </div>
            <span>Downloaded backup file</span>
          </div>
          <div className={`pkui-status-item ${understood ? 'completed' : ''}`}>
            <div className="pkui-status-icon">
              {understood ? '✓' : '○'}
            </div>
            <span>Confirmed understanding</span>
          </div>
        </div>
      </div>
    </div>
  );
}