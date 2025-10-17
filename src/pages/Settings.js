import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import USFlag from '../components/flags/USFlag';
import ChinaFlag from '../components/flags/ChinaFlag';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const { user, getFreshToken } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const [privateKey, setPrivateKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleBack = () => {
    navigate(-1);
  };

  const handleGetPrivateKey = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get fresh JWT token
      const token = await getFreshToken();
      
      if (!token) {
        throw new Error('Authentication required');
      }

      // Call API to retrieve private key
      const response = await fetch('/api/get-private-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to retrieve private key');
      }

      const data = await response.json();
      setPrivateKey(data.privateKey);
      setShowKey(true);
      
    } catch (err) {
      console.error('Error fetching private key:', err);
      setError(err.message || 'Failed to retrieve private key');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (privateKey) {
      navigator.clipboard.writeText(privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadPrivateKey = () => {
    if (!privateKey || !user) return;

    const content = `FOUR.MARKET WALLET BACKUP
==============================

⚠️ KEEP THIS FILE SECURE AND PRIVATE ⚠️

Wallet Address: ${user.wallet_address}
Private Key: ${privateKey}

Retrieved: ${new Date().toLocaleString()}

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
    link.download = `four-market-wallet-${user.wallet_address.slice(0, 8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="settings-page">
      <button className="settings-back-btn" onClick={handleBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>BACK</span>
      </button>

      <div className="settings-header">
        <h1 className="settings-title">{t('settings.title')}</h1>
        <p className="settings-subtitle">{t('settings.subtitle')}</p>
      </div>

      {/* Private Key Section */}
      <div className="settings-section">
        <div className="settings-card">
          <div className="settings-card-left">
            <div className="settings-icon-header">
              <svg className="settings-wallet-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              <h2 className="settings-card-title">{t('settings.privateKey')}</h2>
            </div>

            <div className="settings-description">
              <p>{t('settings.privateKeyDesc')}</p>
              
              <div className="settings-warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>{t('settings.warning')}</span>
              </div>
            </div>
          </div>

          <div className="settings-card-right">
            {!showKey ? (
              <button 
                className="settings-action-btn"
                onClick={handleGetPrivateKey}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="btn-spinner"></div>
                    {t('settings.retrieving')}
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    {t('settings.getPrivateKey')}
                  </>
                )}
              </button>
            ) : (
              <div className="settings-key-display">
                <div className="settings-key-box">
                  <code>{privateKey}</code>
                </div>
                <div className="settings-key-actions">
                  <button 
                    className="settings-key-btn copy-btn"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        {t('settings.copied')}
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        {t('settings.copy')}
                      </>
                    )}
                  </button>
                  <button 
                    className="settings-key-btn download-btn"
                    onClick={downloadPrivateKey}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    {t('settings.download')}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="settings-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Language Settings Section */}
      <div className="settings-section">
        <div className="settings-card">
          <div className="settings-card-left">
            <div className="settings-icon-header">
              <svg className="settings-wallet-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <h2 className="settings-card-title">{t('settings.defaultLanguage')}</h2>
            </div>

            <div className="settings-description">
              <p>{t('settings.languageDesc')}</p>
            </div>
          </div>

          <div className="settings-card-right">
            <div className="settings-language-options">
              <button
                className={`settings-language-btn ${language === 'en' ? 'active' : ''}`}
                onClick={() => changeLanguage('en')}
              >
                <span className="language-flag">
                  <USFlag width={32} height={24} />
                </span>
                <span className="language-name">{t('settings.english')}</span>
                {language === 'en' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </button>

              <button
                className={`settings-language-btn ${language === 'zh' ? 'active' : ''}`}
                onClick={() => changeLanguage('zh')}
              >
                <span className="language-flag">
                  <ChinaFlag width={32} height={24} />
                </span>
                <span className="language-name">{t('settings.chinese')}</span>
                {language === 'zh' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account Info Section */}
      <div className="settings-section">
        <div className="settings-info-grid">
          <div className="settings-info-card">
            <div className="settings-info-label">{t('settings.username')}</div>
            <div className="settings-info-value">{user?.username || 'N/A'}</div>
          </div>
          <div className="settings-info-card">
            <div className="settings-info-label">{t('settings.walletAddress')}</div>
            <div className="settings-info-value">
              <code>{user?.wallet_address || 'N/A'}</code>
            </div>
          </div>
          {user?.email && (
            <div className="settings-info-card">
              <div className="settings-info-label">{t('settings.email')}</div>
              <div className="settings-info-value">{user.email}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

