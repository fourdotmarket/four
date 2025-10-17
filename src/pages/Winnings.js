import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import './Winnings.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function Winnings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [winnings, setWinnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalWinnings, setTotalWinnings] = useState(0);

  useEffect(() => {
    if (user) {
      fetchWinnings();
    }
  }, [user]);

  const fetchWinnings = async () => {
    try {
      setLoading(true);

      // Fetch all resolved markets
      const { data: resolvedMarkets, error: marketsError } = await supabase
        .from('markets')
        .select('*')
        .eq('status', 'resolved');

      if (marketsError) throw marketsError;

      const userWinnings = [];
      let total = 0;

      for (const market of resolvedMarkets) {
        // Check if user was the maker and won
        if (market.creator_wallet === user.wallet_address && market.outcome === true) {
          const totalPool = parseFloat(market.stake) + (parseFloat(market.ticket_price) * market.tickets_sold);
          userWinnings.push({
            market_id: market.market_id,
            question: market.question,
            type: 'maker',
            amount: totalPool,
            outcome: market.outcome,
            resolution_reason: market.resolution_reason,
            resolved_at: market.updated_at
          });
          total += totalPool;
        }

        // Check if user was a challenger and won
        if (market.outcome === false) {
          const { data: userTickets, error: ticketsError } = await supabase
            .from('transactions')
            .select('ticket_count, total_cost')
            .eq('market_id', market.market_id)
            .eq('buyer_wallet', user.wallet_address);

          if (!ticketsError && userTickets && userTickets.length > 0) {
            const totalPool = parseFloat(market.stake) + (parseFloat(market.ticket_price) * market.tickets_sold);
            const userTicketCount = userTickets.reduce((sum, tx) => sum + tx.ticket_count, 0);
            const userWinAmount = (userTicketCount / market.tickets_sold) * totalPool;

            userWinnings.push({
              market_id: market.market_id,
              question: market.question,
              type: 'challenger',
              amount: userWinAmount,
              tickets: userTicketCount,
              outcome: market.outcome,
              resolution_reason: market.resolution_reason,
              resolved_at: market.updated_at
            });
            total += userWinAmount;
          }
        }
      }

      setWinnings(userWinnings);
      setTotalWinnings(total);
      setError(null);
    } catch (err) {
      console.error('Error fetching winnings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
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

  const handleWinningClick = (marketId) => {
    const betId = generateBetId(marketId);
    navigate(`/bet/${betId}`);
  };

  if (!user) {
    return (
      <div className="winnings-page">
        <div className="winnings-empty">
          <p>Please sign in to view your winnings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="winnings-page">
      <button className="winnings-back-btn" onClick={handleBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>BACK</span>
      </button>

      <div className="winnings-header">
          <h1 className="winnings-title">{t('winnings.title')}</h1>
        <p className="winnings-subtitle">Track your earnings from resolved markets</p>
      </div>

      {loading ? (
        <div className="winnings-loading">
          <div className="loading-spinner"></div>
          <p>LOADING WINNINGS...</p>
        </div>
      ) : error ? (
        <div className="winnings-error">
          <p>ERROR: {error}</p>
        </div>
      ) : winnings.length === 0 ? (
        <div className="winnings-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
            <path d="M4 22h16"></path>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
          </svg>
          <h3>NO WINNINGS YET</h3>
          <p>You haven't won any resolved markets yet. Keep participating!</p>
        </div>
      ) : (
        <>
          <div className="winnings-total-card">
            <div className="winnings-total-label">TOTAL WINNINGS</div>
            <div className="winnings-total-amount">{totalWinnings.toFixed(4)} BNB</div>
            <div className="winnings-total-count">{winnings.length} {winnings.length === 1 ? 'Market' : 'Markets'} Won</div>
          </div>

          <div className="winnings-list">
            {winnings.map((winning, index) => (
              <div 
                key={index} 
                className="winnings-card"
                onClick={() => handleWinningClick(winning.market_id)}
              >
                <div className="winnings-card-header">
                  <span className={`winnings-type-badge ${winning.type}`}>
                    {winning.type === 'maker' ? 'MAKER WIN' : 'CHALLENGER WIN'}
                  </span>
                  <span className="winnings-market-id">#{winning.market_id}</span>
                </div>

                <div className="winnings-card-question">{winning.question}</div>

                <div className="winnings-card-details">
                  <div className="winnings-detail">
                    <span className="winnings-detail-label">AMOUNT WON:</span>
                    <span className="winnings-detail-value winnings-amount">
                      {winning.amount.toFixed(4)} BNB
                    </span>
                  </div>
                  {winning.type === 'challenger' && (
                    <div className="winnings-detail">
                      <span className="winnings-detail-label">YOUR TICKETS:</span>
                      <span className="winnings-detail-value">{winning.tickets}</span>
                    </div>
                  )}
                  <div className="winnings-detail">
                    <span className="winnings-detail-label">RESOLVED:</span>
                    <span className="winnings-detail-value">
                      {new Date(winning.resolved_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {winning.resolution_reason && (
                  <div className="winnings-resolution">
                    <span className="winnings-resolution-label">RESOLUTION:</span>
                    <p>{winning.resolution_reason.substring(0, 100)}{winning.resolution_reason.length > 100 ? '...' : ''}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

