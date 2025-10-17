import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useLanguage } from '../context/LanguageContext';
import MarketCard from '../components/MarketCard';
import './Resolved.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const ITEMS_PER_PAGE = 30;

export default function Resolved() {
  const { t } = useLanguage();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchResolvedMarkets();
  }, [page]);

  useEffect(() => {
    const channel = supabase
      .channel('resolved-markets-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets'
        },
        (payload) => {
          const currentTimestamp = Math.floor(Date.now() / 1000);
          const isExpired = payload.new.deadline < currentTimestamp;
          const isResolved = payload.new.status === 'resolved' || payload.new.status === 'awaiting_resolution';
          
          if (isResolved || isExpired) {
            console.log('🔄 Market updated (resolved/expired):', payload.new);
            fetchResolvedMarkets();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchResolvedMarkets = async () => {
    try {
      setLoading(true);
      
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      const currentTimestamp = Math.floor(Date.now() / 1000);

      const { data, error: fetchError, count } = await supabase
        .from('markets')
        .select(`
          market_id,
          question,
          creator_username,
          creator_wallet,
          stake,
          ticket_price,
          total_tickets,
          tickets_sold,
          deadline,
          created_at_timestamp,
          tx_hash,
          block_number,
          status,
          outcome,
          banner_url,
          created_at,
          updated_at
        `, { count: 'exact' })
        .or(`status.in.(resolved,awaiting_resolution),deadline.lt.${currentTimestamp}`)
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      setMarkets(data || []);
      setHasMore(count > page * ITEMS_PER_PAGE);
      setError(null);
    } catch (err) {
      console.error('Error fetching resolved markets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  return (
    <div className="resolved-page">
      <div className="resolved-header">
        <div className="resolved-title-section">
          <h1 className="resolved-title">{t('resolved.title')}</h1>
          <p className="resolved-subtitle">{t('resolved.subtitleDetailed')}</p>
        </div>
      </div>

      {loading && page === 1 ? (
        <div className="resolved-loading">
          <div className="loading-spinner"></div>
          <p>LOADING RESOLVED MARKETS...</p>
        </div>
      ) : error ? (
        <div className="resolved-error">
          <div className="error-box">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>{t('resolved.errorLoading')}</p>
            <span>{error}</span>
          </div>
        </div>
      ) : markets.length === 0 ? (
        <div className="resolved-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          <h3>{t('resolved.noResolved')}</h3>
          <p>{t('resolved.completedMarkets')}</p>
        </div>
      ) : (
        <>
          <div className="resolved-grid">
            {markets.map((market) => (
              <MarketCard key={market.market_id} market={market} />
            ))}
          </div>

          {hasMore && (
            <div className="resolved-load-more">
              <button 
                className="resolved-load-more-btn" 
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="btn-spinner"></div>
                    {t('resolved.loadingMore')}
                  </>
                ) : (
                  t('resolved.loadMore')
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
