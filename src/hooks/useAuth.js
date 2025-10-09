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

        // FALLBACK: Create temporary user from Privy data
        console.log('⚠️ Using fallback user data from Privy');
        const fallbackUser = {
          username: privyUser.email?.address?.split('@')[0] || 
                   privyUser.google?.email?.split('@')[0] || 
                   privyUser.twitter?.username || 
                   'User',
          email: privyUser.email?.address || 
                privyUser.google?.email || 
                privyUser.twitter?.username,
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