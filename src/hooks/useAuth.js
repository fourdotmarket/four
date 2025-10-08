import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api-domain.vercel.app/api';

export function useAuth() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to get user email from Privy user object
  const getUserEmail = (privyUser) => {
    if (!privyUser) return null;
    
    // Check for email in linked accounts
    if (privyUser.email?.address) {
      return privyUser.email.address;
    }
    
    // Check for Google account
    if (privyUser.google?.email) {
      return privyUser.google.email;
    }
    
    // Check for Twitter - use username as fallback
    if (privyUser.twitter?.username) {
      return `${privyUser.twitter.username}@twitter.com`;
    }
    
    return null;
  };

  // Function to get login platform
  const getLoginPlatform = (privyUser) => {
    if (!privyUser) return 'unknown';
    
    if (privyUser.google) return 'google';
    if (privyUser.twitter) return 'twitter';
    if (privyUser.email) return 'email';
    
    return 'unknown';
  };

  // Register new user
  const registerUser = async (accessToken, privyUserId, email, platform) => {
    try {
      console.log('Registering user:', { privyUserId, email, platform });
      
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyUserId,
          email,
          platform,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Register failed:', data);
        throw new Error(data.error || 'Registration failed');
      }

      console.log('Registration successful:', data);
      return data;
    } catch (err) {
      console.error('Registration error:', err);
      throw err;
    }
  };

  // Login existing user
  const loginUser = async (accessToken, privyUserId) => {
    try {
      console.log('Logging in user:', privyUserId);
      
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyUserId,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // If user not found (404), return null to trigger registration
        if (response.status === 404) {
          console.log('User not found, needs registration');
          return null;
        }
        console.error('Login failed:', data);
        throw new Error(data.error || 'Login failed');
      }

      console.log('Login successful:', data);
      return data;
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  // Main authentication effect
  useEffect(() => {
    const authenticateUser = async () => {
      if (!ready || !authenticated || !user) {
        setUserData(null);
        return;
      }

      // Skip if we already have user data
      if (userData) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get access token from Privy
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error('Failed to get access token');
        }

        const privyUserId = user.id;
        const email = getUserEmail(user);
        const platform = getLoginPlatform(user);

        console.log('Authenticating user:', { privyUserId, email, platform });

        // Try to login first
        const loginResult = await loginUser(accessToken, privyUserId);

        if (loginResult && loginResult.user) {
          // User exists, set user data
          setUserData(loginResult.user);
        } else {
          // User doesn't exist, register them
          if (!email) {
            throw new Error('Could not determine user email');
          }

          const registerResult = await registerUser(accessToken, privyUserId, email, platform);
          
          if (registerResult && registerResult.user) {
            setUserData(registerResult.user);
          } else {
            throw new Error('Registration failed');
          }
        }
      } catch (err) {
        console.error('Authentication error:', err);
        setError(err.message);
        // Don't logout on error, just show error
      } finally {
        setIsLoading(false);
      }
    };

    authenticateUser();
  }, [ready, authenticated, user, userData, getAccessToken]);

  // Logout handler
  const handleLogout = async () => {
    setUserData(null);
    setError(null);
    await logout();
  };

  return {
    ready,
    authenticated,
    user,
    userData,
    isLoading,
    error,
    login,
    logout: handleLogout,
  };
}