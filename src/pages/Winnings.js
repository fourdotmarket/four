import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import MarketCard from '../components/MarketCard';
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
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalWinnings, setTotalWinnings] = useState(0);
  const [totalRefunds, setTotalRefunds] = useState(0);

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
      let totalWins = 0;

      for (const market of resolvedMarkets) {
        let winAmount = 0;
        let isWinner = false;

        // Check if user was the maker and won
        if (market.creator_wallet === user.wallet_address && market.outcome === true) {
          const totalPool = parseFloat(market.stake) + (parseFloat(market.ticket_price) * market.tickets_sold);
          winAmount = totalPool;
          isWinner = true;
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
            winAmount = (userTicketCount / market.tickets_sold) * totalPool;
            isWinner = true;
          }
        }

        if (isWinner) {
          userWinnings.push({
            ...market,
            winAmount,
            type: 'winning'
          });
          totalWins += winAmount;
        }
      }

      // Fetch cancelled markets for refunds
      const { data: cancelledMarkets, error: cancelledError } = await supabase
        .from('markets')
        .select('*')
        .eq('status', 'cancelled');

      if (cancelledError) throw cancelledError;

      const userRefunds = [];
      let totalRefundAmount = 0;

      for (const market of cancelledMarkets) {
        let refundAmount = 0;
        let hasRefund = false;

        // Check if user was the maker
        if (market.creator_wallet === user.wallet_address) {
          refundAmount = parseFloat(market.stake);
          hasRefund = true;
        } else {
          // Check if user bought tickets
          const { data: userTickets, error: ticketsError } = await supabase
            .from('transactions')
            .select('ticket_count, total_cost')
            .eq('market_id', market.market_id)
            .eq('buyer_wallet', user.wallet_address);

          if (!ticketsError && userTickets && userTickets.length > 0) {
            refundAmount = userTickets.reduce((sum, tx) => sum + parseFloat(tx.total_cost), 0);
            hasRefund = true;
          }
        }

        if (hasRefund) {
          userRefunds.push({
            ...market,
            winAmount: refundAmount,
            type: 'refund'
          });
          totalRefundAmount += refundAmount;
        }
      }

      setWinnings(userWinnings);
      setRefunds(userRefunds);
      setTotalWinnings(totalWins);
      setTotalRefunds(totalRefundAmount);
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

  const handleClaim = (e, marketId, amount, type) => {
    e.stopPropagation(); // Prevent card click
    // TODO: Implement claim functionality
    console.log(`Claiming ${type}:`, { marketId, amount });
    alert(`Claim functionality coming soon!\n\nMarket ID: ${marketId}\nAmount: ${amount.toFixed(4)} BNB\nType: ${type}`);
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
        <p className="winnings-subtitle">{t('winnings.subtitle')}</p>
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
      ) : winnings.length === 0 && refunds.length === 0 ? (
        <div className="winnings-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
            <path d="M4 22h16"></path>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
          </svg>
          <h3>{t('winnings.noWinningsYet')}</h3>
          <p>{t('winnings.haventWonYet')}</p>
        </div>
      ) : (
        <>
          <div className="winnings-summary">
            <div className="winnings-total-card">
              <div className="winnings-total-label">TOTAL WINNINGS</div>
              <div className="winnings-total-amount">{totalWinnings.toFixed(4)} BNB</div>
              <div className="winnings-total-count">{winnings.length} {winnings.length === 1 ? 'Market' : 'Markets'} Won</div>
            </div>
            
            {refunds.length > 0 && (
              <div className="winnings-total-card refunds">
                <div className="winnings-total-label">TOTAL REFUNDS</div>
                <div className="winnings-total-amount">{totalRefunds.toFixed(4)} BNB</div>
                <div className="winnings-total-count">{refunds.length} {refunds.length === 1 ? 'Market' : 'Markets'} Cancelled</div>
              </div>
            )}
          </div>

          {/* Winnings Section */}
          {winnings.length > 0 && (
            <div className="winnings-section">
              <h2 className="winnings-section-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                  <path d="M4 22h16"></path>
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                </svg>
                WINNINGS ({winnings.length})
              </h2>
              <div className="winnings-grid">
                {winnings.map((winning, index) => (
                  <div key={index} className="winnings-market-wrapper">
                    <MarketCard market={winning} />
                    <div className="winnings-claim-overlay">
                      <div className="winnings-amount-display">
                        <span className="winnings-amount-label">YOU WON</span>
                        <span className="winnings-amount-value">{winning.winAmount.toFixed(4)} BNB</span>
                      </div>
                      <button 
                        className="winnings-claim-btn"
                        onClick={(e) => handleClaim(e, winning.market_id, winning.winAmount, 'winning')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        CLAIM WINNINGS
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refunds Section */}
          {refunds.length > 0 && (
            <div className="winnings-section">
              <h2 className="winnings-section-title refund">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="16 12 12 8 8 12"></polyline>
                  <line x1="12" y1="16" x2="12" y2="8"></line>
                </svg>
                REFUNDS ({refunds.length})
              </h2>
              <div className="winnings-grid">
                {refunds.map((refund, index) => (
                  <div key={index} className="winnings-market-wrapper">
                    <MarketCard market={refund} />
                    <div className="winnings-claim-overlay refund">
                      <div className="winnings-amount-display">
                        <span className="winnings-amount-label">REFUND AVAILABLE</span>
                        <span className="winnings-amount-value">{refund.winAmount.toFixed(4)} BNB</span>
                      </div>
                      <button 
                        className="winnings-claim-btn refund"
                        onClick={(e) => handleClaim(e, refund.market_id, refund.winAmount, 'refund')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        CLAIM REFUND
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

