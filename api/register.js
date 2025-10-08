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

function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

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
    console.log('Register endpoint called');
    
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
    const { email, platform, privyUserId } = req.body;

    console.log('Register request:', { email, platform, privyUserId: privyUserId?.substring(0, 10) + '...' });

    // Validate required fields
    if (!email || !platform || !privyUserId) {
      console.error('Missing required fields:', { email: !!email, platform: !!platform, privyUserId: !!privyUserId });
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'platform', 'privyUserId']
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

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .maybeSingle();

    if (checkError) {
      console.error('Database check error:', checkError);
      throw checkError;
    }

    if (existingUser) {
      console.log('User already exists:', existingUser.user_id);
      return res.status(200).json({
        success: true,
        isNewUser: false,
        user: existingUser,
        message: 'User already registered'
      });
    }

    // Generate unique IDs
    const userId = generateRandomString(12);
    const userOrderId = generateRandomString(36);

    console.log('Creating new user:', userId);

    // Insert new user
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
      console.error('Insert error:', insertError);
      
      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return res.status(409).json({ 
          error: 'User ID conflict, please try again',
          code: insertError.code
        });
      }
      
      throw insertError;
    }

    console.log('User created successfully:', newUser.user_id);

    return res.status(201).json({
      success: true,
      isNewUser: true,
      user: newUser,
      message: 'User registered successfully'
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}