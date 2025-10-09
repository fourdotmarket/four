import React, { useState } from 'react';
import './Market.css';
import { ethers } from 'ethers';
import { useAuth } from '../hooks/useAuth';

const CONTRACT_ADDRESS = "0xB05bAeff61e6E2CfB85d383911912C3248e3214f";
const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

// Minimal ABI - only what we need for createMarket
const CONTRACT_ABI = [
  "function createMarket(string memory _question, uint8 _duration, uint8 _ticketAmount) external payable returns (uint256)"
];

export default function Market() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [prediction, setPrediction] = useState('');
  const [stake, setStake] = useState('0.05');
  const [expiry, setExpiry] = useState('6');
  const [tickets, setTickets] = useState('100');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [banner, setBanner] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState('');

  const allowedChars = 'qwertyuiopasdfghjklzxcvbnm,.-;:1234567890 ';
  const MIN_STAKE = 0.05;

  // Map expiry to duration index
  const expiryToDuration = {
    '6': 0,   // 6h
    '12': 1,  // 12h
    '18': 2,  // 18h
    '24': 3,  // 24h
    '3d': 4,  // 3 days
    '7d': 5   // 7 days
  };

  // Map tickets to ticketAmount index
  const ticketsToAmount = {
    '1': 0,   // 1 ticket
    '10': 1,  // 10 tickets
    '50': 2,  // 50 tickets
    '100': 3  // 100 tickets
  };

  const handleBannerDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setBanner(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setBanner(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result);
      };
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
    if (filtered.length <= 256) {
      setPrediction(filtered);
    }
  };

  const handleStakeChange = (e) => {
    const value = e.target.value;
    // Allow empty string for editing
    if (value === '') {
      setStake('');
      return;
    }
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= MIN_STAKE) {
      setStake(value);
    } else if (!isNaN(numValue) && numValue < MIN_STAKE) {
      setStake(MIN_STAKE.toString());
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
    setExpiry('6');
    setTickets('100');
    setShowMoreOptions(false);
    setBanner(null);
    setBannerPreview('');
    setCreationStatus('');
    setIsCreating(false);
  };

  const handleClose = () => {
    if (isCreating) return; // Prevent closing while creating
    
    setIsClosing(true);
    setTimeout(() => {
      setShowCreateModal(false);
      setIsClosing(false);
      resetForm();
    }, 300);
  };

  const handleOverlayMouseDown = (e) => {
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

    const stakeValue = parseFloat(stake);
    if (!stake || isNaN(stakeValue) || stakeValue < MIN_STAKE) {
      alert(`Please enter a valid stake amount (minimum ${MIN_STAKE} BNB)`);
      return;
    }

    if (!user || !user.user_id) {
      alert('User not found. Please refresh and try again.');
      return;
    }

    try {
      setIsCreating(true);
      setCreationStatus('Preparing transaction...');

      // Convert parameters
      const duration = expiryToDuration[expiry];
      const ticketAmount = ticketsToAmount[tickets];

      console.log('📝 Creating market with:', {
        user_id: user.user_id,
        question: prediction,
        stakeAmount: stake,
        duration,
        ticketAmount
      });

      setCreationStatus('Submitting to blockchain...');

      // Call backend API to create the bet
      const response = await fetch('/api/create-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.user_id,
          question: prediction,
          stakeAmount: stake,
          duration: duration,
          ticketAmount: ticketAmount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create bet');
      }

      const result = await response.json();
      
      console.log('✅ Market created!');
      console.log('TX Hash:', result.txHash);
      console.log('Market ID:', result.marketId);

      setCreationStatus(`Success! TX: ${result.txHash.slice(0, 10)}...`);

      // Optional: Upload banner to storage if exists
      if (banner) {
        console.log('📸 Banner would be uploaded here for market:', result.marketId);
        // TODO: Implement banner upload to IPFS or cloud storage
      }

      // Show success for 2 seconds then close
      setTimeout(() => {
        handleClose();
      }, 2000);

    } catch (error) {
      console.error('❌ Error creating bet:', error);
      setCreationStatus('');
      setIsCreating(false);
      alert(`Failed to create bet: ${error.message}`);
    }
  };

  return (
    <div className="market-page">
      <div className="market-header">
        <h1></h1>
        <button className="market-create-btn" onClick={() => setShowCreateModal(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          CREATE BET
        </button>
      </div>

      {showCreateModal && (
        <div 
          className={`create-modal-overlay ${isClosing ? 'closing' : ''}`} 
          onMouseDown={handleOverlayMouseDown}
        >
          <div 
            className={`create-modal ${isClosing ? 'closing' : ''}`} 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="create-modal-close" 
              onClick={handleClose}
              disabled={isCreating}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div className="create-modal-header">
              <h2>Create Bet</h2>
              <p className="create-modal-explanation">
                Challengers buy tickets. If you're wrong, challengers split your stake.
              </p>
            </div>

            <div className="create-modal-grid">
              {/* Prediction - REQUIRED */}
              <div className="create-field create-field-full">
                <label className="create-label">
                  <span>PREDICTION *</span>
                  <span className="create-char-count">{prediction.length}/256</span>
                </label>
                <textarea
                  className="create-textarea"
                  placeholder="enter your prediction..."
                  value={prediction}
                  onChange={handlePredictionChange}
                  rows="3"
                  disabled={isCreating}
                />
              </div>

              {/* Stake - REQUIRED, MIN 0.05 BNB */}
              <div className="create-field">
                <label className="create-label">
                  <span>STAKE *</span>
                </label>
                <div className="create-input-wrapper">
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
                  <span className="create-input-badge">BNB</span>
                </div>
                <div className="create-hint">
                  min {MIN_STAKE} BNB • {tickets} tickets × {calculateTicketPrice()} BNB
                </div>
              </div>

              {/* Expiry - REQUIRED */}
              <div className="create-field">
                <label className="create-label">
                  <span>EXPIRY *</span>
                </label>
                <div className="create-pills-expiry">
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

              {/* More Options */}
              <div className="create-field create-field-full">
                <button 
                  className="create-more-toggle"
                  onClick={() => setShowMoreOptions(!showMoreOptions)}
                  disabled={isCreating}
                >
                  <span>MORE OPTIONS</span>
                  <svg 
                    width="14" 
                    height="14" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className={showMoreOptions ? 'rotated' : ''}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                <div className={`create-more-content ${showMoreOptions ? 'open' : ''}`}>
                  <div className="create-more-inner">
                    {/* Tickets */}
                    <div className="create-subfield">
                      <label className="create-label">
                        <span>TICKETS</span>
                      </label>
                      <div className="create-pills">
                        {['1', '10', '50', '100'].map((count) => (
                          <button
                            key={count}
                            className={`create-pill ${tickets === count ? 'active' : ''}`}
                            onClick={() => setTickets(count)}
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
                        <span>BANNER</span>
                        <span className="create-optional">OPTIONAL</span>
                      </label>
                      <div 
                        className="create-banner-drop"
                        onDrop={handleBannerDrop}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        {bannerPreview ? (
                          <div className="create-banner-preview">
                            <img src={bannerPreview} alt="Banner preview" />
                            <button 
                              className="create-banner-remove"
                              onClick={removeBanner}
                              type="button"
                              disabled={isCreating}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <label className="create-banner-upload">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                              <circle cx="8.5" cy="8.5" r="1.5"></circle>
                              <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                            <span className="create-banner-text">Drop or click to upload</span>
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
            </div>

            <div className="create-modal-footer">
              {creationStatus && (
                <div style={{ 
                  textAlign: 'center', 
                  color: 'var(--color-yellow-primary)', 
                  fontSize: '12px',
                  marginBottom: '12px',
                  fontWeight: '600'
                }}>
                  {creationStatus}
                </div>
              )}
              <button 
                className="create-submit-btn" 
                onClick={handleCreateBet}
                disabled={isCreating}
                style={{ opacity: isCreating ? 0.6 : 1, cursor: isCreating ? 'not-allowed' : 'pointer' }}
              >
                {isCreating ? 'CREATING...' : 'CREATE BET'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}