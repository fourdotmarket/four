const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
const jose = require('jose');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

// CRITICAL: These are server-side environment variables - NEVER exposed to frontend
const ADMIN_CONTRACT_ADDRESS = process.env.ADMIN_CONTRACT_ADDRESS || "0xB92C4e50589E643EbB26587b92e4D63EE92210d2";
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

const CONTRACT_ABI = [
  "function resolveMarket(uint256 _marketId, bool _outcome)",
  "function markets(uint256) view returns (uint256 id, string question, address marketMaker, uint256 marketMakerStake, uint256 ticketPrice, uint256 totalTickets, uint256 ticketsSold, uint256 deadline, uint8 status, bool outcome, uint256 createdAt, uint256 totalPayout, bool makerClaimed)"
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
      console.log('⛔ Unauthorized blockchain resolve attempt by:', privyUserId);
      return res.status(403).json({ error: 'Admin access only' });
    }

    const { market_id, outcome } = req.body;

    if (market_id === undefined || outcome === undefined) {
      return res.status(400).json({ error: 'Missing market_id or outcome' });
    }

    if (!ADMIN_PRIVATE_KEY) {
      return res.status(500).json({ error: 'Server configuration error: Admin private key not set' });
    }

    console.log(`🎯 Resolving market #${market_id} on blockchain with outcome: ${outcome}...`);

    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(ADMIN_CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    // Get market details
    const market = await contract.markets(market_id);
    
    // Validate market is active (status = 0)
    if (market.status !== 0) {
      return res.status(400).json({ error: 'Market is not active' });
    }

    // Check deadline
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime < market.deadline) {
      return res.status(400).json({ error: 'Market deadline has not been reached yet' });
    }

    const tx = await contract.resolveMarket(market_id, outcome);
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    
    console.log(`✅ Market resolved on blockchain successfully!`);

    // Update database status
    await supabase
      .from('markets')
      .update({ 
        status: 'resolved',
        outcome: outcome
      })
      .eq('market_id', market_id.toString());

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      market_id: market_id.toString(),
      outcome: outcome
    });

  } catch (error) {
    console.error('❌ Error resolving market on blockchain:', error);
    return res.status(500).json({ 
      error: 'Failed to resolve market on blockchain',
      details: error.message 
    });
  }
}

