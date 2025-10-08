import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

// Initialize Supabase client with service role key
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

// Initialize Privy client
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 🔒 SECURITY: Verify Privy authentication token
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!authToken) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    // Verify the token with Privy
    let verifiedClaims;
    try {
      verifiedClaims = await privy.verifyAuthToken(authToken);
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid authentication token'
      });
    }

    // Get the verified user ID from Privy
    const privyUserId = verifiedClaims.userId;

    // Query database using verified Privy user ID
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

    // Update last login timestamp
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
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}