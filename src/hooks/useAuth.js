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
  
  // CRITICAL: Use refs to prevent re-renders from triggering new auth calls
  const hasAuthenticatedRef = useRef(false);
  const isAuthenticatingRef = useRef(false);
  const authenticationSessionId = useRef(null);

  // Memoize close function
  const closePrivateKeyUI = useCallback(() => {
    console.log('🚪 Closing private key UI');
    setShowPrivateKeyUI(false);
    setPrivateKeyData(null);
  }, []);

  useEffect(() => {
    // Create unique session ID when authentication state changes
    const currentSessionId = `${ready}-${authenticated}-${privyUser?.id || 'none'}`;
    
    // Not ready or not authenticated - reset everything
    if (!ready || !authenticated) {
      hasAuthenticatedRef.current = false;
      isAuthenticatingRef.current = false;
      authenticationSessionId.current = null;
      setUser(null);
      setAccessToken(null);
      setLoading(false);
      setShowPrivateKeyUI(false);
      setPrivateKeyData(null);
      return;
    }

    // CRITICAL GUARD: Check if we've already authenticated this exact session
    if (authenticationSessionId.current === currentSessionId) {
      console.log('✅ Already authenticated this session - skipping');
      return;
    }

    // CRITICAL GUARD: Check if authentication is in progress
    if (isAuthenticatingRef.current) {
      console.log('⏳ Authentication in progress - skipping duplicate call');
      return;
    }

    // CRITICAL GUARD: Check if we've already successfully authenticated
    if (hasAuthenticatedRef.current && user) {
      console.log('✅ Already authenticated and have user - skipping');
      return;
    }

    // Set all guards BEFORE starting async operation
    isAuthenticatingRef.current = true;
    authenticationSessionId.current = currentSessionId;

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

        console.log('🔐 [SINGLE AUTH CALL] Authenticating...', { provider, email });

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

        console.log('✅ Authentication successful!');
        console.log('📊 Response:', {
          isNewUser: response.data.isNewUser,
          hasPrivateKey: !!response.data.privateKey,
          hasWallet: !!response.data.user?.wallet_address
        });

        // CRITICAL: Set states in one batch to minimize re-renders
        const userData = response.data.user;
        const isNewUser = response.data.isNewUser;
        const privateKey = response.data.privateKey;

        // Mark as successfully authenticated BEFORE setting state
        hasAuthenticatedRef.current = true;

        // Set user and token
        setUser(userData);
        setAccessToken(token);
        setLoading(false);

        // If new user with private key, prepare UI data
        if (isNewUser && privateKey && userData.wallet_address) {
          console.log('🔑 NEW USER - Setting up private key UI');
          console.log('   Private Key:', privateKey);
          console.log('   Wallet:', userData.wallet_address);
          
          // Set private key data and show UI flag together
          const pkData = {
            privateKey: privateKey,
            walletAddress: userData.wallet_address
          };
          
          setPrivateKeyData(pkData);
          setShowPrivateKeyUI(true);
          
          console.log('✅ Private key UI should now be visible');
        } else {
          console.log('ℹ️ Existing user - no private key UI');
        }

      } catch (error) {
        console.error('❌ Authentication error:', error);
        console.error('Error details:', error.response?.data || error.message);

        // Mark as complete even on error to prevent retry loops
        hasAuthenticatedRef.current = true;

        // Fallback user from Privy data
        let username = 'User';
        if (privyUser?.email?.address) {
          username = privyUser.email.address.split('@')[0];
        } else if (privyUser?.google?.email) {
          username = privyUser.google.email.split('@')[0];
        } else if (privyUser?.twitter?.username) {
          username = privyUser.twitter.username;
        }

        const fallbackUser = {
          username,
          email: privyUser?.email?.address || privyUser?.google?.email || null,
          wallet_address: null,
          provider: privyUser?.email ? 'email' : privyUser?.google ? 'google' : 'twitter'
        };
        
        setUser(fallbackUser);
        setLoading(false);
      } finally {
        // Clear in-progress flag
        isAuthenticatingRef.current = false;
      }
    }

    registerOrLogin();

  }, [ready, authenticated, privyUser?.id, getAccessToken]); // Only depend on essential values

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