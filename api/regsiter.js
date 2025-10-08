import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for server-side operations
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

// Helper function to generate random string
function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export default async function handler(req, res) {
  // Set CORS headers for security
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, platform, privyUserId } = req.body;

    // Validate required fields
    if (!email || !platform || !privyUserId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'platform', 'privyUserId']
      });
    }

    // Check if user already exists by email or privy user ID
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${email},privy_user_id.eq.${privyUserId}`)
      .single();

    // If user exists, return existing user data
    if (existingUser) {
      return res.status(200).json({
        success: true,
        isNewUser: false,
        user: existingUser,
      });
    }

    // Generate unique IDs
    const userId = generateRandomString(12);
    const userOrderId = generateRandomString(36);

    // Create new user profile
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
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      
      // Handle duplicate user_id or user_o_id (very rare but possible)
      if (insertError.code === '23505') {
        return res.status(409).json({ 
          error: 'User ID conflict, please try again',
          code: 'DUPLICATE_ID'
        });
      }
      
      throw insertError;
    }

    // Return success response
    return res.status(201).json({
      success: true,
      isNewUser: true,
      user: newUser,
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}