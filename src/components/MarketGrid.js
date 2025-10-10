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

  // Sort markets: Active (with tickets) first, then sold out
  const sortedMarkets = [...markets].sort((a, b) => {
    const aTicketsLeft = a.total_tickets - a.tickets_sold;
    const bTicketsLeft = b.total_tickets - b.tickets_sold;
    
    const aIsSoldOut = aTicketsLeft === 0;
    const bIsSoldOut = bTicketsLeft === 0;
    
    // If a is sold out but b is not, b comes first (return 1 to move a down)
    if (aIsSoldOut && !bIsSoldOut) {
      return 1;
    }
    
    // If b is sold out but a is not, a comes first (return -1 to move b down)
    if (!aIsSoldOut && bIsSoldOut) {
      return -1;
    }
    
    // Both sold out or both active - maintain creation order (newer first)
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