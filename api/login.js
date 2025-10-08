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
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { privyUserId } = req.body;

    if (!privyUserId) {
      return res.status(400).json({ 
        error: 'Missing privyUserId'
      });
    }

    try {
      const JWKS = jose.createRemoteJWKSet(new URL('https://auth.privy.io/.well-known/jwks.json'));
      
      const { payload } = await jose.jwtVerify(token, JWKS, {
        issuer: 'privy.io',
        audience: process.env.PRIVY_APP_ID || 'cmggw74r800rujm0cccr9s7np',
      });

      if (payload.sub !== privyUserId) {
        return res.status(403).json({ 
          error: 'Token does not match user ID'
        });
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ 
        error: 'Invalid authentication token'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          error: 'User not found',
          found: false
        });
      }
      throw error;
    }

    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('user_id', user.user_id);

    return res.status(200).json({
      success: true,
      user: user,
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: 'Internal server error'
    });
  }
}