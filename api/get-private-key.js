const { createClient } = require('@supabase/supabase-js');
const jose = require('jose');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Decode JWT to get app ID
    const decoded = jose.decodeJwt(token);
    const appIdFromToken = decoded.aud;

    // Verify JWT with Privy's public key
    const JWKS = jose.createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${appIdFromToken}/jwks.json`)
    );

    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: 'privy.io',
      audience: appIdFromToken
    });

    const privyUserId = payload.sub;

    // Get user's private key from database
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('wallet_private_key, wallet_address')
      .eq('privy_user_id', privyUserId)
      .single();

    if (fetchError) {
      console.error('Database error:', fetchError);
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.wallet_private_key) {
      return res.status(404).json({ error: 'Private key not found' });
    }

    // SECURITY: Log this action for audit trail
    console.log(`🔑 Private key retrieved by user: ${privyUserId} at ${new Date().toISOString()}`);

    // Return private key
    return res.status(200).json({
      success: true,
      privateKey: user.wallet_private_key,
      walletAddress: user.wallet_address
    });

  } catch (error) {
    console.error('Get private key error:', error.message);
    return res.status(401).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
};

