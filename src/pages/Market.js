import React, { useState } from 'react';
import './Market.css';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useBalance } from '../hooks/useBalance';
import { useLanguage } from '../context/LanguageContext';
import MarketCard from '../components/MarketCard';
import { useMarkets } from '../hooks/useMarkets';
import Notification from '../components/Notification';
import DepositModal from '../components/DepositModal';

const CONTRACT_ADDRESS = "0x8dDbbBEAc546B4AeF8DFe8edd0084eF19B9077b6";
const MIN_STAKE = 0.05;
const MIN_PREDICTION_LENGTH = 50;
const MAX_PREDICTION_LENGTH = 256;

export default function Market() {
  const { user, authReady, getFreshToken } = useAuth();
  const { notification, showNotification, hideNotification } = useNotification();
  const { balance } = useBalance(user?.wallet_address);
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const { markets, loading: marketsLoading, error: marketsError, hasMore } = useMarkets(page);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositMessage, setDepositMessage] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [prediction, setPrediction] = useState('');
  const [stake, setStake] = useState('0.05');
  const [expiry, setExpiry] = useState('24');
  const [tickets, setTickets] = useState('100');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Allow English, Chinese, numbers, and common punctuation
  const allowedChars = /^[\u4e00-\u9fa5a-zA-Z0-9\s.,?!-]+$/;

  // Map expiry to duration index
  const expiryToDuration = {
    '6': 0, '12': 1, '18': 2, '24': 3, '3d': 4, '7d': 5
  };

  // Map tickets to ticketAmount index
  const ticketsToAmount = {
    '1': 0, '10': 1, '50': 2, '100': 3
  };

  const handlePredictionChange = (e) => {
    const value = e.target.value;
    // Only allow if it matches the allowed pattern or if it's empty
    if (value === '' || allowedChars.test(value)) {
      if (value.length <= MAX_PREDICTION_LENGTH) {
        setPrediction(value);
      }
    }
  };

  const handleStakeChange = (e) => {
    const value = e.target.value;
    
    // Allow empty or just a decimal point
    if (value === '' || value === '.') {
      setStake(value);
      return;
    }
    
    // Allow valid numbers (including decimals like 0.0, 0.07, etc)
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setStake(value);
    }
  };

  const calculateTicketPrice = () => {
    const stakeValue = parseFloat(stake) || 0;
    const ticketCount = parseInt(tickets) || 1;
    return (stakeValue / ticketCount).toFixed(4);
  };

  const resetForm = () => {
    setPrediction('');
    setStake('0.05');
    setExpiry('24');
    setTickets('100');
    setShowAdvanced(false);
    setIsCreating(false);
  };

  const handleClose = () => {
    if (isCreating) return;
    setIsClosing(true);
    setTimeout(() => {
      setShowCreateModal(false);
      setIsClosing(false);
      resetForm();
    }, 300);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isCreating) {
      handleClose();
    }
  };

  const handleOpenCreateModal = () => {
    // Smart auth check: if user exists, they're authenticated (bypass authReady)
    if (!user) {
      // Only check authReady if there's no user
      if (!authReady) {
        showNotification('Authenticating, please wait...', 'warning');
        return;
      }
      showNotification('Please sign in to create a bet', 'error');
      return;
    }

    if (balance !== null && balance < MIN_STAKE) {
      setDepositMessage(`You need at least ${MIN_STAKE} BNB deposited to create a bet. Current balance: ${balance.toFixed(4)} BNB`);
      setShowDepositModal(true);
      return;
    }

    setShowCreateModal(true);
  };

  const handleCreateBet = async () => {
    // Smart auth check: if user exists, proceed
    if (!user) {
      if (!authReady) {
        showNotification('Authenticating, please wait...', 'warning');
        return;
      }
      showNotification('Please sign in to create a bet', 'error');
      return;
    }
    
    // Validation
    if (!prediction.trim()) {
      showNotification('Please enter a prediction', 'error');
      return;
    }

    if (prediction.length < MIN_PREDICTION_LENGTH) {
      showNotification(`Prediction must be at least ${MIN_PREDICTION_LENGTH} characters (currently ${prediction.length})`, 'error');
      return;
    }

    const stakeValue = parseFloat(stake);
    if (!stake || isNaN(stakeValue) || stakeValue < MIN_STAKE) {
      showNotification(`Please enter a valid stake amount (minimum ${MIN_STAKE} BNB)`, 'error');
      return;
    }

    if (!authReady) {
      showNotification('Authentication is still loading. Please wait a moment and try again.', 'warning');
      return;
    }

    // Check if user has sufficient balance
    if (balance !== null && balance < MIN_STAKE) {
      setDepositMessage(`You need at least ${MIN_STAKE} BNB deposited to create a bet. Current balance: ${balance.toFixed(4)} BNB`);
      setShowDepositModal(true);
      handleClose();
      return;
    }

    try {
      setIsCreating(true);

      const duration = expiryToDuration[expiry];
      const ticketAmount = ticketsToAmount[tickets];

      // Get fresh JWT token with retry logic
      console.log('Getting fresh authentication token...');
      const token = await getFreshToken();
      
      if (!token) {
        throw new Error('Failed to get authentication token. Please sign in again.');
      }
      
      console.log('Token obtained, creating market...');

      console.log('ðŸ“ Creating market with JWT authentication');

      // SECURITY FIX: No user_id in body, only JWT token in header
      const response = await fetch('/api/create-bet', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`  // JWT token for auth
        },
        body: JSON.stringify({
          // NO user_id here! It comes from JWT token
          question: prediction,
          stakeAmount: stake,
          duration: duration,
          ticketAmount: ticketAmount
        })
      });

      const contentType = response.headers.get('content-type');
      let result;

      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('âŒ Server error:', text.substring(0, 200));
        throw new Error('Server error occurred. Check server logs.');
      }

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to create bet');
      }
      
      console.log('✅ Market created!');
      console.log('TX Hash:', result.txHash);
      console.log('Market ID:', result.marketId);

      showNotification('Market created successfully!', 'success');

      setTimeout(() => {
        handleClose();
      }, 1500);

    } catch (error) {
      console.error('âŒ Error creating bet:', error);
      setIsCreating(false);
      
      // Handle specific error messages
      if (error.message.includes('Authentication required')) {
        showNotification('Please sign in again to create a bet', 'error');
      } else if (error.message.includes('Too many markets created')) {
        showNotification('You have created too many markets recently. Please wait before creating another.', 'warning');
      } else {
        showNotification(`Failed to create bet: ${error.message}`, 'error');
      }
    }
  };

  const isPredictionValid = prediction.length >= MIN_PREDICTION_LENGTH;
  const isStakeValid = parseFloat(stake) >= MIN_STAKE;
  const canSubmit = isPredictionValid && isStakeValid && !isCreating && authReady;

  return (
    <div className="market-page">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={hideNotification}
        />
      )}
      {/* Header */}
      <div className="market-header">
        <div className="market-title-section">
          <h1 className="market-title">{t('market.title')}</h1>
          <p className="market-subtitle">{t('market.subtitle')}</p>
        </div>
        <button className="market-create-btn" onClick={handleOpenCreateModal}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          {t('market.createBet')}
        </button>
      </div>

      {/* Markets Grid */}
      {marketsLoading ? (
        <div className="market-loading">
          <div className="loading-spinner"></div>
          <p>LOADING MARKETS...</p>
        </div>
      ) : marketsError ? (
        <div className="market-error">
          <div className="error-box">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>ERROR LOADING MARKETS</p>
            <span>{marketsError}</span>
          </div>
        </div>
      ) : markets.length === 0 ? (
        <div className="market-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          <h3>{t('market.noMarkets')}</h3>
          <p>{t('market.beFirst')}</p>
        </div>
      ) : (
        <>
          <div className="market-grid">
            {markets.map((market) => (
              <MarketCard key={market.market_id} market={market} />
            ))}
          </div>

          {hasMore && (
            <div className="market-load-more">
              <button 
                className="market-load-more-btn" 
                onClick={() => setPage(prev => prev + 1)}
                disabled={marketsLoading}
              >
                {marketsLoading ? (
                  <>
                    <div className="btn-spinner"></div>
                    LOADING...
                  </>
                ) : (
                  t('market.loadMore')
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div 
          className={`create-modal-overlay ${isClosing ? 'closing' : ''}`}
          onClick={handleOverlayClick}
        >
          <div 
            className={`create-modal ${isClosing ? 'closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              className="create-modal-close" 
              onClick={handleClose}
              disabled={isCreating}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Header */}
            <div className="create-modal-header">
              <h2>CREATE BET</h2>
              <p>Make a prediction. Challengers buy tickets. Winner takes the pot.</p>
            </div>

            {/* Content */}
            <div className="create-modal-content">
              {/* Prediction */}
              <div className="create-field">
                <label className="create-label">
                  <span>PREDICTION</span>
                  <span className={`create-char-count ${prediction.length < MIN_PREDICTION_LENGTH ? 'invalid' : ''}`}>
                    {prediction.length}/{MAX_PREDICTION_LENGTH} 
                    {prediction.length < MIN_PREDICTION_LENGTH && ` (min ${MIN_PREDICTION_LENGTH})`}
                  </span>
                </label>
                <textarea
                  className={`create-textarea ${prediction.length > 0 && prediction.length < MIN_PREDICTION_LENGTH ? 'invalid' : ''}`}
                  placeholder="What will happen? Be specific and clear..."
                  value={prediction}
                  onChange={handlePredictionChange}
                  rows="3"
                  disabled={isCreating}
                />
              </div>

              {/* Grid: Stake + Expiry */}
              <div className="create-grid">
                <div className="create-field">
                  <label className="create-label">STAKE</label>
                  <div className="create-input-group">
                    <input
                      type="number"
                      className="create-input"
                      placeholder="0.05"
                      value={stake}
                      onChange={handleStakeChange}
                      min={MIN_STAKE}
                      step="0.01"
                      disabled={isCreating}
                    />
                    <span className="create-input-suffix">BNB</span>
                  </div>
                  <div className="create-hint">
                    min {MIN_STAKE} â€¢ ticket price: {calculateTicketPrice()} BNB
                  </div>
                </div>

                <div className="create-field">
                  <label className="create-label">EXPIRES IN</label>
                  <div className="create-pills">
                    {['6', '12', '18', '24', '3d', '7d'].map((time) => (
                      <button
                        key={time}
                        className={`create-pill ${expiry === time ? 'active' : ''}`}
                        onClick={() => !isCreating && setExpiry(time)}
                        disabled={isCreating}
                      >
                        {time.includes('d') ? time : `${time}h`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="create-field">
                <button 
                  className="create-advanced-toggle"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  disabled={isCreating}
                >
                  <span>ADVANCED OPTIONS</span>
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className={showAdvanced ? 'rotated' : ''}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                <div className={`create-advanced-content ${showAdvanced ? 'open' : ''}`}>
                  <div className="create-advanced-inner">
                    {/* Tickets */}
                    <div className="create-subfield">
                      <label className="create-label">TOTAL TICKETS</label>
                      <div className="create-pills">
                        {['1', '10', '50', '100'].map((count) => (
                          <button
                            key={count}
                            className={`create-pill ${tickets === count ? 'active' : ''}`}
                            onClick={() => !isCreating && setTickets(count)}
                            disabled={isCreating}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="create-modal-footer">
              <button 
                className="create-submit-btn" 
                onClick={handleCreateBet}
                disabled={!canSubmit}
              >
                {isCreating ? (
                  <>
                    <div className="btn-spinner"></div>
                    CREATING BET...
                  </>
                ) : (
                  'CREATE BET'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {showDepositModal && user && user.wallet_address && (
        <DepositModal 
          walletAddress={user.wallet_address}
          message={depositMessage}
          onClose={() => {
            setShowDepositModal(false);
            setDepositMessage('');
          }}
        />
      )}
    </div>
  );
}