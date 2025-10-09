import React, { useState, useEffect } from 'react';
import './MarketCard.css';

export default function MarketCard({ market }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const deadline = market.deadline;
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [market.deadline]);

  const ticketsRemaining = market.total_tickets - market.tickets_sold;
  const progressPercentage = (market.tickets_sold / market.total_tickets) * 100;

  return (
    <div className="market-card">
      {/* Banner with fade overlay */}
      <div className="market-card-banner">
        <img 
          src={market.banner_url || '/default.png'} 
          alt="Market banner" 
          className="market-card-banner-img"
        />
        <div className="market-card-banner-fade"></div>
      </div>

      {/* Content */}
      <div className="market-card-content">
        {/* Prediction Question */}
        <h3 className="market-card-question">{market.question}</h3>

        {/* Progress Bar */}
        <div className="market-card-progress-section">
          <div className="market-card-progress-bar">
            <div 
              className="market-card-progress-fill"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="market-card-progress-text">
            {ticketsRemaining}/{market.total_tickets} tickets left
          </div>
        </div>

        {/* Ticket Price */}
        <div className="market-card-price">
          <span className="market-card-price-label">Ticket Price</span>
          <span className="market-card-price-value">{market.ticket_price} BNB</span>
        </div>

        {/* Footer: Creator & Countdown */}
        <div className="market-card-footer">
          <div className="market-card-creator">
            <div className="market-card-creator-avatar">
              {market.creator_username.charAt(0).toUpperCase()}
            </div>
            <span className="market-card-creator-name">{market.creator_username}</span>
          </div>
          <div className={`market-card-countdown ${timeLeft === 'EXPIRED' ? 'expired' : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>{timeLeft}</span>
          </div>
        </div>
      </div>
    </div>
  );
}