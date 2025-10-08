import { createClient } from '@supabase/supabase-js';
import * as jose from 'jose';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Login endpoint called');
    
    // Check authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('No authorization header');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { privyUserId } = req.body;

    console.log('Login request for user:', privyUserId?.substring(0, 10) + '...');

    if (!privyUserId) {
      console.error('Missing privyUserId');
      return res.status(400).json({ 
        error: 'Missing privyUserId',
        message: 'privyUserId is required'
      });
    }

    // Verify JWT token
    try {
      const JWKS = jose.createRemoteJWKSet(new URL('https://auth.privy.io/.well-known/jwks.json'));
      
      const { payload } = await jose.jwtVerify(token, JWKS, {
        issuer: 'privy.io',
        audience: process.env.PRIVY_APP_ID || 'cmggw74r800rujm0cccr9s7np',
      });

      console.log('Token verified for user:', payload.sub);

      if (payload.sub !== privyUserId) {
        console.error('Token mismatch:', { tokenSub: payload.sub, providedUserId: privyUserId });
        return res.status(403).json({ 
          error: 'Token does not match user ID'
        });
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ 
        error: 'Invalid authentication token',
        details: error.message
      });
    }

    // Fetch user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // User not found
    if (!user) {
      console.log('User not found:', privyUserId);
      return res.status(404).json({ 
        error: 'User not found',
        found: false,
        message: 'User needs to register'
      });
    }

    console.log('User found:', user.user_id);

    // Update last login
    const { error: updateError } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('user_id', user.user_id);

    if (updateError) {
      console.error('Failed to update last_login:', updateError);
      // Don't fail the login if we can't update last_login
    }

    return res.status(200).json({
      success: true,
      user: user,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}