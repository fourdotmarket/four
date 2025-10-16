import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../hooks/useAuth';
import './Admin.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function Admin() {
  const navigate = useNavigate();
  const { user, getFreshToken } = useAuth();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [resolutionReason, setResolutionReason] = useState('');
  const [outcome, setOutcome] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Security Check: Only allow admin
  useEffect(() => {
    if (user && user.username !== 'Admin') {
      console.log('⛔ Unauthorized access attempt to admin panel');
      navigate('/');
    }
  }, [user, navigate]);

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

  const handleResolveMarket = async () => {
    if (!selectedMarket || outcome === null || !resolutionReason.trim()) {
      alert('Please select outcome and provide resolution reason');
      return;
    }

    try {
      setActionLoading(true);
      const token = await getFreshToken();

      const response = await fetch('/api/admin-resolve-market', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: selectedMarket.market_id,
          outcome: outcome,
          resolution_reason: resolutionReason.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resolve market');
      }

      alert('✅ Market resolved successfully!');
      setActiveAction(null);
      setSelectedMarket(null);
      setResolutionReason('');
      setOutcome(null);
      fetchAllMarkets();
      
    } catch (err) {
      console.error('Error resolving market:', err);
      alert(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelMarket = async (market) => {
    if (!window.confirm(`Are you sure you want to CANCEL this market?\n\n"${market.question}"\n\nThis will allow all participants to claim refunds.`)) {
      return;
    }

    try {
      setActionLoading(true);
      const token = await getFreshToken();

      const response = await fetch('/api/admin-cancel-market', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: market.market_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel market');
      }

      alert('✅ Market cancelled successfully!');
      fetchAllMarkets();
      
    } catch (err) {
      console.error('Error cancelling market:', err);
      alert(`❌ Error: ${err.message}`);
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
    return <span className="admin-badge status-cancelled">CANCELLED</span>;
  };

  if (!user || user.username !== 'Admin') {
    return null;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-left">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <div>
            <h1 className="admin-title">ADMINISTRATOR PANEL</h1>
            <p className="admin-subtitle">Market Management & Resolution System</p>
          </div>
        </div>
        <button className="admin-logout-btn" onClick={() => navigate('/')}>
          EXIT
        </button>
      </div>

      {loading ? (
        <div className="admin-loading">
          <div className="loading-spinner"></div>
          <p>LOADING MARKETS...</p>
        </div>
      ) : error ? (
        <div className="admin-error">
          <p>ERROR: {error}</p>
        </div>
      ) : (
        <>
          <div className="admin-stats">
            <div className="admin-stat-card">
              <div className="admin-stat-value">{markets.filter(m => m.status === 'active').length}</div>
              <div className="admin-stat-label">ACTIVE MARKETS</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{markets.filter(m => m.status === 'awaiting_resolution').length}</div>
              <div className="admin-stat-label">PENDING RESOLUTION</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{markets.filter(m => m.status === 'resolved').length}</div>
              <div className="admin-stat-label">RESOLVED</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{markets.length}</div>
              <div className="admin-stat-label">TOTAL MARKETS</div>
            </div>
          </div>

          <div className="admin-markets">
            {markets.map((market) => {
              const isExpired = Math.floor(Date.now() / 1000) > market.deadline;
              const canResolve = (market.status === 'active' && isExpired) || market.status === 'awaiting_resolution';

              return (
                <div key={market.market_id} className="admin-market-card">
                  <div className="admin-market-header">
                    <div className="admin-market-id">#{market.market_id}</div>
                    {getStatusBadge(market.status)}
                  </div>

                  <div className="admin-market-question">{market.question}</div>

                  <div className="admin-market-details">
                    <div className="admin-detail">
                      <span className="admin-detail-label">Creator:</span>
                      <span className="admin-detail-value">{market.creator_username}</span>
                    </div>
                    <div className="admin-detail">
                      <span className="admin-detail-label">Stake:</span>
                      <span className="admin-detail-value">{market.stake} BNB</span>
                    </div>
                    <div className="admin-detail">
                      <span className="admin-detail-label">Tickets:</span>
                      <span className="admin-detail-value">{market.tickets_sold}/{market.total_tickets}</span>
                    </div>
                    <div className="admin-detail">
                      <span className="admin-detail-label">Deadline:</span>
                      <span className="admin-detail-value">{new Date(market.deadline * 1000).toLocaleString()}</span>
                    </div>
                  </div>

                  {market.status === 'resolved' && (
                    <div className="admin-resolution">
                      <div className="admin-resolution-outcome">
                        <span className="admin-resolution-label">OUTCOME:</span>
                        <span className={`admin-resolution-value ${market.outcome ? 'outcome-yes' : 'outcome-no'}`}>
                          {market.outcome ? 'YES (MAKER WON)' : 'NO (CHALLENGERS WON)'}
                        </span>
                      </div>
                      {market.resolution_reason && (
                        <div className="admin-resolution-reason">
                          <span className="admin-resolution-label">REASON:</span>
                          <p>{market.resolution_reason}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="admin-market-actions">
                    {canResolve && (
                      <button
                        className="admin-action-btn resolve-btn"
                        onClick={() => openResolveModal(market)}
                        disabled={actionLoading}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        RESOLVE
                      </button>
                    )}
                    {market.status !== 'resolved' && (
                      <button
                        className="admin-action-btn cancel-btn"
                        onClick={() => handleCancelMarket(market)}
                        disabled={actionLoading}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        CANCEL
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
                <label className="admin-modal-label">RESOLUTION REASON *</label>
                <textarea
                  className="admin-modal-textarea"
                  placeholder="Provide a clear reason for this resolution decision..."
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
                onClick={handleResolveMarket}
                disabled={actionLoading || outcome === null || !resolutionReason.trim()}
              >
                {actionLoading ? 'RESOLVING...' : 'RESOLVE MARKET'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

