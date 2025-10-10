import React, { useState } from 'react';
import './Market.css';
import { useAuth } from '../hooks/useAuth';
import MarketCard from '../components/MarketCard';
import { useMarkets } from '../hooks/useMarkets';
import { usePrivy } from '@privy-io/react-auth';

const CONTRACT_ADDRESS = "0xB05bAeff61e6E2CfB85d383911912C3248e3214f";
const MIN_STAKE = 0.05;
const MIN_PREDICTION_LENGTH = 50;
const MAX_PREDICTION_LENGTH = 256;

export default function Market() {
  const { user, accessToken } = useAuth();
  const { getAccessToken } = usePrivy();
  const { markets, loading: marketsLoading, error: marketsError } = useMarkets();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [prediction, setPrediction] = useState('');
  const [stake, setStake] = useState('0.05');
  const [expiry, setExpiry] = useState('24');
  const [tickets, setTickets] = useState('100');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [banner, setBanner] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const allowedChars = 'abcdefghijklmnopqrstuvwxyz0123456789 .,?!-';

  // Map expiry to duration index
  const expiryToDuration = {
    '6': 0, '12': 1, '24': 2, '3d': 3, '7d': 4
  };

  // Map tickets to ticketAmount index
  const ticketsToAmount = {
    '1': 0, '10': 1, '50': 2, '100': 3
  };

  const handleBannerSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setBanner(file);
      const reader = new FileReader();
      reader.onloadend = () => setBannerPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeBanner = () => {
    setBanner(null);
    setBannerPreview('');
  };
  
  const handlePredictionChange = (e) => {
    const value = e.target.value.toLowerCase();
    const filtered = value.split('').filter(char => allowedChars.includes(char)).join('');
    if (filtered.length <= MAX_PREDICTION_LENGTH) {
      setPrediction(filtered);
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
    setBanner(null);
    setBannerPreview('');
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

  const handleCreateBet = async () => {
    // Validation
    if (!prediction.trim()) {
      alert('Please enter a prediction');
      return;
    }

    if (prediction.length < MIN_PREDICTION_LENGTH) {
      alert(`Prediction must be at least ${MIN_PREDICTION_LENGTH} characters (currently ${prediction.length})`);
      return;
    }

    const stakeValue = parseFloat(stake);
    if (!stake || isNaN(stakeValue) || stakeValue < MIN_STAKE) {
      alert(`Please enter a valid stake amount (minimum ${MIN_STAKE} BNB)`);
      return;
    }

    if (!user) {
      alert('Please sign in to create a bet');
      return;
    }

    try {
      setIsCreating(true);

      const duration = expiryToDuration[expiry];
      const ticketAmount = ticketsToAmount[tickets];

      // Get fresh JWT token
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      console.log('📝 Creating market with JWT authentication');

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
        console.error('❌ Server error:', text.substring(0, 200));
        throw new Error('Server error occurred. Check server logs.');
      }

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to create bet');
      }
      
      console.log('✅ Market created!');
      console.log('TX Hash:', result.txHash);
      console.log('Market ID:', result.marketId);

      // Banner upload would go here if needed
      if (banner) {
        console.log('📸 Banner upload for market:', result.marketId);
      }

      setTimeout(() => {
        handleClose();
      }, 1500);

    } catch (error) {
      console.error('❌ Error creating bet:', error);
      setIsCreating(false);
      
      // Handle specific error messages
      if (error.message.includes('Authentication required')) {
        alert('Please sign in again to create a bet');
      } else if (error.message.includes('Too many markets created')) {
        alert('You have created too many markets recently. Please wait before creating another.');
      } else {
        alert(`Failed to create bet: ${error.message}`);
      }
    }
  };

  const isPredictionValid = prediction.length >= MIN_PREDICTION_LENGTH;
  const isStakeValid = parseFloat(stake) >= MIN_STAKE;
  const canSubmit = isPredictionValid && isStakeValid && !isCreating;

  return (
    <div className="market-page">
      {/* Header */}
      <div className="market-header">
        <div className="market-title-section">
          <h1 className="market-title">PREDICTION MARKETS</h1>
          <p className="market-subtitle">Create or challenge predictions on the blockchain</p>
        </div>
        <button className="market-create-btn" onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          CREATE BET
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
          <h3>NO ACTIVE MARKETS</h3>
          <p>Be the first to create a prediction market</p>
        </div>
      ) : (
        <div className="market-grid">
          {markets.map((market) => (
            <MarketCard key={market.market_id} market={market} />
          ))}
        </div>
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
                  placeholder="what will happen? be specific and clear..."
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
                    min {MIN_STAKE} • ticket price: {calculateTicketPrice()} BNB
                  </div>
                </div>

                <div className="create-field">
                  <label className="create-label">EXPIRES IN</label>
                  <div className="create-pills">
                    {['6', '12', '24', '3d', '7d'].map((time) => (
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

                    {/* Banner */}
                    <div className="create-subfield">
                      <label className="create-label">
                        <span>BANNER IMAGE</span>
                        <span className="create-optional">OPTIONAL</span>
                      </label>
                      {bannerPreview ? (
                        <div className="create-banner-preview">
                          <img src={bannerPreview} alt="Banner" />
                          <button 
                            className="create-banner-remove"
                            onClick={removeBanner}
                            disabled={isCreating}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <label className="create-banner-upload">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                          <span>Click to upload image</span>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleBannerSelect}
                            style={{ display: 'none' }}
                            disabled={isCreating}
                          />
                        </label>
                      )}
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
    </div>
  );
}