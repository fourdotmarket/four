import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import axios from 'axios';

export function useAuth() {
  const { ready, authenticated, user: privyUser, getAccessToken } = usePrivy();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [showPrivateKeyUI, setShowPrivateKeyUI] = useState(false);
  const [privateKeyData, setPrivateKeyData] = useState(null);
  
  // BULLETPROOF PROTECTION: Multiple layers to prevent duplicate calls
  const hasCompletedAuthRef = useRef(false);
  const authRequestInFlightRef = useRef(false);
  const lastPrivyUserIdRef = useRef(null);
  const abortControllerRef = useRef(null);

  const closePrivateKeyUI = useCallback(() => {
    setShowPrivateKeyUI(false);
    setPrivateKeyData(null);
  }, []);

  useEffect(() => {
    // If not authenticated, reset everything
    if (!ready || !authenticated) {
      hasCompletedAuthRef.current = false;
      authRequestInFlightRef.current = false;
      lastPrivyUserIdRef.current = null;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setUser(null);
      setAccessToken(null);
      setLoading(false);
      setShowPrivateKeyUI(false);
      setPrivateKeyData(null);
      return;
    }

    // GUARD 1: Already completed auth successfully
    if (hasCompletedAuthRef.current) {
      console.log('🛡️ [AUTH] Already authenticated - skipping');
      return;
    }

    // GUARD 2: Request already in flight (prevents race conditions)
    if (authRequestInFlightRef.current) {
      console.log('🛡️ [AUTH] Request in flight - skipping');
      return;
    }

    // GUARD 3: Same Privy user already authenticated
    const currentPrivyUserId = privyUser?.id || privyUser?.sub;
    if (lastPrivyUserIdRef.current === currentPrivyUserId && user !== null) {
      console.log('🛡️ [AUTH] Same user already loaded - skipping');
      return;
    }

    // Set request in flight flag FIRST
    authRequestInFlightRef.current = true;
    lastPrivyUserIdRef.current = currentPrivyUserId;

    // Create AbortController for this request
    abortControllerRef.current = new AbortController();

    async function registerOrLogin() {
      try {
        // Extract provider and email
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

        console.log('🔐 [AUTH] Starting authentication...');

        // Get access token
        const token = await getAccessToken();
        
        // Make auth request with abort signal
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

        console.log('✅ [AUTH] Success!', {
          isNewUser: response.data.isNewUser,
          hasPrivateKey: !!response.data.privateKey
        });

        // Extract data
        const userData = response.data.user;
        const isNewUser = response.data.isNewUser;
        const privateKey = response.data.privateKey;

        // Mark as completed BEFORE setting any state
        hasCompletedAuthRef.current = true;
        authRequestInFlightRef.current = false;

        // Set all state at once
        setUser(userData);
        setAccessToken(token);
        setLoading(false);

        // Handle private key UI for new users
        if (isNewUser && privateKey && userData.wallet_address) {
          console.log('🔑 [AUTH] New user - setting up private key UI');
          setPrivateKeyData({
            privateKey: privateKey,
            walletAddress: userData.wallet_address
          });
          setShowPrivateKeyUI(true);
        }

      } catch (error) {
        // Check if request was aborted
        if (axios.isCancel(error) || error.name === 'CanceledError' || error.name === 'AbortError') {
          console.log('🚫 [AUTH] Request aborted');
          return;
        }

        console.error('❌ [AUTH] Error:', error.message);
        
        // Mark as completed even on error
        hasCompletedAuthRef.current = true;
        authRequestInFlightRef.current = false;

        // Fallback user
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

    // Cleanup function to abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      authRequestInFlightRef.current = false;
    };

  }, [ready, authenticated, privyUser, getAccessToken, user]);

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