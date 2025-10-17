import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import axios from 'axios';

// Module-level tracking - survives React Strict Mode unmount/remount
const authRequestsInFlight = new Map();
const completedAuthUsers = new Map();
const AUTH_TIMEOUT_MS = 15000; // 15 seconds timeout
const MAX_RETRIES = 3;
const TOKEN_REFRESH_INTERVAL = 55 * 60 * 1000; // 55 minutes (tokens last 60 min)

// Helper to safely use localStorage
const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage getItem failed:', e);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('localStorage setItem failed:', e);
      return false;
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('localStorage removeItem failed:', e);
      return false;
    }
  }
};

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
  const privateKeyCheckRef = useRef(false);
  const authTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const hasLoadedFromCacheRef = useRef(false);

  // Helper to cache user data to both memory and localStorage
  const cacheUserData = useCallback((userId, userData, token) => {
    // Cache to memory
    completedAuthUsers.set(userId, { user: userData, token });
    
    // Cache to localStorage for persistence across refreshes
    safeLocalStorage.setItem(`auth_user_${userId}`, JSON.stringify({
      user: userData,
      cachedAt: Date.now()
    }));
    
    console.log('✅ Auth data cached to memory and localStorage');
  }, []);

  // Helper to load user data from cache
  const loadFromCache = useCallback((userId) => {
    // Try memory cache first (fastest)
    if (completedAuthUsers.has(userId)) {
      console.log('✅ Loading from memory cache');
      return completedAuthUsers.get(userId);
    }

    // Try localStorage cache
    const cached = safeLocalStorage.getItem(`auth_user_${userId}`);
    if (cached) {
      try {
        const { user: userData, cachedAt } = JSON.parse(cached);
        // Cache is valid for 24 hours
        if (Date.now() - cachedAt < 24 * 60 * 60 * 1000) {
          console.log('✅ Loading from localStorage cache');
          // Restore to memory cache
          completedAuthUsers.set(userId, { user: userData, token: null });
          return { user: userData, token: null };
        } else {
          console.log('⚠️ localStorage cache expired');
          safeLocalStorage.removeItem(`auth_user_${userId}`);
        }
      } catch (e) {
        console.error('Failed to parse cached auth data:', e);
        safeLocalStorage.removeItem(`auth_user_${userId}`);
      }
    }

    return null;
  }, []);

  const closePrivateKeyUI = useCallback(() => {
    console.log('🔒 Closing Private Key UI');
    setShowPrivateKeyUI(false);
    setPrivateKeyData(null);
    privateKeyCheckRef.current = false;
    
    const currentPrivyUserId = privyUser?.id || privyUser?.sub;
    if (currentPrivyUserId) {
      safeLocalStorage.setItem(`pkui_shown_${currentPrivyUserId}`, 'true');
      console.log('✅ Marked private key as shown');
      
      // Cache user data now that private key UI is closed
      if (user && accessToken) {
        cacheUserData(currentPrivyUserId, user, accessToken);
      }
    }
  }, [privyUser, user, accessToken, cacheUserData]);

  const getFreshToken = useCallback(async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const token = await getAccessToken();
        if (token) {
          setAccessToken(token);
          return token;
        }
      } catch (error) {
        console.error(`Token fetch attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 500));
        }
      }
    }
    throw new Error('Failed to get access token after retries');
  }, [getAccessToken]);

  // Setup automatic token refresh
  useEffect(() => {
    if (!authenticated || !user) {
      // Clear refresh timer if not authenticated
      if (tokenRefreshTimeoutRef.current) {
        clearTimeout(tokenRefreshTimeoutRef.current);
        tokenRefreshTimeoutRef.current = null;
      }
      return;
    }

    const refreshToken = async () => {
      try {
        console.log('🔄 Auto-refreshing token...');
        const newToken = await getFreshToken();
        if (newToken) {
          console.log('✅ Token refreshed successfully');
          // Schedule next refresh
          tokenRefreshTimeoutRef.current = setTimeout(refreshToken, TOKEN_REFRESH_INTERVAL);
        }
      } catch (error) {
        console.error('❌ Failed to refresh token:', error);
        // Retry in 5 minutes on failure
        tokenRefreshTimeoutRef.current = setTimeout(refreshToken, 5 * 60 * 1000);
      }
    };

    // Initial token refresh schedule
    tokenRefreshTimeoutRef.current = setTimeout(refreshToken, TOKEN_REFRESH_INTERVAL);

    return () => {
      if (tokenRefreshTimeoutRef.current) {
        clearTimeout(tokenRefreshTimeoutRef.current);
      }
    };
  }, [authenticated, user, getFreshToken]);

  // Clear stuck auth requests after timeout
  const clearStuckAuth = useCallback((userId) => {
    console.log('🧹 Clearing stuck auth for user:', userId);
    authRequestsInFlight.delete(userId);
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    // CRITICAL: Wait for Privy to be fully ready before doing anything
    if (!ready) {
      console.log('⏳ Waiting for Privy to initialize...', { ready });
      setLoading(true);
      setAuthReady(false);
      return;
    }

    if (!authenticated) {
      console.log('🔴 Not authenticated', { ready, authenticated });
      setUser(null);
      setAccessToken(null);
      setLoading(false);
      setAuthReady(true); // Not authenticated, but check is complete
      setShowPrivateKeyUI(false);
      setPrivateKeyData(null);
      privateKeyCheckRef.current = false;
      retryCountRef.current = 0;
      hasLoadedFromCacheRef.current = false;
      
      // Clear cache on logout
      completedAuthUsers.clear();
      authRequestsInFlight.clear();
      
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('pkui_shown_') || key.startsWith('auth_user_')) {
            safeLocalStorage.removeItem(key);
          }
        });
        console.log('🧹 Cleared auth cache on logout');
      } catch (e) {
        console.error('Failed to clear auth cache:', e);
      }
      return;
    }

    console.log('✅ Privy ready and user authenticated', { ready, authenticated });

    const currentPrivyUserId = privyUser?.id || privyUser?.sub;
    
    if (!currentPrivyUserId) {
      console.log('⚠️ No Privy user ID available yet, waiting...');
      setLoading(true);
      setAuthReady(false);
      return;
    }

    console.log('✅ Privy user ID available:', currentPrivyUserId);

    // FIX: Try to load from cache first (memory or localStorage)
    // This doesn't depend on private key UI check anymore!
    if (!hasLoadedFromCacheRef.current) {
      const cachedData = loadFromCache(currentPrivyUserId);
      if (cachedData && cachedData.user) {
        console.log('✅ Restored user from cache for:', currentPrivyUserId);
        setUser(cachedData.user);
        setLoading(false);
        setAuthReady(true);
        hasLoadedFromCacheRef.current = true;
        retryCountRef.current = 0;
        
        // Get fresh token in background
        if (!cachedData.token) {
          getFreshToken().then(token => {
            console.log('✅ Fresh token obtained for cached user');
            cacheUserData(currentPrivyUserId, cachedData.user, token);
          }).catch(err => {
            console.error('⚠️ Failed to get fresh token for cached user:', err);
          });
        } else {
          setAccessToken(cachedData.token);
        }
        return;
      }
    }

    // Check if request is already in flight
    const requestData = authRequestsInFlight.get(currentPrivyUserId);
    if (requestData) {
      const timeSinceStart = Date.now() - requestData.startTime;
      
      if (timeSinceStart > AUTH_TIMEOUT_MS) {
        console.log('⏰ Auth request timed out, retrying...');
        clearStuckAuth(currentPrivyUserId);
        retryCountRef.current++;
        
        if (retryCountRef.current >= MAX_RETRIES) {
          console.error('❌ Max retries reached, giving up');
          setUser(null);
          setAccessToken(null);
          setLoading(false);
          setAuthReady(true);
          authRequestsInFlight.delete(currentPrivyUserId);
          return;
        }
      } else {
        console.log('⏸️ Auth request in progress, waiting...', `${Math.round(timeSinceStart/1000)}s elapsed`);
        // Set loading state so UI shows authenticating
        setLoading(true);
        setAuthReady(false);
        return;
      }
    }

    // Mark request as in flight
    authRequestsInFlight.set(currentPrivyUserId, { 
      startTime: Date.now(),
      attempt: retryCountRef.current + 1
    });
    setLoading(true);
    setAuthReady(false);
    
    console.log(`🔄 Starting auth request (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);
    
    abortControllerRef.current = new AbortController();

    // Set timeout to clear stuck requests
    authTimeoutRef.current = setTimeout(() => {
      console.log('⏰ Auth timeout triggered, will retry on next render');
      clearStuckAuth(currentPrivyUserId);
      setAuthReady(true); // Trigger re-render
    }, AUTH_TIMEOUT_MS);

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

        console.log('🔑 Getting access token...');
        const token = await getFreshToken();
        
        if (!token) {
          throw new Error('No access token available');
        }

        console.log('📡 Calling /api/auth...');
        const response = await axios.post('/api/auth', 
          { provider, email },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            signal: abortControllerRef.current?.signal,
            timeout: 10000 // 10 second timeout for API call
          }
        );

        const userData = response.data.user;
        const isNewUser = response.data.isNewUser;
        const privateKey = response.data.privateKey;

        console.log('✅ Auth API success:', { 
          isNewUser, 
          hasPrivateKey: !!privateKey,
          username: userData.username
        });

        // Clear timeout since we succeeded
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
          authTimeoutRef.current = null;
        }

        // Set user data immediately
        setUser(userData);
        setAccessToken(token);
        setLoading(false);
        setAuthReady(true);
        retryCountRef.current = 0; // Reset retry count on success
        hasLoadedFromCacheRef.current = true;

        console.log('✅ User authenticated - authReady=true');

        // FIX: Cache user data immediately for ALL users
        // Don't wait for private key UI to be closed
        cacheUserData(currentPrivyUserId, userData, token);

        // Handle private key UI for new users
        const hasSeenPrivateKey = safeLocalStorage.getItem(`pkui_shown_${currentPrivyUserId}`) === 'true';
        
        if (isNewUser && privateKey && userData.wallet_address && !hasSeenPrivateKey) {
          console.log('🔐 NEW USER! Showing Private Key UI');
          privateKeyCheckRef.current = true;
          
          setTimeout(() => {
            setPrivateKeyData({
              privateKey: privateKey,
              walletAddress: userData.wallet_address
            });
            setShowPrivateKeyUI(true);
          }, 100);
        }
        
        // Clean up in-flight tracking
        authRequestsInFlight.delete(currentPrivyUserId);

      } catch (error) {
        // Clear timeout
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
          authTimeoutRef.current = null;
        }

        if (axios.isCancel(error) || error.name === 'CanceledError' || error.name === 'AbortError') {
          console.log('🚫 Auth request cancelled');
          authRequestsInFlight.delete(currentPrivyUserId);
          return;
        }

        console.error('❌ Auth error:', error.message);
        authRequestsInFlight.delete(currentPrivyUserId);

        // On error, allow retry
        setUser(null);
        setAccessToken(null);
        setLoading(false);
        setAuthReady(true); // Set true to allow retry

        // Auto-retry on next render if not at max retries
        if (retryCountRef.current < MAX_RETRIES) {
          console.log(`🔄 Will retry on next render (${retryCountRef.current + 1}/${MAX_RETRIES})`);
        }
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
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
      }
    };

  }, [ready, authenticated, privyUser, getFreshToken, clearStuckAuth, loadFromCache, cacheUserData]);

  // Expose method to manually trigger auth retry
  const retryAuth = useCallback(() => {
    console.log('🔄 Manual auth retry triggered');
    const currentPrivyUserId = privyUser?.id || privyUser?.sub;
    if (currentPrivyUserId) {
      authRequestsInFlight.delete(currentPrivyUserId);
      retryCountRef.current = 0;
      setAuthReady(false); // Trigger re-auth
    }
  }, [privyUser]);

  return {
    user,
    loading,
    authReady,
    accessToken,
    showPrivateKeyUI,
    privateKeyData,
    closePrivateKeyUI,
    getFreshToken,
    retryAuth // Expose retry function
  };
}
