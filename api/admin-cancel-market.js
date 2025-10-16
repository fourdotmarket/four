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

    // Get user and verify admin status
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('privy_user_id', privyUserId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // CRITICAL: Verify admin username
    if (user.username !== 'Admin') {
      console.log(`⛔ Unauthorized admin access attempt by user: ${user.username}`);
      return res.status(403).json({ error: 'Forbidden: Admin access only' });
    }

    // Get request data
    const { market_id } = req.body;

    if (market_id === undefined) {
      return res.status(400).json({ error: 'Missing market_id' });
    }

    // Verify market exists
    const { data: market, error: marketError } = await supabase
      .from('markets')
      .select('status, question')
      .eq('market_id', market_id)
      .single();

    if (marketError || !market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    // Update market status to cancelled
    const { error: updateError } = await supabase
      .from('markets')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('market_id', market_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Failed to cancel market' });
    }

    // Log admin action
    console.log(`❌ ADMIN CANCELLATION: Market #${market_id} cancelled by ${user.username}`);
    console.log(`   Question: ${market.question}`);
    console.log(`   Previous Status: ${market.status}`);

    return res.status(200).json({
      success: true,
      message: 'Market cancelled successfully',
      market_id
    });

  } catch (error) {
    console.error('Admin cancel market error:', error.message);
    return res.status(401).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
};

