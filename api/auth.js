import { PrivyClient } from '@privy-io/server-auth';
import { createClient } from '@supabase/supabase-js';

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Verify Privy token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const claims = await privy.verifyAuthToken(token);
    
    if (!claims?.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const privyUserId = claims.userId;

    // Get Privy user details
    const privyUser = await privy.getUser(privyUserId);
    
    // Determine provider
    let provider = 'unknown';
    let email = null;
    
    if (privyUser.email) {
      provider = 'email';
      email = privyUser.email.address;
    } else if (privyUser.google) {
      provider = 'google';
      email = privyUser.google.email;
    } else if (privyUser.twitter) {
      provider = 'twitter';
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .single();

    if (existingUser) {
      // Update last login
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
        provider,
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
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}