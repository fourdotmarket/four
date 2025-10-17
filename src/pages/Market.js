import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
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
  const { markets, loading: marketsLoading, error: marketsError, hasMore, refetch } = useMarkets(page);
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
  const [isBeautifying, setIsBeautifying] = useState(false);
  const [beautifiedPrediction, setBeautifiedPrediction] = useState('');
  const [showBeautified, setShowBeautified] = useState(false);
  const [twitterLink, setTwitterLink] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [aiDecided, setAiDecided] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [currentTimeframe, setCurrentTimeframe] = useState('24');
  const debounceTimerRef = useRef(null);
  const rateLimitTimerRef = useRef(null);

  // Allow English, Chinese, numbers, and common punctuation (including $)
  const allowedChars = /^[\u4e00-\u9fa5a-zA-Z0-9\s.,?!$-]+$/;

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
        setShowBeautified(false); // Reset beautified state when user types
        setAiDecided(false); // Reset AI decision when user changes prediction
        
        // Clear previous timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        
        // Set new timer for AI beautification (0.6 seconds after typing stops)
        if (value.trim().length >= 10 && !rateLimited) {
          debounceTimerRef.current = setTimeout(() => {
            beautifyPrediction(value, currentTimeframe);
          }, 600);
        }
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
    setTwitterLink('');
    setWebsiteLink('');
    setShowAdvanced(false);
    setIsCreating(false);
    setBeautifiedPrediction('');
    setShowBeautified(false);
    setIsBeautifying(false);
    setAiDecided(false);
    setCurrentTimeframe('24');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  const beautifyPrediction = async (text, timeframeAtRequest) => {
    // Rate limiting check
    if (rateLimited) {
      console.log('⏸️ Rate limited - try again later');
      return;
    }

    // Track request count
    setRequestCount(prev => {
      const newCount = prev + 1;
      
      // If 10 requests in 5 seconds, rate limit for 1 hour
      if (newCount >= 10) {
        setRateLimited(true);
        console.warn('🚫 Rate limit exceeded! Blocked for 1 hour.');
        
        if (rateLimitTimerRef.current) {
          clearTimeout(rateLimitTimerRef.current);
        }
        
        rateLimitTimerRef.current = setTimeout(() => {
          setRateLimited(false);
          setRequestCount(0);
          console.log('✅ Rate limit reset');
        }, 3600000); // 1 hour
        
        return newCount;
      }
      
      // Reset count after 5 seconds
      setTimeout(() => {
        setRequestCount(prev => Math.max(0, prev - 1));
      }, 5000);
      
      return newCount;
    });

    try {
      setIsBeautifying(true);
      console.log('🤖 Calling AI to beautify prediction...');

      const response = await axios.post('/api/beautify-prediction', {
        prediction: text,
        timeframe: timeframeAtRequest
      });

      console.log('📥 AI Response:', response.data);

      // Check if timeframe changed during request - skip if it did
      if (timeframeAtRequest !== currentTimeframe) {
        console.log('⏭️ Timeframe changed during AI generation - skipping result');
        setIsBeautifying(false);
        return;
      }

      if (response.data && response.data.success && response.data.beautified) {
        const beautified = response.data.beautified;
        console.log(`📏 Beautified length: ${beautified.length} chars`);
        
        // Validate length (60-240 characters)
        if (beautified.length >= 60 && beautified.length <= 240) {
          setBeautifiedPrediction(beautified);
          setShowBeautified(true);
          console.log('✅ AI suggestion shown:', beautified);
        } else {
          console.warn(`⚠️ AI response length invalid: ${beautified.length} (need 60-240)`);
          // Still set it for debugging
          setBeautifiedPrediction(beautified);
          setShowBeautified(true);
        }
      } else {
        console.warn('⚠️ Invalid response structure:', response.data);
      }
    } catch (error) {
      console.error('❌ AI beautification failed:', error);
      // Silently fail - don't show error to user
    } finally {
      setIsBeautifying(false);
    }
  };

  const handleAcceptBeautified = () => {
    setPrediction(beautifiedPrediction);
    setShowBeautified(false);
    setAiDecided(true);
  };

  const handleCancelBeautified = () => {
    setShowBeautified(false);
    setBeautifiedPrediction('');
    setAiDecided(true);
  };

  const handleExpiryChange = (newExpiry) => {
    setExpiry(newExpiry);
    setCurrentTimeframe(newExpiry);
    setShowBeautified(false); // Hide AI suggestion when timeframe changes
    setAiDecided(false); // Reset AI decision
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
          ticketAmount: ticketAmount,
          twitterLink: twitterLink.trim() || null,
          websiteLink: websiteLink.trim() || null
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

      // Refetch markets to show the new market immediately
      setTimeout(() => {
        refetch();
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
  
  // Block submission if:
  // 1. Prediction >= 10 chars AND AI suggestion is showing (waiting for accept/decline)
  // 2. Prediction >= 10 chars AND AI is beautifying
  // 3. Prediction >= 10 chars AND no AI decision made yet AND not beautifying
  const needsAiDecision = prediction.trim().length >= 10 && !aiDecided && !isBeautifying;
  const waitingForAi = showBeautified || isBeautifying;
  
  const canSubmit = isPredictionValid && isStakeValid && !isCreating && authReady && !needsAiDecision && !waitingForAi;

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
                
                {/* AI Beautification Status */}
                {isBeautifying && (
                  <div className="ai-beautifying">
                    <div className="ai-spinner"></div>
                    <span>AI is improving your prediction...</span>
                  </div>
                )}

                {/* AI Beautified Suggestion */}
                {showBeautified && beautifiedPrediction && !isBeautifying && (
                  <div className="ai-suggestion">
                    <div className="ai-suggestion-header">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                        <path d="M2 17l10 5 10-5"></path>
                        <path d="M2 12l10 5 10-5"></path>
                      </svg>
                      <span>AI SUGGESTION</span>
                    </div>
                    <div className="ai-suggestion-text">{beautifiedPrediction}</div>
                    <div className="ai-suggestion-actions">
                      <button 
                        className="ai-accept-btn"
                        onClick={handleAcceptBeautified}
                        type="button"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Use This
                      </button>
                      <button 
                        className="ai-cancel-btn"
                        onClick={handleCancelBeautified}
                        type="button"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Keep Original
                      </button>
                    </div>
                  </div>
                )}
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
                        onClick={() => !isCreating && handleExpiryChange(time)}
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

                    {/* Twitter Link */}
                    <div className="create-subfield">
                      <label className="create-label">
                        <span>TWITTER / X LINK</span>
                        <span style={{ fontSize: '10px', color: '#888', fontWeight: 'normal' }}>(OPTIONAL)</span>
                      </label>
                      <input
                        type="url"
                        className="create-input"
                        placeholder="https://twitter.com/username/status/..."
                        value={twitterLink}
                        onChange={(e) => setTwitterLink(e.target.value)}
                        disabled={isCreating}
                        style={{ width: '100%' }}
                      />
                      <div className="create-hint" style={{ marginTop: '4px' }}>
                        Link to a relevant tweet or X post
                      </div>
                    </div>

                    {/* Website Link */}
                    <div className="create-subfield">
                      <label className="create-label">
                        <span>WEBSITE LINK</span>
                        <span style={{ fontSize: '10px', color: '#888', fontWeight: 'normal' }}>(OPTIONAL)</span>
                      </label>
                      <input
                        type="url"
                        className="create-input"
                        placeholder="https://example.com/..."
                        value={websiteLink}
                        onChange={(e) => setWebsiteLink(e.target.value)}
                        disabled={isCreating}
                        style={{ width: '100%' }}
                      />
                      <div className="create-hint" style={{ marginTop: '4px' }}>
                        Link to a relevant website or article
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