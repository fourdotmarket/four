import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import './Position.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function Position() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
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
    if (!user || !user.user_id) {
      setLoading(false);
      return;
    }

    fetchAllPositions();

    const channel = supabase
      .channel(`all-user-positions-${user.user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `buyer_id=eq.${user.user_id}`
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
  }, [user]);

  const fetchAllPositions = async () => {
    if (!user || !user.user_id) return;

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
        .eq('buyer_id', user.user_id)
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

  const handleBack = () => {
    navigate(-1);
  };

  const totalTickets = allPositions.reduce((sum, pos) => sum + pos.tickets, 0);
  const totalSpent = allPositions.reduce((sum, pos) => sum + pos.spent, 0);

  if (!user) {
    return (
      <div className="position-page">
        <button className="position-back-btn" onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>{t('positions.back')}</span>
        </button>

        <div className="position-header">
          <h1 className="position-title">{t('positions.title')}</h1>
          <p className="position-subtitle">{t('positions.subtitleTrack')}</p>
        </div>

        <div className="position-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <p>{t('positions.pleaseSignIn')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="position-page">
        <button className="position-back-btn" onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>{t('positions.back')}</span>
        </button>

        <div className="position-header">
          <h1 className="position-title">{t('positions.title')}</h1>
          <p className="position-subtitle">{t('positions.subtitleTrack')}</p>
        </div>

        <div className="position-empty-state">
          <div className="loading-spinner"></div>
          <p>{t('positions.loadingPositions')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="position-page">
        <button className="position-back-btn" onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>{t('positions.back')}</span>
        </button>

        <div className="position-header">
          <h1 className="position-title">{t('positions.title')}</h1>
          <p className="position-subtitle">{t('positions.subtitleTrack')}</p>
        </div>

        <div className="position-empty-state">
          <p style={{ color: '#ff6b6b' }}>{t('positions.errorLoading')}</p>
        </div>
      </div>
    );
  }

  if (allPositions.length === 0) {
    return (
      <div className="position-page">
        <button className="position-back-btn" onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>{t('positions.back')}</span>
        </button>

        <div className="position-header">
          <h1 className="position-title">{t('positions.title')}</h1>
          <p className="position-subtitle">{t('positions.subtitleTrack')}</p>
        </div>

        <div className="position-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          <p>{t('positions.noPositionsYet')}</p>
          <button className="position-browse-btn" onClick={() => navigate('/market')}>
            {t('positions.browseMarkets')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="position-page">
      <button className="position-back-btn" onClick={handleBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>{t('positions.back')}</span>
      </button>

      <div className="position-header">
        <h1 className="position-title">{t('positions.title')}</h1>
        <p className="position-subtitle">{t('positions.subtitleTrack')}</p>
      </div>

      <div className="position-summary">
        <div className="position-stat-card">
          <span className="position-stat-label">{t('positions.totalTicketsLabel')}</span>
          <span className="position-stat-value">{totalTickets}</span>
        </div>
        <div className="position-stat-card">
          <span className="position-stat-label">{t('positions.totalSpentLabel')}</span>
          <span className="position-stat-value">{totalSpent.toFixed(4)} BNB</span>
        </div>
        <div className="position-stat-card">
          <span className="position-stat-label">{t('positions.marketsLabel')}</span>
          <span className="position-stat-value">{allPositions.length}</span>
        </div>
      </div>

      <div className="position-table-container">
        <div className="position-table">
          <div className="position-table-header">
            <div className="position-table-cell">{t('positions.ticketsLabel')}</div>
            <div className="position-table-cell">{t('positions.betLabel')}</div>
            <div className="position-table-cell">{t('positions.betIdLabel')}</div>
            <div className="position-table-cell">{t('positions.statusLabel')}</div>
            <div className="position-table-cell">{t('positions.dateLabel')}</div>
            <div className="position-table-cell">{t('positions.txLabel')}</div>
          </div>
          <div className="position-table-body">
            {allPositions.map((position) => (
              <div key={position.market_id} className="position-table-row">
                <div className="position-table-cell">
                  <span className="position-tickets-badge">{position.tickets}</span>
                </div>
                <div className="position-table-cell position-question">
                  {position.question}
                </div>
                <div className="position-table-cell">
                  <button
                    onClick={() => handleBetClick(position.betId)}
                    className="position-bet-id-link"
                  >
                    {position.betId}
                  </button>
                </div>
                <div className="position-table-cell">
                  <span className={`position-status-badge ${position.status}`}>
                    {position.status.toUpperCase()}
                  </span>
                </div>
                <div className="position-table-cell">
                  {formatDate(position.lastTransaction.created_at)}
                </div>
                <div className="position-table-cell">
                  <a 
                    href={getBSCScanUrl(position.lastTransaction.tx_hash)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="position-tx-link"
                  >
                    {position.lastTransaction.tx_hash.slice(0, 6)}...{position.lastTransaction.tx_hash.slice(-4)}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

