import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import './SubHeader.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function SubHeader() {
  const [activities, setActivities] = useState([]);
  const scrollRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Fetch initial recent activities from the past hour
    fetchRecentActivities();

    // Subscribe to real-time market creations
    const marketsChannel = supabase
      .channel('markets-activity')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'markets'
        },
        (payload) => {
          const newActivity = {
            id: `market-${payload.new.market_id}-${Date.now()}`,
            type: 'market',
            username: payload.new.creator_username,
            question: payload.new.question,
            stake: payload.new.stake,
            timestamp: new Date(payload.new.created_at)
          };
          
          addActivity(newActivity);
        }
      )
      .subscribe();

    // Subscribe to real-time ticket purchases
    const transactionsChannel = supabase
      .channel('transactions-activity')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions'
        },
        (payload) => {
          const newActivity = {
            id: `transaction-${payload.new.transaction_id}-${Date.now()}`,
            type: 'purchase',
            username: payload.new.buyer_username,
            ticketCount: payload.new.ticket_count,
            marketId: payload.new.market_id,
            totalCost: payload.new.total_cost,
            timestamp: new Date(payload.new.created_at)
          };
          
          addActivity(newActivity);
        }
      )
      .subscribe();

    // Cleanup old activities every minute (remove activities older than 1 hour)
    const cleanupInterval = setInterval(() => {
      cleanupOldActivities();
    }, 60000);

    return () => {
      supabase.removeChannel(marketsChannel);
      supabase.removeChannel(transactionsChannel);
      clearInterval(cleanupInterval);
    };
  }, []);

  const fetchRecentActivities = async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // Fetch recent markets (past hour)
      const { data: markets } = await supabase
        .from('markets')
        .select('market_id, creator_username, question, stake, created_at')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch recent transactions (past hour)
      const { data: transactions } = await supabase
        .from('transactions')
        .select('transaction_id, buyer_username, ticket_count, market_id, total_cost, created_at')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      // Combine and format activities
      const marketActivities = (markets || []).map(m => ({
        id: `market-${m.market_id}`,
        type: 'market',
        username: m.creator_username,
        question: m.question,
        stake: m.stake,
        timestamp: new Date(m.created_at)
      }));

      const purchaseActivities = (transactions || []).map(t => ({
        id: `transaction-${t.transaction_id}`,
        type: 'purchase',
        username: t.buyer_username,
        ticketCount: t.ticket_count,
        marketId: t.market_id,
        totalCost: t.total_cost,
        timestamp: new Date(t.created_at)
      }));

      // Merge and sort by timestamp
      const allActivities = [...marketActivities, ...purchaseActivities]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 15); // Keep only 15 most recent

      setActivities(allActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const addActivity = (newActivity) => {
    setActivities(prev => {
      // Add new activity at the beginning
      const updated = [newActivity, ...prev];
      
      // Keep only activities from the past hour, max 20 items
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const filtered = updated.filter(a => a.timestamp.getTime() > oneHourAgo);
      
      return filtered.slice(0, 20);
    });
  };

  const cleanupOldActivities = () => {
    setActivities(prev => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      return prev.filter(a => a.timestamp.getTime() > oneHourAgo);
    });
  };

  const truncateText = (text, maxLength = 40) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (activities.length === 0) {
    return (
      <div className="subheader">
        <div className="subheader-content">
          <div className="activity-empty">
            <span className="activity-pulse"></span>
            <span className="activity-empty-text">Waiting for activity...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="subheader">
      <div 
        className="subheader-content"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className={`activity-scroll ${isPaused ? 'paused' : ''}`} ref={scrollRef}>
          {/* Render activities twice for seamless loop */}
          {[...activities, ...activities].map((activity, index) => (
            <div key={`${activity.id}-${index}`} className="activity-item">
              {activity.type === 'market' ? (
                <>
                  <span className="activity-icon market-icon">+</span>
                  <span className="activity-username">{activity.username}</span>
                  <span className="activity-action">created market</span>
                  <span className="activity-detail">"{truncateText(activity.question, 35)}"</span>
                  <span className="activity-amount">{activity.stake} BNB</span>
                  <span className="activity-time">{formatTimeAgo(activity.timestamp)}</span>
                </>
              ) : (
                <>
                  <span className="activity-icon purchase-icon">↑</span>
                  <span className="activity-username">{activity.username}</span>
                  <span className="activity-action">bought</span>
                  <span className="activity-detail">{activity.ticketCount} {activity.ticketCount === 1 ? 'ticket' : 'tickets'}</span>
                  <span className="activity-amount">{activity.totalCost.toFixed(4)} BNB</span>
                  <span className="activity-time">{formatTimeAgo(activity.timestamp)}</span>
                </>
              )}
              <span className="activity-separator">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}