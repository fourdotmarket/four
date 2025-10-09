import { createClient } from '@supabase/supabase-js';
import * as jose from 'jose';
import { Wallet } from 'ethers';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cache JWKS clients
const jwksCache = new Map();

function getJWKS(appId) {
  if (!jwksCache.has(appId)) {
    jwksCache.set(
      appId,
      jose.createRemoteJWKSet(
        new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks`)
      )
    );
  }
  return jwksCache.get(appId);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Decode token without verification first
    const decoded = jose.decodeJwt(token);
    const appIdFromToken = decoded.aud;

    // Get cached JWKS
    const JWKS = getJWKS(appIdFromToken);

    // Verify JWT
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: 'privy.io',
      audience: appIdFromToken
    });

    const privyUserId = payload.sub;
    const { provider, email } = req.body;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .single();

    if (existingUser) {
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

    // Generate BSC wallet for new user
    const wallet = Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;

    // Generate username: first 4 + ... + last 4 characters of wallet address
    const username = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

    // Create new user with wallet
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
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      success: true,
      user: newUser,
      isNewUser: true
    });

  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}