import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import axios from 'axios';

export function useAuth() {
  const { ready, authenticated, user: privyUser, getAccessToken } = usePrivy();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    
    if (!authenticated) {
      setUser(null);
      setLoading(false);
      return;
    }

    async function registerOrLogin() {
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
        const accessToken = await getAccessToken();
        console.log('✅ Got Privy access token');

        const response = await axios.post('/api/auth', 
          { provider, email },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('✅ Backend response:', response.data);
        setUser(response.data.user);
      } catch (error) {
        console.error('❌ Auth error:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });

        // FALLBACK: Create user from Privy data
        console.log(⚠️ Using fallback user data from Privy');
        
        // Get username from different sources
        let username = null;
        if (privyUser.email?.address) {
          username = privyUser.email.address.split('@')[0];
        } else if (privyUser.google?.email) {
          username = privyUser.google.email.split('@')[0];
        } else if (privyUser.twitter?.username) {
          username = privyUser.twitter.username;
        } else if (privyUser.wallet?.address) {
          // Format wallet as username: skip 0x prefix, take 4 chars
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
        
        console.log('📝 Fallback user:', fallbackUser);
        setUser(fallbackUser);
      } finally {
        setLoading(false);
      }
    }

    registerOrLogin();
  }, [ready, authenticated, privyUser, getAccessToken]);

  return { user, loading, authenticated };
}