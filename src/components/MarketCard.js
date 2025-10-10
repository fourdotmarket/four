import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MarketCard.css';
import { useAuth } from '../hooks/useAuth';

export default function MarketCard({ market }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const deadline = market.deadline;
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        setIsExpired(true);
        return;
      }

      setIsExpired(false);

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (days > 0) {
        setTimeLeft(`${days}D ${hours}H`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}H ${minutes}M`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}M ${seconds}S`);
      } else {
        setTimeLeft(`${seconds}S`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [market.deadline]);

  // Generate 8-character random string from market_id
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

  const handleCardClick = () => {
    const betId = generateBetId(market.market_id);
    navigate(`/bet/${betId}`);
  };

  const ticketsRemaining = market.total_tickets - market.tickets_sold;
  const progressPercentage = (market.tickets_sold / market.total_tickets) * 100;
  const isSoldOut = ticketsRemaining === 0;

  // Determine if market is HOT
  const isHot = () => {
    if (isSoldOut || isExpired) return false;
    
    const totalTickets = Number(market.total_tickets);
    const remaining = Number(ticketsRemaining);
    const percentRemaining = (remaining / totalTickets) * 100;
    
    // If total tickets is 100, mark HOT at 10% or less (10 tickets or less)
    if (totalTickets === 100 && percentRemaining <= 10) {
      return true;
    }
    
    // If total tickets is 50, mark HOT at 5% or less (2.5 tickets, so <= 2 tickets)
    if (totalTickets === 50 && remaining <= 2) {
      return true;
    }
    
    // For other ticket amounts, use 10% threshold
    if (totalTickets !== 100 && totalTickets !== 50 && percentRemaining <= 10) {
      return true;
    }
    
    return false;
  };

  const hot = isHot();

  // Determine status: Active, Awaiting Resolution, or Sold Out
  const getStatus = () => {
    if (isExpired) return 'AWAITING RESOLUTION';
    if (isSoldOut) return 'SOLD OUT';
    return 'ACTIVE';
  };

  const status = getStatus();

  return (
    <div className="market-card" onClick={handleCardClick}>
      {/* Diagonal banner for SOLD OUT or AWAITING RESOLUTION */}
      {(isSoldOut || isExpired) && (
        <div className={`market-card-sold-out-banner ${isExpired ? 'awaiting' : ''}`}>
          <span>{status}</span>
        </div>
      )}

      {/* Banner with tech status badge */}
      <div className="market-card-banner">
        <img 
          src={market.banner_url || '/default.png'} 
          alt="Market banner" 
          className="market-card-banner-img"
        />
        <div className={`market-card-status-badge ${status.toLowerCase().replace(/ /g, '-')} ${hot ? 'hot' : ''}`}>
          {status}
          {hot && status === 'ACTIVE' && <span className="hot-tag">HOT</span>}
        </div>
      </div>

      {/* Content section */}
      <div className="market-card-content">
        {/* Question */}
        <h3 className="market-card-question">{market.question}</h3>

        {/* Progress section */}
        <div className="market-card-progress-section">
          <div className="market-card-progress-bar">
            <div 
              className={`market-card-progress-fill ${hot ? 'hot' : ''}`}
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="market-card-progress-text">
            <span>{ticketsRemaining}/{market.total_tickets} LEFT</span>
            <span>{progressPercentage.toFixed(0)}%</span>
          </div>
        </div>

        {/* Data grid */}
        <div className="market-card-data-grid">
          <div className="market-card-data-cell">
            <span className="market-card-data-label">TICKET</span>
            <span className="market-card-data-value">{market.ticket_price} BNB</span>
          </div>
          <div className="market-card-data-cell">
            <span className="market-card-data-label">STAKE</span>
            <span className="market-card-data-value">{market.stake} BNB</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="market-card-footer">
        {/* Creator */}
        <div className="market-card-creator">
          <span className={`market-card-creator-name ${user && market.creator_wallet === user.wallet_address ? 'own-market' : ''}`}>
            {market.creator_username}
          </span>
        </div>

        {/* Countdown */}
        <div className={`market-card-countdown ${timeLeft === 'EXPIRED' ? 'expired' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>{timeLeft}</span>
        </div>

        {/* Market ID */}
        <div className="market-card-id">#{market.market_id}</div>
      </div>
    </div>
  );
}