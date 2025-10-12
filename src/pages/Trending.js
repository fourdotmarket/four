import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { useTransactions } from '../hooks/useTransactions';
import { usePrivy } from '@privy-io/react-auth';
import MarketCard from '../components/MarketCard';
import './Trending.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const COLORS = [
  '#FFD43B', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DFE6E9', '#74B9FF', '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7',
];

export default function Trending() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getAccessToken } = usePrivy();
  const [topMarket, setTopMarket] = useState(null);
  const [topMarkets, setTopMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  const [ticketAmount, setTicketAmount] = useState(1);
  const [ticketInputValue, setTicketInputValue] = useState('1');
  const [isBuying, setIsBuying] = useState(false);
  const [buyStatus, setBuyStatus] = useState('');

  const { transactions, loading: txLoading } = useTransactions(topMarket?.market_id);

  useEffect(() => {
    fetchTrendingMarkets();

    // Subscribe to all market updates
    const marketsChannel = supabase
      .channel('trending-markets-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets'
        },
        () => {
          // Silent background update
          fetchTrendingMarkets();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions'
        },
        () => {
          // Silent background update
          fetchTrendingMarkets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(marketsChannel);
    };
  }, []);

  useEffect(() => {
    if (!topMarket) return;

    const channel = supabase
      .channel(`trending-market-${topMarket.market_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets',
          filter: `market_id=eq.${topMarket.market_id}`
        },
        (payload) => {
          setTopMarket(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [topMarket]);

  const fetchTrendingMarkets = async () => {
    try {
      // Only show loading spinner on initial load
      if (initialLoad) {
        setLoading(true);
      }

      // Get current time minus 3 hours
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

      // Get all active markets with their recent transactions
      const { data: markets, error: marketsError } = await supabase
        .from('markets')
        .select(`
          *,
          transactions (
            buyer_wallet,
            created_at
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (marketsError) throw marketsError;

      // Filter out expired markets
      const now = Math.floor(Date.now() / 1000);
      const activeMarkets = markets.filter(market => {
        // Not expired
        if (now > market.deadline) return false;
        // Not sold out
        if (market.tickets_sold >= market.total_tickets) return false;
        return true;
      });

      // Calculate unique holders for each market
      const marketsWithHolders = activeMarkets.map(market => {
        const uniqueHolders = new Set(
          market.transactions?.map(tx => tx.buyer_wallet) || []
        );
        return {
          ...market,
          unique_holders: uniqueHolders.size
        };
      });

      // Sort by unique holders (most holders first)
      const sortedByHolders = [...marketsWithHolders].sort((a, b) => 
        b.unique_holders - a.unique_holders
      );

      // For bottom section: filter markets with activity in past 3 hours
      const marketsWithRecentActivity = marketsWithHolders.filter(market => {
        if (!market.transactions || market.transactions.length === 0) return false;
        
        // Check if any transaction is within the past 3 hours
        const hasRecentActivity = market.transactions.some(tx => {
          return new Date(tx.created_at) > new Date(threeHoursAgo);
        });
        
        return hasRecentActivity;
      });

      // Sort by tickets sold (most tickets sold first)
      const sortedByActivity = [...marketsWithRecentActivity].sort((a, b) => 
        b.tickets_sold - a.tickets_sold
      );

      // Set top market (most unique holders)
      if (sortedByHolders.length > 0) {
        setTopMarket(sortedByHolders[0]);
      }

      // Set top 4 markets by tickets sold with recent activity
      setTopMarkets(sortedByActivity.slice(0, 4));

      setError(null);
      
      // Mark initial load as complete
      if (initialLoad) {
        setInitialLoad(false);
      }
    } catch (err) {
      console.error('Error fetching trending markets:', err);
      setError(err.message);
    } finally {
      // Only hide loading on initial load
      if (initialLoad) {
        setLoading(false);
      }
    }
  };

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

  const handleTopicClick = () => {
    if (topMarket) {
      const betId = generateBetId(topMarket.market_id);
      navigate(`/bet/${betId}`);
    }
  };

  const isMarketExpired = () => {
    if (!topMarket) return false;
    const now = Math.floor(Date.now() / 1000);
    return now > topMarket.deadline;
  };

  const isMarketMaker = () => {
    if (!user || !topMarket) return false;
    return user.wallet_address?.toLowerCase() === topMarket.creator_wallet?.toLowerCase();
  };

  const getBuyDisabledReason = () => {
    if (!topMarket) return 'Loading...';
    if (!user) return 'Sign in to buy challenge tickets';
    if (isMarketMaker()) return 'Cannot buy challenge tickets in your own market';
    if (topMarket?.status === 'awaiting_resolution') return 'Market awaiting resolution';
    if (topMarket?.status === 'resolved') return 'Market has been resolved';
    if (isMarketExpired()) return 'Market has expired';
    const remaining = topMarket.total_tickets - topMarket.tickets_sold;
    if (remaining === 0) return 'Sold out';
    if (isBuying) return 'Processing...';
    return null;
  };

  const handleBuyTickets = async () => {
    const disabledReason = getBuyDisabledReason();
    if (disabledReason) {
      alert(disabledReason);
      return;
    }

    const ticketsRemaining = topMarket.total_tickets - topMarket.tickets_sold;

    if (ticketAmount < 1) {
      alert('Please select at least 1 challenge ticket');
      return;
    }

    if (ticketAmount > ticketsRemaining) {
      alert(`Only ${ticketsRemaining} challenge tickets remaining`);
      return;
    }

    try {
      setIsBuying(true);
      setBuyStatus('Preparing transaction...');

      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      setBuyStatus('Submitting to blockchain...');

      const response = await fetch('/api/buy-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: topMarket.market_id,
          ticket_count: ticketAmount
        })
      });

      const contentType = response.headers.get('content-type');
      let result;

      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        throw new Error('Server error occurred');
      }

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to buy challenge tickets');
      }

      setBuyStatus(`Success! TX: ${result.txHash.slice(0, 10)}...`);

      setTimeout(() => {
        setBuyStatus('');
        setIsBuying(false);
        setTicketAmount(1);
        setTicketInputValue('1');
        fetchTrendingMarkets();
      }, 2000);

    } catch (error) {
      console.error('Error buying challenge tickets:', error);
      setBuyStatus('');
      setIsBuying(false);
      setTicketInputValue(ticketAmount.toString());

      if (error.message.includes('Authentication required')) {
        alert('Please sign in again to buy challenge tickets');
      } else if (error.message.includes('Too many requests')) {
        alert('You are making too many purchases. Please wait a moment and try again.');
      } else if (error.message.includes('Cannot buy your own tickets')) {
        alert('Market creators cannot purchase challenge tickets in their own markets');
      } else {
        alert(`Failed to buy challenge tickets: ${error.message}`);
      }
    }
  };

  const getUserDistribution = () => {
    if (!topMarket) return [];

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

    const ticketsRemaining = topMarket.total_tickets - topMarket.tickets_sold;
    if (ticketsRemaining > 0) {
      userDistribution.push({
        name: 'Available',
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
      <div className="trending-page">
        <div className="trending-loading">
          <div className="loading-spinner"></div>
          <p>LOADING TRENDING...</p>
        </div>
      </div>
    );
  }

  if (error || !topMarket) {
    return (
      <div className="trending-page">
        <div className="trending-error">
          <p>No trending markets available</p>
        </div>
      </div>
    );
  }

  const ticketsRemaining = topMarket.total_tickets - topMarket.tickets_sold;
  const ticketsSold = topMarket.tickets_sold;
  const progressPercentage = (ticketsSold / topMarket.total_tickets) * 100;
  const holdersCount = getUniqueHoldersCount();
  const userDistribution = getUserDistribution();
  const totalCost = (ticketAmount * parseFloat(topMarket.ticket_price)).toFixed(4);
  
  const buyDisabledReason = getBuyDisabledReason();
  const isBuyDisabled = !!buyDisabledReason;

  return (
    <div className="trending-page">
      {/* Header */}
      <div className="trending-header">
        <div className="trending-title-section">
          <h1 className="trending-title">TRENDING NOW</h1>
          <p className="trending-subtitle">Most popular prediction market</p>
        </div>
      </div>

      {/* Top Market Section */}
      <div className="trending-split-container">
        {/* Left Section - Market Info */}
        <div className="trending-left-section">
          <div className="trending-info-card">
            <div className="trending-status-badge">
              {topMarket.status === 'resolved' ? 'RESOLVED' : 
               topMarket.status === 'awaiting_resolution' ? 'AWAITING' :
               isMarketExpired() ? 'EXPIRED' : 'ACTIVE'}
            </div>
            
            <div className="trending-question-section" onClick={handleTopicClick}>
              <h1 className="trending-question">{topMarket.question}</h1>
            </div>

            <div className="trending-creator-section">
              <span className="trending-label">CREATED BY</span>
              <span className="trending-creator-name">
                {topMarket.creator_username}
                {isMarketMaker() && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#FFD43B' }}>(YOU)</span>}
              </span>
            </div>

            <div className="trending-stats-grid">
              <div className="trending-stat-item">
                <span className="trending-stat-label">STAKE</span>
                <span className="trending-stat-value">{topMarket.stake} BNB</span>
              </div>
              <div className="trending-stat-item">
                <span className="trending-stat-label">TICKET PRICE</span>
                <span className="trending-stat-value">{topMarket.ticket_price} BNB</span>
              </div>
              <div className="trending-stat-item">
                <span className="trending-stat-label">TOTAL TICKETS</span>
                <span className="trending-stat-value">{topMarket.total_tickets}</span>
              </div>
              <div className="trending-stat-item">
                <span className="trending-stat-label">SOLD</span>
                <span className="trending-stat-value">{ticketsSold}</span>
              </div>
            </div>

            <div className="trending-chart-section">
              <h3 className="trending-chart-title">TICKET HOLDERS</h3>
              <div className="trending-chart-container">
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
                  <div className="trending-chart-legend">
                    {userDistribution.filter(u => !u.isRemaining).slice(0, 4).map((entry, index) => (
                      <div className="trending-legend-item" key={index}>
                        <div className="trending-legend-color" style={{ background: entry.color }}></div>
                        <span>{entry.name}: {entry.value}</span>
                      </div>
                    ))}
                    {userDistribution.filter(u => !u.isRemaining).length > 4 && (
                      <div className="trending-legend-item">
                        <span>+{userDistribution.filter(u => !u.isRemaining).length - 4} more</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Buy Card */}
        <div className="trending-right-section">
          <div className="trending-buy-card">
            <h2 className="trending-buy-title">BUY CHALLENGE TICKETS</h2>
            
            <div className="trending-buy-banner">
              <img 
                src={topMarket.banner_url || '/default.png'} 
                alt="Market banner"
              />
            </div>

            <div className="trending-progress-section">
              <div className="trending-progress-bar">
                <div 
                  className="trending-progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <div className="trending-progress-text">
                <span>{holdersCount} {holdersCount === 1 ? 'HOLDER' : 'HOLDERS'} • {ticketsRemaining} LEFT</span>
                <span>{progressPercentage.toFixed(0)}%</span>
              </div>
            </div>
            
            <div className="trending-buy-content">
              <div className="trending-ticket-selector">
                <label className="trending-input-label">NUMBER OF CHALLENGE TICKETS</label>
                <div className="trending-amount-controls">
                  <button 
                    className="trending-amount-btn"
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
                    className="trending-amount-input"
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
                    className="trending-amount-btn"
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

              <div className="trending-quick-select">
                <button 
                  className={`trending-quick-btn ${ticketAmount === 1 ? 'active' : ''}`}
                  onClick={() => {
                    setTicketAmount(1);
                    setTicketInputValue('1');
                  }}
                  disabled={isBuyDisabled}
                >
                  1
                </button>
                <button 
                  className={`trending-quick-btn ${ticketAmount === 5 ? 'active' : ''}`}
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
                  className={`trending-quick-btn ${ticketAmount === 10 ? 'active' : ''}`}
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
                  className="trending-quick-btn"
                  onClick={() => {
                    setTicketAmount(ticketsRemaining);
                    setTicketInputValue(ticketsRemaining.toString());
                  }}
                  disabled={isBuyDisabled}
                >
                  MAX
                </button>
              </div>

              <div className="trending-total-section">
                <div className="trending-total-row">
                  <span className="trending-total-label">TOTAL COST</span>
                  <span className="trending-total-value">{totalCost} BNB</span>
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
                className="trending-buy-button" 
                onClick={handleBuyTickets}
                disabled={isBuyDisabled}
              >
                <span>
                  {buyDisabledReason || `BUY ${ticketAmount} CHALLENGE TICKET${ticketAmount > 1 ? 'S' : ''}`}
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

      {/* Top 4 Markets by Recent Activity */}
      <div className="trending-markets-section">
        <div className="trending-markets-header">
          <h2 className="trending-markets-title">TOP MARKETS BY ACTIVITY</h2>
          <p className="trending-markets-subtitle">Most active in the past 3 hours</p>
        </div>
        
        {topMarkets.length === 0 ? (
          <div className="trending-markets-empty">
            <p>No markets available</p>
          </div>
        ) : (
          <div className="trending-markets-grid">
            {topMarkets.map((market) => (
              <MarketCard key={market.market_id} market={market} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}