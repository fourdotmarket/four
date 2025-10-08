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

const PRIVY_VERIFICATION_KEY = process.env.PRIVY_VERIFICATION_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'no token' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { privyUserId } = req.body;

    if (!privyUserId) {
      return res.status(400).json({ error: 'missing privyUserId' });
    }

    if (!PRIVY_VERIFICATION_KEY) {
      console.error('missing PRIVY_VERIFICATION_KEY');
      return res.status(500).json({ error: 'server config error' });
    }

    try {
      const verificationKey = await jose.importSPKI(PRIVY_VERIFICATION_KEY, 'ES256');
      
      const { payload } = await jose.jwtVerify(token, verificationKey, {
        issuer: 'privy.io',
        audience: process.env.PRIVY_APP_ID || 'cmggw74r800rujm0cccr9s7np',
      });

      if (payload.sub !== privyUserId) {
        return res.status(403).json({ error: 'token mismatch' });
      }
    } catch (error) {
      console.error('token verify failed:', error.message);
      return res.status(401).json({ error: 'invalid token' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .maybeSingle();

    if (error) {
      console.error('db error:', error);
      throw error;
    }

    if (!user) {
      return res.status(404).json({ error: 'user not found', found: false });
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
    console.error('login error:', error);
    return res.status(500).json({ error: 'server error' });
  }
}