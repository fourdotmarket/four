import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';

// Multiple RPC endpoints - alternates between them
const RPC_ENDPOINTS = [
  'https://bsc-dataseed.binance.org/',
  'https://rpc.ankr.com/bsc',
];

export function useBalance(walletAddress) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const currentEndpointIndex = useRef(0);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setBalance(null);
      setLoading(false);
      return;
    }

    try {
      // Get current RPC endpoint and alternate for next call
      const rpcUrl = RPC_ENDPOINTS[currentEndpointIndex.current];
      console.log(`💰 Fetching balance from: ${rpcUrl}`);

      // Switch to next endpoint for next call (alternates)
      currentEndpointIndex.current = (currentEndpointIndex.current + 1) % RPC_ENDPOINTS.length;

      // Connect to RPC endpoint
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
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
      // Don't set balance to 0 on error, keep last known balance
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();

    // Update every 5 seconds - alternates between BSC and Ankr
    const interval = setInterval(() => {
      fetchBalance();
    }, 3500);

    return () => clearInterval(interval);
  }, [fetchBalance]);

  return { balance, loading, error, refetch: fetchBalance };
}