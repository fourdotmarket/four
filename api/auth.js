import { createClient } from '@supabase/supabase-js';
import * as jose from 'jose';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No auth header');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    console.log('Token received, length:', token.length);
    console.log('PRIVY_APP_ID:', process.env.PRIVY_APP_ID);
    console.log('Verification key exists:', !!process.env.PRIVY_VERIFICATION_KEY);

    // Import ES256 key
    const VERIFICATION_KEY = process.env.PRIVY_VERIFICATION_KEY;
    const verificationKey = await jose.importSPKI(VERIFICATION_KEY, 'ES256');
    console.log('Key imported successfully');
    
    const { payload } = await jose.jwtVerify(token, verificationKey, {
      issuer: 'privy.io',
      audience: process.env.PRIVY_APP_ID
    });

    console.log('Token verified, user:', payload.sub);

    const privyUserId = payload.sub;
    const { provider, email } = req.body;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .single();

    if (existingUser) {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('privy_user_id', privyUserId);

      return res.status(200).json({
        success: true,
        user: existingUser,
        isNewUser: false
      });
    }

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        privy_user_id: privyUserId,
        provider: provider || 'unknown',
        email
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      success: true,
      user: newUser,
      isNewUser: true
    });

  } catch (error) {
    console.error('Auth error:', error.message);
    console.error('Error code:', error.code);
    return res.status(401).json({ error: error.message || 'Invalid token' });
  }
}