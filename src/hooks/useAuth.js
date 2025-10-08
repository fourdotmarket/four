import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';

// Use window.location.origin as fallback to ensure it works on Vercel
const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.origin}/api`;

export function useAuth() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use ref to track if we've already attempted auth for this user
  const authProcessingRef = useRef(false);
  const lastUserIdRef = useRef(null);

  // Function to get user email from Privy user object
  const getUserEmail = useCallback((privyUser) => {
    if (!privyUser) return null;
    
    if (privyUser.email?.address) {
      return privyUser.email.address;
    }
    
    if (privyUser.google?.email) {
      return privyUser.google.email;
    }
    
    if (privyUser.twitter?.username) {
      return `${privyUser.twitter.username}@twitter.com`;
    }
    
    return null;
  }, []);

  // Function to get login platform
  const getLoginPlatform = useCallback((privyUser) => {
    if (!privyUser) return 'unknown';
    
    if (privyUser.google) return 'google';
    if (privyUser.twitter) return 'twitter';
    if (privyUser.email) return 'email';
    
    return 'unknown';
  }, []);

  // Register new user
  const registerUser = useCallback(async (accessToken, privyUserId, email, platform) => {
    const url = `${API_BASE_URL}/register`;
    console.log('🔥 Registering user at:', url);
    
    const response = await fetch(url, {
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
      console.error('Register failed:', response.status, data);
      throw new Error(data.error || 'Registration failed');
    }

    console.log('✅ Registration successful');
    return data;
  }, []);

  // Login existing user
  const loginUser = useCallback(async (accessToken, privyUserId) => {
    const url = `${API_BASE_URL}/login`;
    console.log('🔑 Logging in user at:', url);
    
    const response = await fetch(url, {
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
    
    if (response.status === 404) {
      console.log('⚠️ User not found (404) - will register');
      return null;
    }
    
    if (!response.ok) {
      console.error('Login failed:', response.status, data);
      throw new Error(data.error || 'Login failed');
    }

    console.log('✅ Login successful');
    return data;
  }, []);

  // Main authentication effect
  useEffect(() => {
    const authenticateUser = async () => {
      // If not authenticated, clear everything
      if (!authenticated) {
        if (userData || lastUserIdRef.current) {
          console.log('🔄 Logged out, clearing state');
          setUserData(null);
          lastUserIdRef.current = null;
          authProcessingRef.current = false;
        }
        return;
      }

      // Wait for Privy to be ready
      if (!ready || !user) {
        return;
      }

      // If we already have userData for this user, don't re-auth
      if (userData && lastUserIdRef.current === user.id) {
        return;
      }

      // If we're currently processing auth for this user, don't start again
      if (authProcessingRef.current && lastUserIdRef.current === user.id) {
        console.log('Already processing auth for this user');
        return;
      }

      console.log('🚀 Starting authentication for user:', user.id.substring(0, 20) + '...');
      
      // Mark that we're processing this user
      authProcessingRef.current = true;
      lastUserIdRef.current = user.id;
      
      setIsLoading(true);
      setError(null);

      try {
        // Get access token
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error('No access token');
        }

        const privyUserId = user.id;
        const email = getUserEmail(user);
        const platform = getLoginPlatform(user);

        if (!email) {
          throw new Error('Could not get email');
        }

        console.log('User info:', { email, platform });

        // Try login first
        const loginResult = await loginUser(accessToken, privyUserId);

        if (loginResult?.user) {
          // Existing user
          setUserData(loginResult.user);
        } else {
          // New user - register
          console.log('🆕 Registering new user...');
          const registerResult = await registerUser(accessToken, privyUserId, email, platform);
          
          if (registerResult?.user) {
            setUserData(registerResult.user);
          } else {
            throw new Error('No user data returned from register');
          }
        }
      } catch (err) {
        console.error('❌ Auth error:', err);
        setError(err.message);
        // Reset so we can retry
        authProcessingRef.current = false;
        lastUserIdRef.current = null;
      } finally {
        setIsLoading(false);
      }
    };

    authenticateUser();
  }, [ready, authenticated, user, userData, getAccessToken, getUserEmail, getLoginPlatform, loginUser, registerUser]);

  // Logout handler
  const handleLogout = useCallback(async () => {
    console.log('👋 Logging out');
    setUserData(null);
    setError(null);
    authProcessingRef.current = false;
    lastUserIdRef.current = null;
    await logout();
  }, [logout]);

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