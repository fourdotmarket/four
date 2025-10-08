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

// Initialize Privy client for server-side verification
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
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
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

    // Get user data from the verified token
    const privyUser = await privy.getUser(privyUserId);
    
    // Extract email and platform from verified Privy user
    const email = privyUser.email?.address || 
                 privyUser.google?.email || 
                 privyUser.twitter?.username || 
                 'unknown';
    
    const platform = privyUser.email ? 'email' : 
                    privyUser.google ? 'google' : 
                    privyUser.twitter ? 'twitter' : 
                    'unknown';

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${email},privy_user_id.eq.${privyUserId}`)
      .single();

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
      
      if (insertError.code === '23505') {
        return res.status(409).json({ 
          error: 'User ID conflict, please try again',
          code: 'DUPLICATE_ID'
        });
      }
      
      throw insertError;
    }

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