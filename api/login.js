import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { privyUserId, email } = req.body;

    // Must provide at least one identifier
    if (!privyUserId && !email) {
      return res.status(400).json({ 
        error: 'Must provide privyUserId or email'
      });
    }

    // Build query
    let query = supabase.from('users').select('*');

    if (privyUserId) {
      query = query.eq('privy_user_id', privyUserId);
    } else if (email) {
      query = query.eq('email', email);
    }

    const { data: user, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No user found
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