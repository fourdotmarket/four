import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const ITEMS_PER_PAGE = 30;

export function useMarkets(page = 1) {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchMarkets();

    const channel = supabase
      .channel('markets-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'markets'
        },
        (payload) => {
          const currentTimestamp = Math.floor(Date.now() / 1000);
          const isExpired = payload.new.deadline < currentTimestamp;
          
          console.log('🔔 Real-time INSERT event received:', {
            market_id: payload.new.market_id,
            status: payload.new.status,
            deadline: payload.new.deadline,
            currentTimestamp,
            isExpired
          });
          
          // Only add if active and not expired
          if (payload.new.status === 'active' && !isExpired) {
            console.log('🆕 New market added to list:', payload.new.market_id);
            setMarkets((current) => [payload.new, ...current]);
          } else {
            console.log('⚠️ Market not added - status:', payload.new.status, 'isExpired:', isExpired);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets'
        },
        (payload) => {
          console.log('🔄 Market updated:', payload.new);
          const currentTimestamp = Math.floor(Date.now() / 1000);
          const isExpired = payload.new.deadline < currentTimestamp;
          
          // Remove from active list if status changed or market expired
          if (payload.new.status !== 'active' || isExpired) {
            setMarkets((current) =>
              current.filter((m) => m.market_id !== payload.new.market_id)
            );
          } else {
            setMarkets((current) =>
              current.map((m) =>
                m.market_id === payload.new.market_id ? payload.new : m
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page]);

  const fetchMarkets = async () => {
    try {
      setLoading(true);
      
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      const currentTimestamp = Math.floor(Date.now() / 1000);

      console.log('📊 Fetching markets:', {
        page,
        from,
        to,
        currentTimestamp,
        currentTime: new Date().toISOString()
      });

      // SECURITY FIX: Select only non-sensitive columns (no id, no creator_id)
      // Only show active markets that haven't expired
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
          twitter_link,
          created_at,
          updated_at
        `, { count: 'exact' })
        .eq('status', 'active')
        .gte('deadline', currentTimestamp)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      console.log('✅ Fetched markets:', {
        count: data?.length || 0,
        total: count,
        hasMore: count > page * ITEMS_PER_PAGE
      });

      setMarkets(data || []);
      setHasMore(count > page * ITEMS_PER_PAGE);
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching markets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { markets, loading, error, hasMore, refetch: fetchMarkets };
}