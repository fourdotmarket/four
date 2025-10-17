import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useLanguage } from '../context/LanguageContext';
import { useTransactions } from '../hooks/useTransactions';
import { usePositions } from '../hooks/usePositions';
import Notification from '../components/Notification';
import './Bet.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Generate consistent colors for users
const COLORS = [
  '#FFD43B', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DFE6E9', '#74B9FF', '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7',
];

// Component to show all user positions across all markets
function AllUserPositions({ userId }) {
  const navigate = useNavigate();
  const [allPositions, setAllPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const generateBetId = (marketId) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const seed = parseInt(marketId);
    let result = '';
    let num = seed;
    
    for (let i = 0; i < 8; i++) {
      result += chars[num % chars.length];
      num = Math.floor(num / chars.length) + seed * (i + 1);
    }
    
    return result;
  };

  useEffect(() => {
    fetchAllPositions();

    const channel = supabase
      .channel(`all-user-positions-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `buyer_id=eq.${userId}`
        },
        (payload) => {
          console.log('🆕 New position:', payload.new);
          fetchAllPositions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchAllPositions = async () => {
    try {
      setLoading(true);

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select(`
          transaction_id,
          market_id,
          buyer_username,
          buyer_wallet,
          ticket_count,
          total_cost,
          tx_hash,
          block_number,
          timestamp,
          created_at,
          markets (
            market_id,
            question,
            status
          )
        `)
        .eq('buyer_id', userId)
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      const marketMap = {};
      
      transactions.forEach(tx => {
        const marketId = tx.market_id;
        
        if (!marketMap[marketId]) {
          marketMap[marketId] = {
            market_id: marketId,
            question: tx.markets?.question || 'Unknown Market',
            status: tx.markets?.status || 'unknown',
            tickets: 0,
            spent: 0,
            transactions: []
          };
        }
        
        marketMap[marketId].tickets += tx.ticket_count;
        marketMap[marketId].spent += tx.total_cost;
        marketMap[marketId].transactions.push(tx);
      });

      const positionsArray = Object.values(marketMap).map(market => ({
        ...market,
        betId: generateBetId(market.market_id),
        lastTransaction: market.transactions[0]
      }));

      setAllPositions(positionsArray);
      setError(null);
    } catch (err) {
      console.error('Error fetching all positions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getBSCScanUrl = (txHash) => {
    return `https://bscscan.com/tx/${txHash}`;
  };

  const handleBetClick = (betId) => {
    navigate(`/bet/${betId}`);
  };

  const totalTickets = allPositions.reduce((sum, pos) => sum + pos.tickets, 0);
  const totalSpent = allPositions.reduce((sum, pos) => sum + pos.spent, 0);

  if (loading) {
    return (
      <div className="bet-empty-state" style={{ padding: '60px 20px' }}>
        <div className="loading-spinner"></div>
        <p>Loading positions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bet-empty-state" style={{ padding: '60px 20px' }}>
        <p style={{ color: '#ff6b6b' }}>Error loading positions</p>
      </div>
    );
  }

  if (allPositions.length === 0) {
    return (
      <div className="bet-empty-state" style={{ padding: '60px 20px' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
        <p>You don't have any positions yet</p>
      </div>
    );
  }

  return (
    <div className="bet-positions-container" style={{ padding: '24px' }}>
      <div className="bet-positions-summary">
        <div className="bet-position-stat">
          <span className="bet-position-label">TOTAL TICKETS</span>
          <span className="bet-position-value">{totalTickets}</span>
        </div>
        <div className="bet-position-stat">
          <span className="bet-position-label">TOTAL SPENT</span>
          <span className="bet-position-value">{totalSpent.toFixed(4)} BNB</span>
        </div>
      </div>

      <div className="bet-transactions-table" style={{ marginTop: '24px' }}>
        <div className="bet-table-header" style={{ gridTemplateColumns: '0.8fr 2.5fr 1fr 1fr 1.2fr' }}>
          <div className="bet-table-cell">TICKETS</div>
          <div className="bet-table-cell">BET</div>
          <div className="bet-table-cell">BET ID</div>
          <div className="bet-table-cell">DATE</div>
          <div className="bet-table-cell">TX</div>
        </div>
        <div className="bet-table-body">
          {allPositions.map((position) => (
            <div key={position.market_id} className="bet-table-row" style={{ gridTemplateColumns: '0.8fr 2.5fr 1fr 1fr 1.2fr' }}>
              <div className="bet-table-cell">{position.tickets}</div>
              <div className="bet-table-cell" style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}>
                {position.question}
              </div>
              <div className="bet-table-cell">
                <button
                  onClick={() => handleBetClick(position.betId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#FFD43B',
                    cursor: 'pointer',
                    fontFamily: "'Courier New', monospace",
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    padding: 0
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#FCD535'}
                  onMouseLeave={(e) => e.target.style.color = '#FFD43B'}
                >
                  {position.betId}
                </button>
              </div>
              <div className="bet-table-cell">
                {formatDate(position.lastTransaction.created_at)}
              </div>
              <div className="bet-table-cell">
                <a 
                  href={getBSCScanUrl(position.lastTransaction.tx_hash)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bet-table-link"
                >
                  {position.lastTransaction.tx_hash.slice(0, 6)}...{position.lastTransaction.tx_hash.slice(-4)}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Bet() {
  const { betId } = useParams();
  const navigate = useNavigate();
  const { user, authReady, getFreshToken } = useAuth();
  const { notification, showNotification, hideNotification } = useNotification();
  const { t } = useLanguage();
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('transactions');
  const [ticketAmount, setTicketAmount] = useState(1);
  const [ticketInputValue, setTicketInputValue] = useState('1');
  const [isBuying, setIsBuying] = useState(false);
  const [buyStatus, setBuyStatus] = useState('');

  const { transactions, loading: txLoading } = useTransactions(market?.market_id);
  const { positions, totalTickets, totalSpent, loading: posLoading } = usePositions(user?.user_id, market?.market_id);

  const getMarketIdFromBetId = async (betId) => {
    // SECURITY FIX: Select only market_id, not all columns
    // Query all markets regardless of status to support resolved/cancelled routes
    const { data: markets, error: fetchError } = await supabase
      .from('markets')
      .select('market_id');

    if (fetchError) throw fetchError;

    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    
    for (const market of markets) {
      const seed = parseInt(market.market_id);
      let result = '';
      let num = seed;
      
      for (let i = 0; i < 8; i++) {
        result += chars[num % chars.length];
        num = Math.floor(num / chars.length) + seed * (i + 1);
      }
      
      if (result === betId) {
        return market.market_id;
      }
    }
    
    return null;
  };

  useEffect(() => {
    fetchMarket();
  }, [betId]);

  useEffect(() => {
    if (!market) return;

    const channel = supabase
      .channel(`market-${market.market_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets',
          filter: `market_id=eq.${market.market_id}`
        },
        (payload) => {
          console.log('📊 Market updated:', payload.new);
          setMarket(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [market]);

  const fetchMarket = async () => {
    try {
      setLoading(true);
      
      const marketId = await getMarketIdFromBetId(betId);
      
      if (!marketId) {
        throw new Error('Market not found');
      }

      // SECURITY FIX: Select only non-sensitive columns (no id, no creator_id)
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
        .eq('market_id', marketId)
        .single();

      if (fetchError) throw fetchError;

      setMarket(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching market:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/market');
  };

  const isMarketExpired = () => {
    if (!market) return false;
    const now = Math.floor(Date.now() / 1000);
    return now > market.deadline;
  };

  const isMarketMaker = () => {
    if (!user || !market) return false;
    return user.wallet_address?.toLowerCase() === market.creator_wallet?.toLowerCase();
  };

  const getBuyDisabledReason = () => {
    // Smart auth check: only show "Authenticating" if no user AND authReady is false
    if (!user) {
      if (!authReady) return t('bet.authenticating');
      return t('bet.signInToBuy');
    }
    if (isMarketMaker()) return t('bet.cannotBuyOwn');
    if (market?.status === 'awaiting_resolution') return t('bet.marketAwaiting');
    if (market?.status === 'resolved') return t('bet.marketResolved');
    if (isMarketExpired()) return t('bet.marketExpired');
    if (ticketsRemaining === 0) return t('bet.soldOut');
    if (isBuying) return t('bet.processing');
    return null;
  };

  const handleBuyTickets = async () => {
    // Smart auth check: if user exists, proceed
    if (!user) {
      if (!authReady) {
        showNotification(t('bet.authenticating'), 'warning');
        return;
      }
      showNotification(t('bet.pleaseBuyTickets'), 'error');
      return;
    }
    
    const disabledReason = getBuyDisabledReason();
    if (disabledReason) {
      showNotification(disabledReason, 'warning');
      return;
    }

    if (ticketAmount < 1) {
      showNotification(t('bet.pleaseBuyAtLeast'), 'error');
      return;
    }

    if (ticketAmount > ticketsRemaining) {
      showNotification(t('bet.onlyRemaining').replace('{count}', ticketsRemaining), 'warning');
      return;
    }

    if (!authReady) {
      showNotification('Authentication is still loading. Please wait a moment and try again.', 'warning');
      return;
    }

    try {
      setIsBuying(true);
      setBuyStatus('Preparing transaction...');

      console.log('Getting fresh authentication token...');
      const token = await getFreshToken();
      
      if (!token) {
        throw new Error('Failed to get authentication token. Please sign in again.');
      }

      console.log('Token obtained, buying tickets...');
      setBuyStatus('Submitting to blockchain...');

      const response = await fetch('/api/buy-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: market.market_id,
          ticket_count: ticketAmount
        })
      });

      const contentType = response.headers.get('content-type');
      let result;

      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('❌ Server returned HTML:', text.substring(0, 200));
        throw new Error('Server error occurred');
      }

      if (!response.ok) {
        throw new Error(result.error || result.details || t('bet.failedToBuy'));
      }
      
      console.log('✅ Tickets purchased!');
      console.log('TX Hash:', result.txHash);

      setBuyStatus(`Success! TX: ${result.txHash.slice(0, 10)}...`);

      setTimeout(() => {
        setBuyStatus('');
        setIsBuying(false);
        setTicketAmount(1);
        setTicketInputValue('1');
      }, 2000);

    } catch (error) {
      console.error('❌ Error buying challenge tickets:', error);
      setBuyStatus('');
      setIsBuying(false);
      setTicketInputValue(ticketAmount.toString());
      
      if (error.message.includes('Authentication required')) {
        showNotification(t('bet.signInAgainToBuy'), 'error');
      } else if (error.message.includes('Too many requests')) {
        showNotification(t('bet.tooManyPurchases'), 'warning');
      } else if (error.message.includes('Cannot buy your own tickets')) {
        showNotification(t('bet.cannotBuyOwnTickets'), 'error');
      } else {
        showNotification(`${t('bet.failedToBuy')}: ${error.message}`, 'error');
      }
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getBSCScanUrl = (txHash) => {
    return `https://bscscan.com/tx/${txHash}`;
  };

  const getUserDistribution = () => {
    if (!market) return [];

    const userMap = {};
    
    if (transactions && transactions.length > 0) {
      transactions.forEach(tx => {
        if (!userMap[tx.buyer_wallet]) {
          userMap[tx.buyer_wallet] = {
            name: tx.buyer_username,
            value: 0,
            isCurrentUser: user && tx.buyer_wallet === user.wallet_address
          };
        }
        userMap[tx.buyer_wallet].value += tx.ticket_count;
      });
    }

    const userDistribution = Object.values(userMap).map((userData, index) => ({
      ...userData,
      color: userData.isCurrentUser ? '#FFD43B' : COLORS[index % COLORS.length]
    }));

    const ticketsRemaining = market.total_tickets - market.tickets_sold;
    if (ticketsRemaining > 0) {
      userDistribution.push({
        name: t('bet.available'),
        value: ticketsRemaining,
        color: '#2a2a2a',
        isRemaining: true
      });
    }

    return userDistribution;
  };

  const getUniqueHoldersCount = () => {
    if (!transactions || transactions.length === 0) return 0;
    const uniqueBuyers = new Set(transactions.map(tx => tx.buyer_wallet));
    return uniqueBuyers.size;
  };

  if (loading) {
    return (
      <div className="bet-page">
        <div className="bet-loading">
          <div className="loading-spinner"></div>
          <p>Loading bet...</p>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="bet-page">
        <div className="bet-error">
          <p>Bet not found</p>
        </div>
      </div>
    );
  }

  const ticketsRemaining = market.total_tickets - market.tickets_sold;
  const ticketsSold = market.tickets_sold;
  const progressPercentage = (ticketsSold / market.total_tickets) * 100;
  const holdersCount = getUniqueHoldersCount();
  const userDistribution = getUserDistribution();
  const totalCost = (ticketAmount * parseFloat(market.ticket_price)).toFixed(4);
  
  const buyDisabledReason = getBuyDisabledReason();
  const isBuyDisabled = !!buyDisabledReason;

  return (
    <div className="bet-page">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={hideNotification}
        />
      )}
      <button className="bet-back-btn" onClick={handleBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>{t('bet.back')}</span>
      </button>

      <div className="bet-split-container">
        <div className="bet-left-section">
          <div className="bet-info-card">
            <div className="bet-status-badge">
              {market.status === 'resolved' ? 'RESOLVED' : 
               market.status === 'awaiting_resolution' ? 'AWAITING' :
               isMarketExpired() ? 'EXPIRED' : 'ACTIVE'}
            </div>
            <div className="bet-question-section">
              <h1 className="bet-question">{market.question}</h1>
            </div>
            <div className="bet-creator-section">
              <span className="bet-label">{t('bet.createdBy')}</span>
              <span className="bet-creator-name">
                {market.creator_username}
                {isMarketMaker() && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#FFD43B' }}>{t('bet.you')}</span>}
              </span>
            </div>
            <div className="bet-stats-grid">
              <div className="bet-stat-item">
                <span className="bet-stat-label">STAKE</span>
                <span className="bet-stat-value">{market.stake} BNB</span>
              </div>
              <div className="bet-stat-item">
                <span className="bet-stat-label">TICKET PRICE</span>
                <span className="bet-stat-value">{market.ticket_price} BNB</span>
              </div>
              <div className="bet-stat-item">
                <span className="bet-stat-label">TOTAL TICKETS</span>
                <span className="bet-stat-value">{market.total_tickets}</span>
              </div>
              <div className="bet-stat-item">
                <span className="bet-stat-label">SOLD</span>
                <span className="bet-stat-value">{ticketsSold}</span>
              </div>
            </div>

            <div className="bet-chart-section">
              <h3 className="bet-chart-title">TICKET HOLDERS</h3>
              <div className="bet-chart-container">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={userDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {userDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div style={{
                              background: '#0a0a0a',
                              border: '1px solid #FFD43B',
                              borderRadius: '4px',
                              padding: '8px 12px',
                              fontFamily: "'Courier New', monospace",
                              fontSize: '12px'
                            }}>
                              <div style={{ color: '#FFD43B', fontWeight: 700, marginBottom: '4px' }}>
                                {data.name}
                              </div>
                              <div style={{ color: '#ffffff' }}>
                                {data.value} ticket{data.value > 1 ? 's' : ''}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {userDistribution.filter(u => !u.isRemaining).length > 0 && (
                  <div className="bet-chart-legend">
                    {userDistribution.filter(u => !u.isRemaining).slice(0, 4).map((entry, index) => (
                      <div className="bet-legend-item" key={index}>
                        <div className="bet-legend-color" style={{ background: entry.color }}></div>
                        <span>{entry.name}: {entry.value}</span>
                      </div>
                    ))}
                    {userDistribution.filter(u => !u.isRemaining).length > 4 && (
                      <div className="bet-legend-item">
                        <span>+{userDistribution.filter(u => !u.isRemaining).length - 4} more</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bet-right-section">
          <div className="bet-buy-card">
            <h2 className="bet-buy-title">{t('bet.challengeTickets')}</h2>
            <div className="bet-buy-banner">
              <img 
                src={market.banner_url || '/default.png'} 
                alt="Market banner"
              />
            </div>
            <div className="bet-progress-section">
              <div className="bet-progress-bar">
                <div 
                  className="bet-progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <div className="bet-progress-text">
                <span>{holdersCount} {holdersCount === 1 ? t('bet.holder') : t('bet.holders')} • {ticketsRemaining} {t('bet.left')}</span>
                <span>{progressPercentage.toFixed(0)}%</span>
              </div>
            </div>
            
            <div className="bet-buy-content">
              <div className="bet-ticket-selector">
                <label className="bet-input-label">{t('bet.selectAmount')}</label>
                <div className="bet-amount-controls">
                  <button 
                    className="bet-amount-btn"
                    onClick={() => {
                      const newValue = Math.max(1, ticketAmount - 1);
                      setTicketAmount(newValue);
                      setTicketInputValue(newValue.toString());
                    }}
                    disabled={ticketAmount <= 1 || isBuyDisabled}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                  <input
                    type="number"
                    className="bet-amount-input"
                    value={ticketInputValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      
                      if (value === '') {
                        setTicketInputValue('');
                        return;
                      }
                      
                      const numValue = parseInt(value);
                      
                      if (isNaN(numValue)) {
                        return;
                      }
                      
                      setTicketInputValue(value);
                      
                      const clampedValue = Math.max(1, Math.min(ticketsRemaining, numValue));
                      setTicketAmount(clampedValue);
                    }}
                    onBlur={() => {
                      if (ticketInputValue === '' || parseInt(ticketInputValue) < 1) {
                        setTicketInputValue('1');
                        setTicketAmount(1);
                      } else {
                        const numValue = parseInt(ticketInputValue);
                        const clampedValue = Math.max(1, Math.min(ticketsRemaining, numValue));
                        setTicketInputValue(clampedValue.toString());
                        setTicketAmount(clampedValue);
                      }
                    }}
                    min="1"
                    max={ticketsRemaining}
                    disabled={isBuyDisabled}
                  />
                  <button 
                    className="bet-amount-btn"
                    onClick={() => {
                      const newValue = Math.min(ticketsRemaining, ticketAmount + 1);
                      setTicketAmount(newValue);
                      setTicketInputValue(newValue.toString());
                    }}
                    disabled={ticketAmount >= ticketsRemaining || isBuyDisabled}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="bet-quick-select">
                <button 
                  className={`bet-quick-btn ${ticketAmount === 1 ? 'active' : ''}`}
                  onClick={() => {
                    setTicketAmount(1);
                    setTicketInputValue('1');
                  }}
                  disabled={isBuyDisabled}
                >
                  1
                </button>
                <button 
                  className={`bet-quick-btn ${ticketAmount === 5 ? 'active' : ''}`}
                  onClick={() => {
                    const value = Math.min(5, ticketsRemaining);
                    setTicketAmount(value);
                    setTicketInputValue(value.toString());
                  }}
                  disabled={isBuyDisabled}
                >
                  5
                </button>
                <button 
                  className={`bet-quick-btn ${ticketAmount === 10 ? 'active' : ''}`}
                  onClick={() => {
                    const value = Math.min(10, ticketsRemaining);
                    setTicketAmount(value);
                    setTicketInputValue(value.toString());
                  }}
                  disabled={isBuyDisabled}
                >
                  10
                </button>
                <button 
                  className="bet-quick-btn"
                  onClick={() => {
                    setTicketAmount(ticketsRemaining);
                    setTicketInputValue(ticketsRemaining.toString());
                  }}
                  disabled={isBuyDisabled}
                >
                  MAX
                </button>
              </div>

              <div className="bet-total-section">
                <div className="bet-total-row">
                  <span className="bet-total-label">TOTAL COST</span>
                  <span className="bet-total-value">{totalCost} BNB</span>
                </div>
              </div>

              {buyStatus && (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#FFD43B', 
                  fontSize: '11px',
                  fontWeight: '600',
                  fontFamily: "'Courier New', monospace",
                  padding: '12px 24px 0'
                }}>
                  {buyStatus}
                </div>
              )}

              <button 
                className="bet-buy-button" 
                onClick={handleBuyTickets}
                disabled={isBuyDisabled}
              >
                <span>
                  {buyDisabledReason || (ticketAmount > 1 ? t('bet.buyChallengeTickets').replace('{count}', ticketAmount) : t('bet.buyChallengeTicket').replace('{count}', ticketAmount))}
                </span>
                {!isBuyDisabled && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bet-tabs-container">
        <div className="bet-tabs-header">
          <button 
            className={`bet-tab ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            TRANSACTIONS
          </button>
          <button 
            className={`bet-tab ${activeTab === 'positions' ? 'active' : ''}`}
            onClick={() => setActiveTab('positions')}
          >
            POSITION
          </button>
          <button 
            className={`bet-tab ${activeTab === 'resolution' ? 'active' : ''}`}
            onClick={() => setActiveTab('resolution')}
          >
            RESOLUTION
          </button>
        </div>

        <div className="bet-tabs-content" style={{ padding: activeTab === 'transactions' || activeTab === 'positions' ? 0 : '40px' }}>
          {activeTab === 'transactions' && (
            <div className="bet-tab-panel">
              {txLoading ? (
                <div className="bet-empty-state" style={{ padding: '60px 20px' }}>
                  <div className="loading-spinner"></div>
                  <p>Loading transactions...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="bet-empty-state" style={{ padding: '60px 20px' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="9" y1="21" x2="9" y2="9"></line>
                  </svg>
                  <p>No transactions yet</p>
                </div>
              ) : (
                <div className="bet-transactions-table">
                  <div className="bet-table-header">
                    <div className="bet-table-cell">USER</div>
                    <div className="bet-table-cell">TICKETS</div>
                    <div className="bet-table-cell">BNB</div>
                    <div className="bet-table-cell">TIME</div>
                    <div className="bet-table-cell">TX</div>
                  </div>
                  <div className="bet-table-body">
                    {transactions.map((tx) => (
                      <div key={tx.transaction_id} className="bet-table-row">
                        <div className="bet-table-cell bet-table-user">
                          {tx.buyer_username}
                          {user && tx.buyer_wallet === user.wallet_address && (
                            <span className="bet-table-badge">YOU</span>
                          )}
                        </div>
                        <div className="bet-table-cell">{tx.ticket_count}</div>
                        <div className="bet-table-cell">{tx.total_cost.toFixed(4)}</div>
                        <div className="bet-table-cell">{formatTime(tx.timestamp)}</div>
                        <div className="bet-table-cell">
                          <a 
                            href={getBSCScanUrl(tx.tx_hash)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bet-table-link"
                          >
                            {tx.tx_hash.slice(0, 6)}...{tx.tx_hash.slice(-4)}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'positions' && (
            <div className="bet-tab-panel">
              {!user ? (
                <div className="bet-empty-state" style={{ padding: '60px 20px' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <p>{t('bet.signInToView')}</p>
                </div>
              ) : (
                <AllUserPositions userId={user.user_id} />
              )}
            </div>
          )}

          {activeTab === 'resolution' && (
            <div className="bet-tab-panel">
              {market?.status === 'resolved' && market?.resolution_reason ? (
                <div className="bet-resolution-display">
                  <div className="bet-resolution-header">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <h3>MARKET RESOLVED</h3>
                  </div>

                  <div className="bet-resolution-outcome">
                    <span className="bet-resolution-label">WINNING SIDE:</span>
                    <span className={`bet-resolution-winner ${market.outcome ? 'maker' : 'challengers'}`}>
                      {market.outcome ? 'YES (MAKER WINS)' : 'NO (CHALLENGERS WIN)'}
                    </span>
                  </div>

                  <div className="bet-resolution-reason">
                    <span className="bet-resolution-label">RESOLUTION REASON:</span>
                    <p>{market.resolution_reason}</p>
                  </div>
                </div>
              ) : market?.status === 'awaiting_resolution' ? (
                <div className="bet-empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <p>Awaiting Admin Resolution</p>
                  <span className="bet-empty-subtext">This market is pending resolution by administrators</span>
                </div>
              ) : (
                <div className="bet-empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <p>No Resolution Yet</p>
                  <span className="bet-empty-subtext">Resolution details will appear here once the market is resolved</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}