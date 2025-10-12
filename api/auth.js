const { createClient } = require('@supabase/supabase-js');
const jose = require('jose');
const { ethers } = require('ethers');

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
    const { provider, email } = req.body;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('user_id, user_order_id, privy_user_id, provider, email, username, wallet_address, created_at, last_login')
      .eq('privy_user_id', privyUserId)
      .single();

    if (existingUser) {
      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('privy_user_id', privyUserId);

      // SECURITY: User gets their own user_id (needed for app functionality)
      // but we remove id (internal UUID)
      const { id, ...userWithoutInternalId } = existingUser;
      
      return res.status(200).json({
        success: true,
        user: userWithoutInternalId,
        isNewUser: false
      });
    }

    // Create new user with BSC wallet
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;
    
    // Generate username from wallet address
    const username = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        privy_user_id: privyUserId,
        provider: provider || 'unknown',
        email,
        wallet_address: walletAddress,
        wallet_private_key: privateKey,
        username
      })
      .select('user_id, user_order_id, privy_user_id, provider, email, username, wallet_address, created_at, last_login')
      .single();

    if (insertError) throw insertError;

    // SECURITY: User gets their own user_id (needed for app functionality)
    // but we remove id (internal UUID)
    const { id, ...userWithoutInternalId } = newUser;

    return res.status(201).json({
      success: true,
      user: userWithoutInternalId,
      isNewUser: true
    });

  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
};