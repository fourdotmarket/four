import React from 'react';
import MarketCard from '../components/MarketCard';
import { useMarkets } from '../hooks/useMarkets';
import './MarketGrid.css';

export default function MarketGrid() {
  const { markets, loading, error } = useMarkets();

  if (loading) {
    return (
      <div className="market-grid-container">
        <div className="market-grid-loading">
          <div className="loading-spinner"></div>
          <p>Loading markets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="market-grid-container">
        <div className="market-grid-error">
          <p>Error loading markets: {error}</p>
        </div>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="market-grid-container">
        <div className="market-grid-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3>No active markets</h3>
          <p>Be the first to create a prediction market!</p>
        </div>
      </div>
    );
  }

  // Sort markets: HOT first, then Active (non-expired, non-sold-out), then Awaiting Resolution (expired), then Sold Out
  const sortedMarkets = [...markets].sort((a, b) => {
    const now = Math.floor(Date.now() / 1000);
    
    // Calculate tickets remaining
    const aTicketsLeft = Number(a.total_tickets) - Number(a.tickets_sold);
    const bTicketsLeft = Number(b.total_tickets) - Number(b.tickets_sold);
    
    // Determine status for each market
    const aIsExpired = a.deadline <= now;
    const bIsExpired = b.deadline <= now;
    const aIsSoldOut = aTicketsLeft <= 0;
    const bIsSoldOut = bTicketsLeft <= 0;
    
    // Calculate HOT status
    const isHot = (market, ticketsLeft, isSoldOut, isExpired) => {
      if (isSoldOut || isExpired) return false;
      
      const totalTickets = Number(market.total_tickets);
      const remaining = Number(ticketsLeft);
      const percentRemaining = (remaining / totalTickets) * 100;
      
      if (totalTickets === 100 && percentRemaining <= 10) return true;
      if (totalTickets === 50 && remaining <= 2) return true;
      if (totalTickets !== 100 && totalTickets !== 50 && percentRemaining <= 10) return true;
      
      return false;
    };
    
    const aIsHot = isHot(a, aTicketsLeft, aIsSoldOut, aIsExpired);
    const bIsHot = isHot(b, bTicketsLeft, bIsSoldOut, bIsExpired);
    
    // Determine priority:
    // 0 = HOT (active markets with low tickets)
    // 1 = Active (not expired, not sold out, not hot)
    // 2 = Awaiting Resolution (expired, not sold out)
    // 3 = Sold Out
    const getPriority = (isExpired, isSoldOut, isHot) => {
      if (isSoldOut) return 3;
      if (isExpired) return 2;
      if (isHot) return 0;
      return 1;
    };
    
    const aPriority = getPriority(aIsExpired, aIsSoldOut, aIsHot);
    const bPriority = getPriority(bIsExpired, bIsSoldOut, bIsHot);
    
    // Sort by priority
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Within same priority, sort by creation date (most recent first)
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="market-grid-container">
      <div className="market-grid">
        {sortedMarkets.map((market) => (
          <MarketCard key={market.market_id} market={market} />
        ))}
      </div>
    </div>
  );
}