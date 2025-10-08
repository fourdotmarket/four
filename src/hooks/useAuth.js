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

      // 🔒 SECURITY: Get Privy authentication token
      const authToken = await getAccessToken();
      
      if (!authToken) {
        throw new Error('Failed to get authentication token');
      }

      // Get user details from Privy
      const privyUserId = user.id;

      // Try to login first (check if user exists)
      // 🔒 Send auth token in Authorization header
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`, // 🔒 AUTH TOKEN
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

      // User doesn't exist, register them
      if (loginResponse.status === 404) {
        // 🔒 Send auth token in Authorization header
        const registerResponse = await fetch('/api/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`, // 🔒 AUTH TOKEN
          },
          body: JSON.stringify({
            // Note: We still send these but API will verify and use Privy data
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
    // Privy auth state
    ready,
    authenticated,
    privyUser: user,
    
    // Custom user data from database
    userData,
    
    // Loading and error states
    isLoading,
    error,
    
    // Auth functions
    login,
    logout: handleLogout,
  };
};