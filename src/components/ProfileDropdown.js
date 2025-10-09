import React, { useState } from 'react';
import './ProfileDropdown.css';

export default function ProfileDropdown({ user, onLogout, onClose }) {
  const [copied, setCopied] = useState(false);

  const copyWalletAddress = () => {
    if (user.wallet_address) {
      navigator.clipboard.writeText(user.wallet_address);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };

  const handleLogout = () => {
    onClose();
    setTimeout(() => {
      onLogout();
    }, 100);
  };

  return (
    <>
      <div className="profile-dropdown-overlay" onClick={onClose} />
      <div className="profile-dropdown">
        <div className="profile-dropdown-header">
          <div className="profile-dropdown-avatar">
            {user.username ? user.username.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="profile-dropdown-info">
            <div className="profile-dropdown-username">{user.username}</div>
            {user.email && (
              <div className="profile-dropdown-email">{user.email}</div>
            )}
          </div>
        </div>

        <div className="profile-dropdown-divider" />

        <div className="profile-dropdown-menu">
          {user.wallet_address && (
            <button 
              className="profile-dropdown-item"
              onClick={copyWalletAddress}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              <span>{copied ? 'Copied!' : 'Copy Wallet Address'}</span>
            </button>
          )}

          <button className="profile-dropdown-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6M12 17v6M5.64 5.64l4.24 4.24M14.12 14.12l4.24 4.24M1 12h6M17 12h6M5.64 18.36l4.24-4.24M14.12 9.88l4.24-4.24"></path>
            </svg>
            <span>Settings</span>
          </button>

          <div className="profile-dropdown-divider" />

          <button 
            className="profile-dropdown-item profile-dropdown-logout"
            onClick={handleLogout}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </>
  );
}