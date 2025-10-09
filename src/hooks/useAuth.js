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

        // Get Privy access token
        const accessToken = await getAccessToken();

        const response = await axios.post('/api/auth', 
          { provider, email },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        setUser(response.data.user);
      } catch (error) {
        console.error('Auth error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    registerOrLogin();
  }, [ready, authenticated, privyUser, getAccessToken]);

  return { user, loading, authenticated };
}