import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import axios from 'axios';

// Module-level tracking - survives React Strict Mode unmount/remount
const authRequestsInFlight = new Map();
const completedAuthUsers = new Set();

export function useAuth() {
  const { ready, authenticated, user: privyUser, getAccessToken } = usePrivy();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [showPrivateKeyUI, setShowPrivateKeyUI] = useState(false);
  const [privateKeyData, setPrivateKeyData] = useState(null);
  
  const abortControllerRef = useRef(null);

  const closePrivateKeyUI = useCallback(() => {
    setShowPrivateKeyUI(false);
    setPrivateKeyData(null);
  }, []);

  useEffect(() => {
    if (!ready || !authenticated) {
      setUser(null);
      setAccessToken(null);
      setLoading(false);
      setShowPrivateKeyUI(false);
      setPrivateKeyData(null);
      return;
    }

    const currentPrivyUserId = privyUser?.id || privyUser?.sub;
    
    if (!currentPrivyUserId) {
      return;
    }

    // Check if already completed for this user
    if (completedAuthUsers.has(currentPrivyUserId)) {
      return;
    }

    // Check if request is already in flight for this user
    if (authRequestsInFlight.has(currentPrivyUserId)) {
      return;
    }

    // Mark request as in flight BEFORE any async work
    authRequestsInFlight.set(currentPrivyUserId, true);
    
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

        const token = await getAccessToken();
        
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

        // Mark as completed and remove from in-flight
        completedAuthUsers.add(currentPrivyUserId);
        authRequestsInFlight.delete(currentPrivyUserId);

        setUser(userData);
        setAccessToken(token);
        setLoading(false);

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

        completedAuthUsers.add(currentPrivyUserId);
        authRequestsInFlight.delete(currentPrivyUserId);

        let username = 'User';
        if (privyUser?.email?.address) {
          username = privyUser.email.address.split('@')[0];
        } else if (privyUser?.google?.email) {
          username = privyUser.google.email.split('@')[0];
        } else if (privyUser?.twitter?.username) {
          username = privyUser.twitter.username;
        }

        setUser({
          username,
          email: privyUser?.email?.address || privyUser?.google?.email || null,
          wallet_address: null,
          provider: privyUser?.email ? 'email' : privyUser?.google ? 'google' : 'twitter'
        });
        setLoading(false);
      }
    }

    registerOrLogin();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };

  }, [ready, authenticated]);

  return { 
    user, 
    loading, 
    authenticated, 
    accessToken,
    showPrivateKeyUI,
    privateKeyData,
    closePrivateKeyUI
  };
}