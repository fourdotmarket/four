import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import axios from 'axios';

// Module-level tracking - survives React Strict Mode unmount/remount
const authRequestsInFlight = new Map();
const completedAuthUsers = new Map(); // Now stores user data, not just a Set

export function useAuth() {
  const { ready, authenticated, user: privyUser, getAccessToken } = usePrivy();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [showPrivateKeyUI, setShowPrivateKeyUI] = useState(false);
  const [privateKeyData, setPrivateKeyData] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  
  const abortControllerRef = useRef(null);
  const tokenRefreshTimeoutRef = useRef(null);

  const closePrivateKeyUI = useCallback(() => {
    setShowPrivateKeyUI(false);
    setPrivateKeyData(null);
  }, []);

  // Helper function to get fresh token with retry logic
  const getFreshToken = useCallback(async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const token = await getAccessToken();
        if (token) {
          return token;
        }
      } catch (error) {
        console.error(`Token fetch attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 500));
        }
      }
    }
    throw new Error('Failed to get access token after retries');
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) {
      setUser(null);
      setAccessToken(null);
      setLoading(false);
      setAuthReady(false);
      setShowPrivateKeyUI(false);
      setPrivateKeyData(null);
      // Clear cache on logout
      if (!authenticated) {
        completedAuthUsers.clear();
        authRequestsInFlight.clear();
      }
      return;
    }

    const currentPrivyUserId = privyUser?.id || privyUser?.sub;
    
    if (!currentPrivyUserId) {
      setLoading(true);
      setAuthReady(false);
      return;
    }

    // Check if already completed for this user - load from cache
    if (completedAuthUsers.has(currentPrivyUserId)) {
      const cachedData = completedAuthUsers.get(currentPrivyUserId);
      setUser(cachedData.user);
      setAccessToken(cachedData.token);
      setLoading(false);
      setAuthReady(true);
      return;
    }

    // Check if request is already in flight for this user
    if (authRequestsInFlight.has(currentPrivyUserId)) {
      return;
    }

    // Mark request as in flight BEFORE any async work
    authRequestsInFlight.set(currentPrivyUserId, true);
    setLoading(true);
    setAuthReady(false);
    
    abortControllerRef.current = new AbortController();

    async function registerOrLogin() {
      try {
        let provider = 'unknown';
        let email = null;
        
        if (privyUser?.email) {
          provider = 'email';
          email = privyUser.email.address;
        } else if (privyUser?.google) {
          provider = 'google';
          email = privyUser.google.email;
        } else if (privyUser?.twitter) {
          provider = 'twitter';
          email = privyUser.twitter.username;
        }

        // CRITICAL: Wait for token with retry logic
        const token = await getFreshToken();
        
        if (!token) {
          throw new Error('No access token available');
        }

        const response = await axios.post('/api/auth', 
          { provider, email },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            signal: abortControllerRef.current?.signal
          }
        );

        const userData = response.data.user;
        const isNewUser = response.data.isNewUser;
        const privateKey = response.data.privateKey;

        // Cache the user data and token
        completedAuthUsers.set(currentPrivyUserId, {
          user: userData,
          token: token
        });
        authRequestsInFlight.delete(currentPrivyUserId);

        setUser(userData);
        setAccessToken(token);
        setLoading(false);
        setAuthReady(true); // CRITICAL: Only set ready when everything is complete

        if (isNewUser && privateKey && userData.wallet_address) {
          setPrivateKeyData({
            privateKey: privateKey,
            walletAddress: userData.wallet_address
          });
          setShowPrivateKeyUI(true);
        }

      } catch (error) {
        if (axios.isCancel(error) || error.name === 'CanceledError' || error.name === 'AbortError') {
          authRequestsInFlight.delete(currentPrivyUserId);
          return;
        }

        console.error('Auth error:', error);
        authRequestsInFlight.delete(currentPrivyUserId);

        // Don't set fallback user with null token - better to show error
        setUser(null);
        setAccessToken(null);
        setLoading(false);
        setAuthReady(false);
      }
    }

    registerOrLogin();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (tokenRefreshTimeoutRef.current) {
        clearTimeout(tokenRefreshTimeoutRef.current);
      }
    };

  }, [ready, authenticated, privyUser, getFreshToken]);

  // Refresh token periodically (every 5 minutes)
  useEffect(() => {
    if (!authReady || !authenticated) return;

    const refreshToken = async () => {
      try {
        const newToken = await getFreshToken();
        if (newToken) {
          setAccessToken(newToken);
          // Update cache
          const currentPrivyUserId = privyUser?.id || privyUser?.sub;
          if (currentPrivyUserId && completedAuthUsers.has(currentPrivyUserId)) {
            const cached = completedAuthUsers.get(currentPrivyUserId);
            completedAuthUsers.set(currentPrivyUserId, {
              ...cached,
              token: newToken
            });
          }
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    };

    // Refresh token every 5 minutes
    const interval = setInterval(refreshToken, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [authReady, authenticated, getFreshToken, privyUser]);

  return { 
    user, 
    loading, 
    authenticated, 
    accessToken,
    authReady, // NEW: explicit flag for when auth is fully ready
    showPrivateKeyUI,
    privateKeyData,
    closePrivateKeyUI,
    getFreshToken // Export for manual token refresh
  };
}