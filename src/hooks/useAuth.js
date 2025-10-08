import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export const useAuth = () => {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ready) {
      setIsLoading(true);
      return;
    }

    if (!authenticated || !user) {
      setIsLoading(false);
      setUserData(null);
      return;
    }

    handleUserAuth();
  }, [ready, authenticated, user]);

  const handleUserAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const authToken = await getAccessToken();
      
      if (!authToken) {
        throw new Error('Failed to get authentication token');
      }

      const privyUserId = user.id;
      const email = user.email?.address || user.google?.email || user.twitter?.username || 'unknown';
      const platform = user.email ? 'email' : user.google ? 'google' : user.twitter ? 'twitter' : 'unknown';

      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          privyUserId: privyUserId,
        }),
      });

      const loginData = await loginResponse.json();

      if (loginResponse.ok && loginData.success) {
        setUserData(loginData.user);
        setIsLoading(false);
        return;
      }

      if (loginResponse.status === 404) {
        const registerResponse = await fetch('/api/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            email: email,
            platform: platform,
            privyUserId: privyUserId,
          }),
        });

        const registerData = await registerResponse.json();

        if (registerResponse.ok && registerData.success) {
          setUserData(registerData.user);
          setIsLoading(false);
          return;
        } else {
          throw new Error(registerData.error || 'Registration failed');
        }
      }

      throw new Error(loginData.error || 'Authentication failed');

    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setUserData(null);
    await logout();
  };

  return {
    ready,
    authenticated,
    privyUser: user,
    userData,
    isLoading,
    error,
    login,
    logout: handleLogout,
  };
};