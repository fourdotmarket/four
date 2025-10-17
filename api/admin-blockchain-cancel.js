const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
const jose = require('jose');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

const CONTRACT_ABI = [
  "function cancelMarket(uint256 _marketId)",
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
      console.log('⛔ Unauthorized blockchain cancel attempt by:', privyUserId);
      return res.status(403).json({ error: 'Admin access only' });
    }

    const { contractAddress, adminPrivateKey, market_id } = req.body;

    if (!contractAddress || !adminPrivateKey || market_id === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`⚠️ Cancelling market #${market_id} on blockchain...`);

    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    const wallet = new ethers.Wallet(adminPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

    // Get market details
    const market = await contract.markets(market_id);
    
    // Validate market is not already cancelled
    if (market.status === 2) {
      return res.status(400).json({ error: 'Market is already cancelled' });
    }

    const tx = await contract.cancelMarket(market_id);
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    
    console.log(`✅ Market cancelled on blockchain successfully!`);

    // Update database status
    await supabase
      .from('markets')
      .update({ status: 'cancelled' })
      .eq('market_id', market_id.toString());

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      market_id: market_id.toString()
    });

  } catch (error) {
    console.error('❌ Error cancelling market on blockchain:', error);
    return res.status(500).json({ 
      error: 'Failed to cancel market on blockchain',
      details: error.message 
    });
  }
}

