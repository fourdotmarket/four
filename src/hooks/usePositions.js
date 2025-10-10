import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export function usePositions(userId, marketId) {
  const [positions, setPositions] = useState([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId || !marketId) {
      setPositions([]);
      setTotalTickets(0);
      setTotalSpent(0);
      setLoading(false);
      return;
    }

    fetchPositions();

    // Real-time subscription
    const channel = supabase
      .channel(`positions-${userId}-${marketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `market_id=eq.${marketId}`
        },
        (payload) => {
          // Check if this transaction is for the current user
          // Note: payload.new will contain buyer_id from realtime, but we sanitize before adding to state
          if (payload.new.buyer_id === userId) {
            console.log('🆕 New position for user:', payload.new);
            
            // Sanitize before adding to state - remove buyer_id
            const { buyer_id, id, ...sanitizedTransaction } = payload.new;
            
            setPositions((current) => [sanitizedTransaction, ...current]);
            setTotalTickets((current) => current + payload.new.ticket_count);
            setTotalSpent((current) => current + payload.new.total_cost);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, marketId]);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      
      // SECURITY FIX: Select only non-sensitive columns (no id, no buyer_id)
      // We filter by buyer_id but don't return it
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
        .eq('buyer_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setPositions(data || []);
      
      // Calculate totals
      const tickets = (data || []).reduce((sum, tx) => sum + tx.ticket_count, 0);
      const spent = (data || []).reduce((sum, tx) => sum + tx.total_cost, 0);
      
      setTotalTickets(tickets);
      setTotalSpent(spent);
      setError(null);
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { 
    positions, 
    totalTickets, 
    totalSpent, 
    loading, 
    error, 
    refetch: fetchPositions 
  };
}