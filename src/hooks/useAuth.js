import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import axios from 'axios';

export function useAuth() {
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();
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
        const token = await getAccessToken();
        
        const response = await axios.post(
          '/api/auth',
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`,
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
  }, [ready, authenticated, getAccessToken]);

  return { user, loading, authenticated };
}