import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import './SubHeader.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function SubHeader() {
  const [activities, setActivities] = useState([]);
  const processedIds = useRef(new Set());

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
          const uniqueId = `market-${payload.new.market_id}`;
          
          // Prevent duplicates
          if (processedIds.current.has(uniqueId)) return;
          processedIds.current.add(uniqueId);
          
          const newActivity = {
            id: uniqueId,
            type: 'market',
            username: payload.new.creator_username,
            question: payload.new.question,
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
        async (payload) => {
          const uniqueId = `transaction-${payload.new.transaction_id}`;
          
          // Prevent duplicates
          if (processedIds.current.has(uniqueId)) return;
          processedIds.current.add(uniqueId);
          
          // Fetch market details to get question
          const { data: market } = await supabase
            .from('markets')
            .select('question')
            .eq('market_id', payload.new.market_id)
            .single();
          
          const newActivity = {
            id: uniqueId,
            type: 'purchase',
            username: payload.new.buyer_username,
            ticketCount: payload.new.ticket_count,
            marketQuestion: market?.question || `Market #${payload.new.market_id}`,
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
        .select('market_id, creator_username, question, created_at')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(8);

      // Fetch recent transactions (past hour) with market details
      const { data: transactions } = await supabase
        .from('transactions')
        .select('transaction_id, buyer_username, ticket_count, market_id, created_at')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(8);

      // Get market questions for transactions
      const marketIds = [...new Set(transactions?.map(t => t.market_id) || [])];
      const { data: marketsData } = await supabase
        .from('markets')
        .select('market_id, question')
        .in('market_id', marketIds);

      const marketMap = new Map(marketsData?.map(m => [m.market_id, m.question]) || []);

      // Combine and format activities
      const marketActivities = (markets || []).map(m => {
        const uniqueId = `market-${m.market_id}`;
        processedIds.current.add(uniqueId);
        return {
          id: uniqueId,
          type: 'market',
          username: m.creator_username,
          question: m.question,
          timestamp: new Date(m.created_at)
        };
      });

      const purchaseActivities = (transactions || []).map(t => {
        const uniqueId = `transaction-${t.transaction_id}`;
        processedIds.current.add(uniqueId);
        return {
          id: uniqueId,
          type: 'purchase',
          username: t.buyer_username,
          ticketCount: t.ticket_count,
          marketQuestion: marketMap.get(t.market_id) || `Market #${t.market_id}`,
          timestamp: new Date(t.created_at)
        };
      });

      // Merge and sort by timestamp
      const allActivities = [...marketActivities, ...purchaseActivities]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 12); // Keep only 12 most recent

      setActivities(allActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const addActivity = (newActivity) => {
    setActivities(prev => {
      // Add new activity at the end (will appear on right side as it scrolls)
      const updated = [...prev, newActivity];
      
      // Keep only activities from the past hour, max 15 items
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const filtered = updated.filter(a => a.timestamp.getTime() > oneHourAgo);
      
      return filtered.slice(-15); // Keep last 15
    });
  };

  const cleanupOldActivities = () => {
    setActivities(prev => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      return prev.filter(a => a.timestamp.getTime() > oneHourAgo);
    });
  };

  const truncateText = (text, maxLength = 25) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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
      <div className="subheader-content">
        <div className="activity-scroll">
          {/* Render activities 3 times for seamless loop */}
          {[...activities, ...activities, ...activities].map((activity, index) => (
            <div key={`${activity.id}-${index}`} className="activity-item">
              {activity.type === 'market' ? (
                <>
                  <span className="activity-icon market-icon">+</span>
                  <span className="activity-username">{activity.username}</span>
                  <span className="activity-action">created</span>
                  <span className="activity-detail">"{truncateText(activity.question, 25)}"</span>
                </>
              ) : (
                <>
                  <span className="activity-icon purchase-icon">↑</span>
                  <span className="activity-username">{activity.username}</span>
                  <span className="activity-action">bought {activity.ticketCount} ticket</span>
                  <span className="activity-detail">in "{truncateText(activity.marketQuestion, 20)}"</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}