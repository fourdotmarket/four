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

  // Sort markets: Active (non-expired, non-sold-out) first, then Awaiting Resolution (expired), then Sold Out
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
    
    // Determine priority:
    // 1 = Active (not expired, not sold out)
    // 2 = Awaiting Resolution (expired, not sold out)
    // 3 = Sold Out
    const getPriority = (isExpired, isSoldOut) => {
      if (isSoldOut) return 3;
      if (isExpired) return 2;
      return 1;
    };
    
    const aPriority = getPriority(aIsExpired, aIsSoldOut);
    const bPriority = getPriority(bIsExpired, bIsSoldOut);
    
    // Sort by priority
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // If same priority, maintain creation order (already sorted by created_at desc)
    return 0;
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