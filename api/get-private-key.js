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

    // First, get user_id and wallet_address (safe query without private key)
    const { data: user, error: fetchError } = await supabase
      .from('users_safe')
      .select('user_id, wallet_address')
      .eq('privy_user_id', privyUserId)
      .single();

    if (fetchError) {
      console.error('Database error:', fetchError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Get client IP for audit log
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    // Call secure RPC function to get private key (with service role key)
    // This function logs all access attempts
    const { data: privateKey, error: keyError } = await supabase
      .rpc('get_user_private_key_secure', {
        p_user_id: user.user_id,
        p_ip: clientIp
      });

    if (keyError) {
      console.error('🚨 Private key fetch error:', keyError);
      return res.status(500).json({ error: 'Failed to retrieve private key' });
    }

    if (!privateKey) {
      return res.status(404).json({ error: 'Private key not found' });
    }

    // SECURITY: Log this action for audit trail
    console.log(`🔑 Private key retrieved by user: ${privyUserId} (${user.wallet_address}) from IP: ${clientIp} at ${new Date().toISOString()}`);

    // Return private key
    return res.status(200).json({
      success: true,
      privateKey: privateKey,
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

