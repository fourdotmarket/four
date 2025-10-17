import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import Notification from '../components/Notification';
import './a7k2m9p3x6q5w8n4.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function SystemCore() {
  const navigate = useNavigate();
  const { token } = useParams();
  const { user, getFreshToken } = useAuth();
  const { notification, showNotification, hideNotification } = useNotification();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [activeAction, setActiveAction] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [resolutionReason, setResolutionReason] = useState('');
  const [outcome, setOutcome] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isValidAccess, setIsValidAccess] = useState(false);
  const hasValidatedRef = useRef(false);

  // No sensitive data in frontend - all handled server-side
  const [protocolFee, setProtocolFee] = useState('');

  // Token Validation: Check if token matches stored token
  useEffect(() => {
    if (hasValidatedRef.current) return;
    
    const storedToken = sessionStorage.getItem('admin_token');
    
    if (!token || !storedToken || token !== storedToken) {
      console.log('⛔ Invalid or expired admin token');
      navigate('/');
      return;
    }
    
    hasValidatedRef.current = true;
    setIsValidAccess(true);
  }, [token, navigate]);

  // Security Check: Only allow admin user
  useEffect(() => {
    if (user && user.username !== 'Admin') {
      console.log('⛔ Unauthorized access attempt to admin panel');
      navigate('/');
    }
  }, [user, navigate]);

  // Self-Destruct: Clear token when leaving the page
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('admin_token');
      console.log('🔒 Admin token destroyed - route no longer valid');
    };
  }, []);

  useEffect(() => {
    if (user && user.username === 'Admin') {
      fetchAllMarkets();
    }
  }, [user]);

  const fetchAllMarkets = async () => {
    try {
      setLoading(true);
      
      // Fetch ALL markets regardless of status
      const { data, error: fetchError } = await supabase
        .from('markets')
        .select(`
          market_id,
          question,
          creator_username,
          creator_wallet,
          stake,
          ticket_price,
          total_tickets,
          tickets_sold,
          deadline,
          created_at_timestamp,
          tx_hash,
          block_number,
          status,
          outcome,
          resolution_reason,
          banner_url,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setMarkets(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching markets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Blockchain Admin Operations
  const handlePauseContract = async () => {
    try {
      setActionLoading(true);
      const token = await getFreshToken();

      const response = await fetch('/api/admin-pause-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'pause'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to pause contract');
      }

      showNotification(`Contract paused! TX: ${result.txHash}`, 'success');
      
    } catch (err) {
      console.error('Error pausing contract:', err);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnpauseContract = async () => {
    try {
      setActionLoading(true);
      const token = await getFreshToken();

      const response = await fetch('/api/admin-pause-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'unpause'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to unpause contract');
      }

      showNotification(`Contract unpaused! TX: ${result.txHash}`, 'success');
      
    } catch (err) {
      console.error('Error unpausing contract:', err);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetProtocolFee = async () => {
    if (!protocolFee || isNaN(protocolFee) || protocolFee < 0 || protocolFee > 1000) {
      showNotification('Please enter a valid fee (0-1000 bps)', 'warning');
      return;
    }

    try {
      setActionLoading(true);
      const token = await getFreshToken();

      const response = await fetch('/api/admin-set-protocol-fee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          feeBps: parseInt(protocolFee)
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to set protocol fee');
      }

      showNotification(`Protocol fee updated! Old: ${result.oldFee} bps, New: ${result.newFee} bps`, 'success');
      setProtocolFee('');
      
    } catch (err) {
      console.error('Error setting protocol fee:', err);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawProtocolFees = async () => {
    try {
      setActionLoading(true);
      const token = await getFreshToken();

      const response = await fetch('/api/admin-withdraw-fees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to withdraw protocol fees');
      }

      showNotification(`Withdrawn ${result.amount} BNB! TX: ${result.txHash}`, 'success');
      
    } catch (err) {
      console.error('Error withdrawing protocol fees:', err);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockchainResolve = async (market) => {
    if (outcome === null) {
      showNotification('Please select an outcome first', 'warning');
      return;
    }

    try {
      setActionLoading(true);
      const token = await getFreshToken();

      const response = await fetch('/api/admin-blockchain-resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: market.market_id,
          outcome: outcome
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resolve market on blockchain');
      }

      showNotification(`Market resolved on blockchain! TX: ${result.txHash}`, 'success');
      
      // Also update database with reason if provided
      if (resolutionReason.trim()) {
        await fetch('/api/admin-resolve-market', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            market_id: market.market_id,
            outcome: outcome,
            resolution_reason: resolutionReason.trim()
          })
        });
      }

      setActiveAction(null);
      setSelectedMarket(null);
      setResolutionReason('');
      setOutcome(null);
      fetchAllMarkets();
      
    } catch (err) {
      console.error('Error resolving market on blockchain:', err);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockchainCancel = async (market) => {
    try {
      setActionLoading(true);
      const token = await getFreshToken();

      const response = await fetch('/api/admin-blockchain-cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: market.market_id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel market on blockchain');
      }

      showNotification(`Market cancelled on blockchain! TX: ${result.txHash}`, 'success');
      fetchAllMarkets();
      
    } catch (err) {
      console.error('Error cancelling market on blockchain:', err);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmergencyWithdraw = async (market) => {
    try {
      setActionLoading(true);
      const token = await getFreshToken();

      const response = await fetch('/api/admin-emergency-withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: market.market_id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to emergency withdraw');
      }

      showNotification(`Emergency withdrawn ${result.amount} BNB! TX: ${result.txHash}`, 'success');
      fetchAllMarkets();
      
    } catch (err) {
      console.error('Error emergency withdrawing:', err);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openResolveModal = (market) => {
    setSelectedMarket(market);
    setActiveAction('resolve');
    setResolutionReason('');
    setOutcome(null);
  };

  const closeModal = () => {
    setActiveAction(null);
    setSelectedMarket(null);
    setResolutionReason('');
    setOutcome(null);
  };

  const getStatusBadge = (status) => {
    if (status === 'active') return <span className="admin-badge status-active">ACTIVE</span>;
    if (status === 'resolved') return <span className="admin-badge status-resolved">RESOLVED</span>;
    if (status === 'awaiting_resolution') return <span className="admin-badge status-pending">PENDING</span>;
    if (status === 'cancelled') return <span className="admin-badge status-cancelled">CANCELLED</span>;
    return <span className="admin-badge status-cancelled">{status.toUpperCase()}</span>;
  };

  // Filter markets based on active tab
  const getFilteredMarkets = () => {
    const now = Math.floor(Date.now() / 1000);
    
    switch (activeTab) {
      case 'all':
        return markets;
      case 'active':
        return markets.filter(m => m.status === 'active' && m.deadline >= now);
      case 'expired':
        return markets.filter(m => m.status === 'active' && m.deadline < now);
      case 'resolved':
        return markets.filter(m => m.status === 'resolved');
      case 'cancelled':
        return markets.filter(m => m.status === 'cancelled');
      default:
        return markets;
    }
  };

  const filteredMarkets = getFilteredMarkets();

  // Don't render anything until token is validated
  if (!isValidAccess || !user || user.username !== 'Admin') {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const activeMarketsCount = markets.filter(m => m.status === 'active' && m.deadline >= now).length;
  const expiredMarketsCount = markets.filter(m => m.status === 'active' && m.deadline < now).length;
  const resolvedMarketsCount = markets.filter(m => m.status === 'resolved').length;
  const cancelledMarketsCount = markets.filter(m => m.status === 'cancelled').length;

  return (
    <div className="admin-page-new">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={hideNotification}
        />
      )}

      {/* Top Header */}
      <div className="admin-header-bar">
        <div className="admin-header-left">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <div>
            <h1 className="admin-header-title">ADMIN CONTROL PANEL</h1>
            <p className="admin-header-subtitle">Blockchain & Market Management</p>
          </div>
        </div>
        <div className="admin-header-right">
          <button 
            className="admin-exit-btn" 
            onClick={() => {
              sessionStorage.removeItem('admin_token');
              navigate('/');
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            EXIT
          </button>
        </div>
      </div>


      {/* Global Contract Operations */}
      <div className="admin-global-operations">
        <h3>CONTRACT OPERATIONS</h3>
        <div className="admin-operation-grid">
          <div className="admin-operation-card">
            <div className="admin-operation-icon">⏸️</div>
            <h4>Pause Contract</h4>
            <p>Stop all contract operations</p>
            <button 
              onClick={handlePauseContract}
              disabled={actionLoading}
              className="admin-op-btn danger"
            >
              PAUSE
            </button>
          </div>

          <div className="admin-operation-card">
            <div className="admin-operation-icon">▶️</div>
            <h4>Unpause Contract</h4>
            <p>Resume contract operations</p>
            <button 
              onClick={handleUnpauseContract}
              disabled={actionLoading}
              className="admin-op-btn success"
            >
              UNPAUSE
            </button>
          </div>

          <div className="admin-operation-card">
            <div className="admin-operation-icon">💰</div>
            <h4>Withdraw Protocol Fees</h4>
            <p>Collect accumulated fees</p>
            <button 
              onClick={handleWithdrawProtocolFees}
              disabled={actionLoading}
              className="admin-op-btn primary"
            >
              WITHDRAW
            </button>
          </div>

          <div className="admin-operation-card">
            <div className="admin-operation-icon">⚙️</div>
            <h4>Set Protocol Fee</h4>
            <div className="admin-fee-input-group">
              <input
                type="number"
                value={protocolFee}
                onChange={(e) => setProtocolFee(e.target.value)}
                placeholder="Fee in bps (0-1000)"
                min="0"
                max="1000"
              />
              <span className="admin-fee-helper">{protocolFee ? `${protocolFee / 100}%` : '0%'}</span>
            </div>
            <button 
              onClick={handleSetProtocolFee}
              disabled={actionLoading || !protocolFee}
              className="admin-op-btn warning"
            >
              SET FEE
            </button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="admin-stats-bar">
        <div className="admin-stat-card">
          <div className="admin-stat-label">ACTIVE</div>
          <div className="admin-stat-value">{activeMarketsCount}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">EXPIRED</div>
          <div className="admin-stat-value">{expiredMarketsCount}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">RESOLVED</div>
          <div className="admin-stat-value">{resolvedMarketsCount}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">CANCELLED</div>
          <div className="admin-stat-value">{cancelledMarketsCount}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">TOTAL</div>
          <div className="admin-stat-value">{markets.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          ALL ({markets.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          ACTIVE ({activeMarketsCount})
        </button>
        <button
          className={`admin-tab ${activeTab === 'expired' ? 'active' : ''}`}
          onClick={() => setActiveTab('expired')}
        >
          EXPIRED ({expiredMarketsCount})
        </button>
        <button
          className={`admin-tab ${activeTab === 'resolved' ? 'active' : ''}`}
          onClick={() => setActiveTab('resolved')}
        >
          RESOLVED ({resolvedMarketsCount})
        </button>
        <button
          className={`admin-tab ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          CANCELLED ({cancelledMarketsCount})
        </button>
      </div>

      {/* Markets Grid */}
      {loading ? (
        <div className="admin-loading">
          <div className="loading-spinner"></div>
          <p>LOADING MARKETS...</p>
        </div>
      ) : error ? (
        <div className="admin-error">
          <p>ERROR: {error}</p>
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="admin-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3>NO MARKETS FOUND</h3>
          <p>No markets match the current filter</p>
        </div>
      ) : (
        <div className="admin-markets-grid-new">
          {filteredMarkets.map((market) => {
            const isExpired = Math.floor(Date.now() / 1000) > market.deadline;
            const canResolve = (market.status === 'active' && isExpired) || market.status === 'awaiting_resolution';

            return (
              <div key={market.market_id} className="admin-market-card-new">
                <div className="admin-market-header-new">
                  <div className="admin-market-id">#{market.market_id}</div>
                  {getStatusBadge(market.status)}
                </div>

                <div className="admin-market-question-new">{market.question}</div>

                <div className="admin-market-details-new">
                  <div className="admin-detail-row">
                    <span className="admin-detail-label-new">Creator:</span>
                    <span className="admin-detail-value-new">{market.creator_username}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label-new">Stake:</span>
                    <span className="admin-detail-value-new">{market.stake} BNB</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label-new">Tickets:</span>
                    <span className="admin-detail-value-new">{market.tickets_sold}/{market.total_tickets}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label-new">Deadline:</span>
                    <span className="admin-detail-value-new">{new Date(market.deadline * 1000).toLocaleString()}</span>
                  </div>
                </div>

                {market.status === 'resolved' && (
                  <div className="admin-resolution-new">
                    <div className="admin-resolution-outcome-new">
                      <span className="admin-resolution-label-new">OUTCOME:</span>
                      <span className={`admin-resolution-value-new ${market.outcome ? 'outcome-yes' : 'outcome-no'}`}>
                        {market.outcome ? 'YES (MAKER WON)' : 'NO (CHALLENGERS WON)'}
                      </span>
                    </div>
                    {market.resolution_reason && (
                      <div className="admin-resolution-reason-new">
                        <span className="admin-resolution-label-new">REASON:</span>
                        <p>{market.resolution_reason}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="admin-market-actions-new">
                  {canResolve && (
                    <button
                      className="admin-action-btn-new resolve"
                      onClick={() => openResolveModal(market)}
                      disabled={actionLoading}
                      title="Resolve on blockchain"
                    >
                      ⚖️ RESOLVE
                    </button>
                  )}
                  {market.status !== 'resolved' && market.status !== 'cancelled' && (
                    <button
                      className="admin-action-btn-new cancel"
                      onClick={() => handleBlockchainCancel(market)}
                      disabled={actionLoading}
                      title="Cancel on blockchain"
                    >
                      ❌ CANCEL
                    </button>
                  )}
                  {market.status === 'cancelled' && (
                    <button
                      className="admin-action-btn-new emergency"
                      onClick={() => handleEmergencyWithdraw(market)}
                      disabled={actionLoading}
                      title="Emergency withdraw funds"
                    >
                      🚨 EMERGENCY
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve Modal */}
      {activeAction === 'resolve' && selectedMarket && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>RESOLVE MARKET #{selectedMarket.market_id}</h2>
              <button className="admin-modal-close" onClick={closeModal}>×</button>
            </div>

            <div className="admin-modal-body">
              <div className="admin-modal-question">{selectedMarket.question}</div>

              <div className="admin-modal-section">
                <label className="admin-modal-label">SELECT WINNING SIDE</label>
                <div className="admin-outcome-buttons">
                  <button
                    className={`admin-outcome-btn ${outcome === true ? 'selected yes' : ''}`}
                    onClick={() => setOutcome(true)}
                  >
                    YES (MAKER WINS)
                  </button>
                  <button
                    className={`admin-outcome-btn ${outcome === false ? 'selected no' : ''}`}
                    onClick={() => setOutcome(false)}
                  >
                    NO (CHALLENGERS WIN)
                  </button>
                </div>
              </div>

              <div className="admin-modal-section">
                <label className="admin-modal-label">RESOLUTION REASON (Optional for DB)</label>
                <textarea
                  className="admin-modal-textarea"
                  placeholder="Provide a reason for this resolution (will be saved to database)..."
                  value={resolutionReason}
                  onChange={(e) => setResolutionReason(e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                <div className="admin-char-count">{resolutionReason.length}/500</div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="admin-modal-btn cancel" onClick={closeModal}>
                CANCEL
              </button>
              <button
                className="admin-modal-btn confirm"
                onClick={() => handleBlockchainResolve(selectedMarket)}
                disabled={actionLoading || outcome === null}
              >
                {actionLoading ? 'RESOLVING ON BLOCKCHAIN...' : 'RESOLVE ON BLOCKCHAIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
