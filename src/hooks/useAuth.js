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
  const privateKeyCheckRef = useRef(false); // Prevent duplicate checks

  const closePrivateKeyUI = useCallback(() => {
    console.log('🔒 Closing Private Key UI');
    setShowPrivateKeyUI(false);
    setPrivateKeyData(null);
    privateKeyCheckRef.current = false;
    
    // Mark that user has seen their private key and cache the auth data
    const currentPrivyUserId = privyUser?.id || privyUser?.sub;
    if (currentPrivyUserId) {
      try {
        localStorage.setItem(`pkui_shown_${currentPrivyUserId}`, 'true');
        console.log('✅ Marked private key as shown in localStorage');
        
        // Now safe to cache the user data since they've seen the private key
        if (user && accessToken) {
          completedAuthUsers.set(currentPrivyUserId, {
            user: user,
            token: accessToken
          });
          console.log('✅ Auth data cached for future sessions');
        }
      } catch (e) {
        console.error('Failed to save private key UI state:', e);
      }
    }
  }, [privyUser, user, accessToken]);

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
      privateKeyCheckRef.current = false;
      
      // Clear cache on logout
      if (!authenticated) {
        completedAuthUsers.clear();
        authRequestsInFlight.clear();
        
        // Clear all private key UI flags from localStorage
        try {
          const keys = Object.keys(localStorage);
          keys.forEach(key => {
            if (key.startsWith('pkui_shown_')) {
              localStorage.removeItem(key);
            }
          });
          console.log('🧹 Cleared all private key UI flags on logout');
        } catch (e) {
          console.error('Failed to clear private key UI flags:', e);
        }
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
    // BUT: Always make API call if user hasn't seen private key yet (for new users)
    const hasSeenPrivateKey = localStorage.getItem(`pkui_shown_${currentPrivyUserId}`) === 'true';
    
    if (completedAuthUsers.has(currentPrivyUserId) && hasSeenPrivateKey) {
      const cachedData = completedAuthUsers.get(currentPrivyUserId);
      console.log('✅ Loading from cache for user:', currentPrivyUserId);
      setUser(cachedData.user);
      setAccessToken(cachedData.token);
      setLoading(false);
      setAuthReady(true);
      console.log('✅ Auth ready from cache');
      return;
    }

    // Check if request is already in flight for this user
    if (authRequestsInFlight.has(currentPrivyUserId)) {
      console.log('⏸️  Auth request already in flight, waiting...');
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

        console.log('🔑 Auth response:', { 
          isNewUser, 
          hasPrivateKey: !!privateKey, 
          hasWallet: !!userData.wallet_address 
        });

        // Set user data immediately - this is critical for components that check user state
        setUser(userData);
        setAccessToken(token);
        setLoading(false);
        // Set authReady to true immediately so components can proceed
        setAuthReady(true);

        // Check if this is a new user who hasn't seen their private key yet
        const hasSeenPrivateKey = localStorage.getItem(`pkui_shown_${currentPrivyUserId}`) === 'true';
        
        if (isNewUser && privateKey && userData.wallet_address && !hasSeenPrivateKey) {
          console.log('🔐 NEW USER! Showing Private Key UI');
          console.log('Private Key:', privateKey);
          console.log('Wallet Address:', userData.wallet_address);
          
          // Mark that we're showing the private key
          privateKeyCheckRef.current = true;
          
          // Set the private key data with a slight delay to ensure state updates properly
          setTimeout(() => {
            setPrivateKeyData({
              privateKey: privateKey,
              walletAddress: userData.wallet_address
            });
            setShowPrivateKeyUI(true);
            console.log('✅ Private Key UI state set');
          }, 100);
          
          // Don't cache until user dismisses the private key UI
          authRequestsInFlight.delete(currentPrivyUserId);
        } else {
          // Cache the user data and token only if not showing private key UI
          completedAuthUsers.set(currentPrivyUserId, {
            user: userData,
            token: token
          });
          authRequestsInFlight.delete(currentPrivyUserId);
          privateKeyCheckRef.current = false;
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