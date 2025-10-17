import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import './SubHeader.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function SubHeader() {
  const { t } = useLanguage();
  const [activities, setActivities] = useState([]);
  const processedIds = useRef(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecentActivities();

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
          if (processedIds.current.has(uniqueId)) return;
          processedIds.current.add(uniqueId);
          
          const newActivity = {
            id: uniqueId,
            type: 'market',
            username: payload.new.creator_username,
            question: payload.new.question,
            marketId: payload.new.market_id,
            timestamp: new Date(payload.new.created_at)
          };
          
          addActivity(newActivity);
        }
      )
      .subscribe();

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
          if (processedIds.current.has(uniqueId)) return;
          processedIds.current.add(uniqueId);
          
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
            marketId: payload.new.market_id,
            marketQuestion: market?.question || `Market #${payload.new.market_id}`,
            timestamp: new Date(payload.new.created_at)
          };
          
          addActivity(newActivity);
        }
      )
      .subscribe();

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

      const { data: markets } = await supabase
        .from('markets')
        .select('market_id, creator_username, question, created_at')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(4);

      const { data: transactions } = await supabase
        .from('transactions')
        .select('transaction_id, buyer_username, ticket_count, market_id, created_at')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(4);

      const marketIds = [...new Set(transactions?.map(t => t.market_id) || [])];
      const { data: marketsData } = await supabase
        .from('markets')
        .select('market_id, question')
        .in('market_id', marketIds);

      const marketMap = new Map(marketsData?.map(m => [m.market_id, m.question]) || []);

      const marketActivities = (markets || []).map(m => {
        const uniqueId = `market-${m.market_id}`;
        processedIds.current.add(uniqueId);
        return {
          id: uniqueId,
          type: 'market',
          username: m.creator_username,
          question: m.question,
          marketId: m.market_id,
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
          marketId: t.market_id,
          marketQuestion: marketMap.get(t.market_id) || `Market #${t.market_id}`,
          timestamp: new Date(t.created_at)
        };
      });

      const allActivities = [...marketActivities, ...purchaseActivities]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 6);

      setActivities(allActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const addActivity = (newActivity) => {
    setActivities(prev => {
      const exists = prev.some(a => a.id === newActivity.id);
      if (exists) return prev;
      
      const updated = [...prev, newActivity];
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const filtered = updated.filter(a => a.timestamp.getTime() > oneHourAgo);
      
      return filtered.slice(-6);
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

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
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

  const handleMarketClick = (marketId, e) => {
    e.stopPropagation();
    const betId = generateBetId(marketId);
    navigate(`/bet/${betId}`);
  };

  if (activities.length === 0) {
    return (
      <div className="subheader">
        <div className="subheader-content">
          <div className="activity-empty">
            <span className="activity-pulse"></span>
            <span className="activity-empty-text">{t('activity.waitingForActivity')}</span>
          </div>
        </div>
      </div>
    );
  }

  // Only repeat if we have enough activities (4+), otherwise show without repetition
  const repeatedActivities = activities.length >= 4 
    ? [...activities, ...activities, ...activities, ...activities]
    : activities;

  // Disable animation if too few activities
  const shouldAnimate = activities.length >= 4;

  return (
    <div className="subheader">
      <div className="subheader-content">
        {/* Stable animation container - only animates if 4+ activities */}
        <div className={`activity-scroll-wrapper ${shouldAnimate ? 'animate' : 'static'}`}>
          <div className="activity-scroll">
            {repeatedActivities.map((activity, index) => (
              <div key={`${activity.id}-${index}`} className="activity-item">
                {activity.type === 'market' ? (
                  <>
                    <span className="activity-icon market-icon">+</span>
                    <span className="activity-username">{activity.username}</span>
                    <span className="activity-action">{t('activity.created')}</span>
                    <span 
                      className="activity-detail clickable"
                      onClick={(e) => handleMarketClick(activity.marketId, e)}
                    >
                      "{truncateText(activity.question, 25)}"
                    </span>
                    <span className="activity-time">{formatTimeAgo(activity.timestamp)}</span>
                  </>
                ) : (
                  <>
                    <span className="activity-icon purchase-icon">↑</span>
                    <span className="activity-username">{activity.username}</span>
                    <span className="activity-action">
                      {t('activity.bought')} {activity.ticketCount} {activity.ticketCount === 1 ? t('activity.ticket') : t('activity.tickets')}
                    </span>
                    <span 
                      className="activity-detail clickable"
                      onClick={(e) => handleMarketClick(activity.marketId, e)}
                    >
                      {t('activity.in')} "{truncateText(activity.marketQuestion, 20)}"
                    </span>
                    <span className="activity-time">{formatTimeAgo(activity.timestamp)}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}