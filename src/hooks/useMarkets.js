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
          if (payload.new.status === 'active') {
            console.log('🆕 New market created:', payload.new);
            setMarkets((current) => [payload.new, ...current]);
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
          // Remove from active list if status changed to resolved/awaiting_resolution
          if (payload.new.status !== 'active') {
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

      // SECURITY FIX: Select only non-sensitive columns (no id, no creator_id)
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
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      setMarkets(data || []);
      setHasMore(count > page * ITEMS_PER_PAGE);
      setError(null);
    } catch (err) {
      console.error('Error fetching markets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { markets, loading, error, hasMore, refetch: fetchMarkets };
}