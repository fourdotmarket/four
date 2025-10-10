import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export function useTransactions(marketId) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!marketId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    fetchTransactions();

    // Real-time subscription
    const channel = supabase
      .channel(`transactions-${marketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `market_id=eq.${marketId}`
        },
        (payload) => {
          console.log('🆕 New transaction:', payload.new);
          setTransactions((current) => [payload.new, ...current]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // SECURITY FIX: Select only non-sensitive columns (no id, no buyer_id)
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select(`
          transaction_id,
          market_id,
          buyer_username,
          buyer_wallet,
          ticket_count,
          total_cost,
          tx_hash,
          block_number,
          timestamp,
          created_at
        `)
        .eq('market_id', marketId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTransactions(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { transactions, loading, error, refetch: fetchTransactions };
}