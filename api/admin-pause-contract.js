const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
const jose = require('jose');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

const CONTRACT_ABI = [
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)"
];

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
    const decoded = jose.decodeJwt(token);
    const appIdFromToken = decoded.aud;

    const JWKS = jose.createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${appIdFromToken}/jwks.json`)
    );

    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: 'privy.io',
      audience: appIdFromToken
    });

    const privyUserId = payload.sub;

    // Verify user is admin
    const { data: user } = await supabase
      .from('users')
      .select('username')
      .eq('privy_user_id', privyUserId)
      .single();

    if (!user || user.username !== 'Admin') {
      console.log('⛔ Unauthorized pause attempt by:', privyUserId);
      return res.status(403).json({ error: 'Admin access only' });
    }

    const { contractAddress, adminPrivateKey, action } = req.body;

    if (!contractAddress || !adminPrivateKey || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['pause', 'unpause'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    console.log(`🔧 ${action === 'pause' ? 'Pausing' : 'Unpausing'} contract...`);

    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    const wallet = new ethers.Wallet(adminPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

    const tx = action === 'pause' 
      ? await contract.pause()
      : await contract.unpause();

    console.log(`⏳ Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    
    console.log(`✅ Contract ${action}d successfully!`);

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      action: action
    });

  } catch (error) {
    console.error(`❌ Error ${req.body.action}ing contract:`, error);
    return res.status(500).json({ 
      error: `Failed to ${req.body.action} contract`,
      details: error.message 
    });
  }
}

