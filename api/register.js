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

function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

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
    const { email, platform, privyUserId } = req.body;

    if (!email || !platform || !privyUserId) {
      return res.status(400).json({ error: 'missing fields' });
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

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .maybeSingle();

    if (existingUser) {
      return res.status(200).json({
        success: true,
        isNewUser: false,
        user: existingUser,
      });
    }

    const userId = generateRandomString(12);
    const userOrderId = generateRandomString(36);

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          user_id: userId,
          user_o_id: userOrderId,
          email: email,
          platform: platform,
          privy_user_id: privyUserId,
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('insert error:', insertError);
      
      if (insertError.code === '23505') {
        return res.status(409).json({ error: 'conflict, retry' });
      }
      
      throw insertError;
    }

    return res.status(201).json({
      success: true,
      isNewUser: true,
      user: newUser,
    });

  } catch (error) {
    console.error('register error:', error);
    return res.status(500).json({ error: 'server error' });
  }
}