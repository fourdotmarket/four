import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import './Bet.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function Bet() {
  const { betId } = useParams();
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Convert bet ID back to market_id (reverse of the generation function)
  const getMarketIdFromBetId = async (betId) => {
    // Fetch all markets and find the one that matches this bet ID
    const { data: markets, error: fetchError } = await supabase
      .from('markets')
      .select('*')
      .eq('status', 'active');

    if (fetchError) throw fetchError;

    // Generate bet IDs for all markets and find match
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

  const fetchMarket = async () => {
    try {
      setLoading(true);
      
      // Get market_id from bet_id
      const marketId = await getMarketIdFromBetId(betId);
      
      if (!marketId) {
        throw new Error('Market not found');
      }

      const { data, error: fetchError } = await supabase
        .from('markets')
        .select('*')
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
  const progressPercentage = (market.tickets_sold / market.total_tickets) * 100;

  return (
    <div className="bet-page">
      <div className="bet-container">
        <div className="bet-header">
          <h1>{market.question}</h1>
          <div className="bet-status-badge">ACTIVE</div>
        </div>

        <div className="bet-banner">
          <img 
            src={market.banner_url || '/default.png'} 
            alt="Market banner"
          />
        </div>

        <div className="bet-stats">
          <div className="bet-stat-card">
            <span className="bet-stat-label">STAKE</span>
            <span className="bet-stat-value">{market.stake} BNB</span>
          </div>
          <div className="bet-stat-card">
            <span className="bet-stat-label">TICKET PRICE</span>
            <span className="bet-stat-value">{market.ticket_price} BNB</span>
          </div>
          <div className="bet-stat-card">
            <span className="bet-stat-label">TICKETS LEFT</span>
            <span className="bet-stat-value">{ticketsRemaining}/{market.total_tickets}</span>
          </div>
          <div className="bet-stat-card">
            <span className="bet-stat-label">PROGRESS</span>
            <span className="bet-stat-value">{progressPercentage.toFixed(0)}%</span>
          </div>
        </div>

        <div className="bet-progress-bar">
          <div 
            className="bet-progress-fill"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>

        <div className="bet-creator-info">
          <span className="bet-creator-label">Created by:</span>
          <span className="bet-creator-name">{market.creator_username}</span>
        </div>

        <div className="bet-actions">
          <button className="bet-buy-btn">
            BUY TICKETS
          </button>
        </div>
      </div>
    </div>
  );
}