import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

export function useBalance(walletAddress) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setBalance(null);
      setLoading(false);
      return;
    }

    try {
      console.log('💰 Fetching balance for:', walletAddress);

      // Connect directly to BSC RPC node (NO API LIMITS!)
      const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
      
      // Get balance in Wei
      const balanceWei = await provider.getBalance(walletAddress);
      
      // Convert to BNB
      const balanceInBNB = parseFloat(ethers.formatEther(balanceWei));
      
      console.log('✅ Balance fetched:', balanceInBNB, 'BNB');
      setBalance(balanceInBNB);
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching balance:', err);
      setError(err.message);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();

    // Real-time updates every 5 seconds (NO LIMITS with RPC!)
    const interval = setInterval(() => {
      fetchBalance();
    }, 9500);

    return () => clearInterval(interval);
  }, [fetchBalance]);

  return { balance, loading, error, refetch: fetchBalance };
}