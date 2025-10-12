import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import axios from 'axios';

export function useAuth() {
  const { ready, authenticated, user: privyUser, getAccessToken } = usePrivy();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [showPrivateKeyUI, setShowPrivateKeyUI] = useState(false);
  const [privateKeyData, setPrivateKeyData] = useState(null);
  
  // CRITICAL FIX: Prevent infinite loops with ref
  const hasAttemptedAuth = useRef(false);
  const isAuthenticating = useRef(false);

  useEffect(() => {
    // Reset when authentication state changes
    if (!authenticated) {
      hasAttemptedAuth.current = false;
      isAuthenticating.current = false;
      setUser(null);
      setAccessToken(null);
      setLoading(false);
      setShowPrivateKeyUI(false);
      setPrivateKeyData(null);
      return;
    }

    if (!ready) return;
    
    // CRITICAL: Prevent multiple simultaneous auth attempts
    if (hasAttemptedAuth.current || isAuthenticating.current) {
      console.log('⏭️ Skipping auth - already attempted or in progress');
      return;
    }

    async function registerOrLogin() {
      // Mark as authenticating
      isAuthenticating.current = true;
      hasAttemptedAuth.current = true;

      try {
        let provider = 'unknown';
        let email = null;
        
        if (privyUser.email) {
          provider = 'email';
          email = privyUser.email.address;
        } else if (privyUser.google) {
          provider = 'google';
          email = privyUser.google.email;
        } else if (privyUser.twitter) {
          provider = 'twitter';
          email = privyUser.twitter.username;
        }

        console.log('🔐 Attempting to authenticate with backend...', { provider, email });

        // Get Privy access token
        const token = await getAccessToken();
        setAccessToken(token);
        console.log('✅ Got Privy access token');

        const response = await axios.post('/api/auth', 
          { provider, email },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('✅ Backend response:', response.data);
        console.log('📊 User data:', response.data.user);
        console.log('🆕 Is new user:', response.data.isNewUser);
        console.log('🔑 Has private key:', !!response.data.privateKey);

        setUser(response.data.user);

        // CRITICAL: If new user, show private key UI ONCE
        if (response.data.isNewUser && response.data.privateKey) {
          console.log('🆕 NEW USER DETECTED - showing private key UI');
          console.log('🔑 Private key:', response.data.privateKey);
          console.log('💼 Wallet address:', response.data.user.wallet_address);
          
          setPrivateKeyData({
            privateKey: response.data.privateKey,
            walletAddress: response.data.user.wallet_address
          });
          setShowPrivateKeyUI(true);
        } else {
          console.log('👤 Existing user - no private key UI needed');
        }

      } catch (error) {
        console.error('❌ Auth error:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });

        // FALLBACK: Create user from Privy data
        console.log('📝 Using fallback user data from Privy');
        
        let username = null;
        if (privyUser.email?.address) {
          username = privyUser.email.address.split('@')[0];
        } else if (privyUser.google?.email) {
          username = privyUser.google.email.split('@')[0];
        } else if (privyUser.twitter?.username) {
          username = privyUser.twitter.username;
        } else if (privyUser.wallet?.address) {
          const addr = privyUser.wallet.address;
          username = `${addr.slice(2, 6)}...${addr.slice(-4)}`;
        }

        const fallbackUser = {
          username: username,
          email: privyUser.email?.address || 
                privyUser.google?.email || 
                privyUser.twitter?.username || null,
          wallet_address: privyUser.wallet?.address || null,
          provider: privyUser.email ? 'email' : 
                   privyUser.google ? 'google' : 
                   privyUser.twitter ? 'twitter' : 'unknown'
        };
        
        console.log('📋 Fallback user:', fallbackUser);
        setUser(fallbackUser);
      } finally {
        setLoading(false);
        isAuthenticating.current = false;
      }
    }

    registerOrLogin();
  }, [ready, authenticated]); // CRITICAL: Only depend on ready and authenticated, NOT privyUser

  const closePrivateKeyUI = () => {
    console.log('🚪 Closing private key UI');
    setShowPrivateKeyUI(false);
    setPrivateKeyData(null);
  };

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