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
  
  // BULLETPROOF: Multiple layers of protection against duplicate calls
  const hasCompletedAuthRef = useRef(false);
  const isCurrentlyAuthenticatingRef = useRef(false);
  const lastPrivyUserIdRef = useRef(null);

  const closePrivateKeyUI = useCallback(() => {
    setShowPrivateKeyUI(false);
    setPrivateKeyData(null);
  }, []);

  useEffect(() => {
    // If not authenticated, reset everything
    if (!ready || !authenticated) {
      hasCompletedAuthRef.current = false;
      isCurrentlyAuthenticatingRef.current = false;
      lastPrivyUserIdRef.current = null;
      setUser(null);
      setAccessToken(null);
      setLoading(false);
      setShowPrivateKeyUI(false);
      setPrivateKeyData(null);
      return;
    }

    // GUARD 1: Already completed auth successfully
    if (hasCompletedAuthRef.current) {
      return;
    }

    // GUARD 2: Currently authenticating (prevents race conditions)
    if (isCurrentlyAuthenticatingRef.current) {
      return;
    }

    // GUARD 3: Check if this is the same Privy user we already authenticated
    const currentPrivyUserId = privyUser?.id || privyUser?.sub;
    if (lastPrivyUserIdRef.current === currentPrivyUserId && user !== null) {
      return;
    }

    // Set ALL guards before starting async operation
    isCurrentlyAuthenticatingRef.current = true;
    lastPrivyUserIdRef.current = currentPrivyUserId;

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
        
        // Make auth request
        const response = await axios.post('/api/auth', 
          { provider, email },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
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
        console.error('❌ [AUTH] Error:', error.message);
        
        // Mark as completed even on error
        hasCompletedAuthRef.current = true;

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
      } finally {
        isCurrentlyAuthenticatingRef.current = false;
      }
    }

    registerOrLogin();

  }, [ready, authenticated]); // ONLY depend on ready and authenticated

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