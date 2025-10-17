// API Endpoint: Claim Winnings from Resolved Markets
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { verifyAuth, validateInput, checkRateLimit, logAudit } from './auth-middleware';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x8dDbbBEAc546B4AeF8DFe8edd0084eF19B9077b6";
const BSC_RPC_URL = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/";

// Contract ABI - Matches the actual struct order in the smart contract
const CONTRACT_ABI = [
  // markets mapping returns: (id, question, marketMaker, marketMakerStake, ticketPrice, totalTickets, ticketsSold, deadline, status, outcome, createdAt, totalPayout, makerClaimed)
  "function markets(uint256) view returns (uint256 id, string question, address marketMaker, uint256 marketMakerStake, uint256 ticketPrice, uint256 totalTickets, uint256 ticketsSold, uint256 deadline, uint8 status, bool outcome, uint256 createdAt, uint256 totalPayout, bool makerClaimed)",
  "function ticketsBought(uint256 marketId, address buyer) view returns (uint256)",
  "function getUserHasClaimed(uint256 marketId, address user) view returns (bool)",
  "function claimWinnings(uint256 marketId)",
  "event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount)"
];

// Allowed origins
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://four-lovat-mu.vercel.app',
  'https://four.market'
];

export default async function handler(req, res) {
  // Strict CORS
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let authenticatedUser = null;
  let auditLog = {
    endpoint: 'claim-winnings',
    timestamp: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    success: false
  };

  try {
    // 1. VERIFY JWT TOKEN
    try {
      authenticatedUser = await verifyAuth(req.headers.authorization);
      auditLog.user_id = authenticatedUser.user_id;
      auditLog.wallet = authenticatedUser.wallet_address;
    } catch (authError) {
      auditLog.error = 'Authentication failed';
      await logAudit(auditLog);
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'Please sign in to claim winnings'
      });
    }

    // 2. RATE LIMITING
    const rateLimit = checkRateLimit(authenticatedUser.user_id, 3, 60000);
    if (!rateLimit.allowed) {
      auditLog.error = 'Rate limit exceeded';
      await logAudit(auditLog);
      return res.status(429).json({ 
        error: 'Too many requests',
        details: `Please wait ${rateLimit.resetIn} seconds before trying again`
      });
    }

    // 3. VALIDATE INPUT
    const { marketId } = req.body;
    
    const validationErrors = validateInput(req.body, {
      marketId: { 
        required: true, 
        type: 'number',
        min: 0
      }
    });

    if (validationErrors.length > 0) {
      auditLog.error = validationErrors.join(', ');
      await logAudit(auditLog);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors
      });
    }

    console.log(`\n🎉 Claim Winnings Request`);
    console.log(`User: ${authenticatedUser.username} (${authenticatedUser.wallet_address})`);
    console.log(`Market ID: ${marketId}`);

    // 4. GET USER'S PRIVATE KEY
    const privateKey = authenticatedUser.wallet_private_key;

    if (!privateKey) {
      auditLog.error = 'Private key not found';
      await logAudit(auditLog);
      return res.status(404).json({ error: 'Wallet not configured' });
    }

    // 5. CONNECT TO BSC
    console.log('🔧 Connecting to BSC network...');
    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    // Verify wallet address matches authenticated user
    if (wallet.address.toLowerCase() !== authenticatedUser.wallet_address.toLowerCase()) {
      console.error('❌ Wallet address mismatch!');
      auditLog.error = 'Wallet address mismatch';
      await logAudit(auditLog);
      return res.status(403).json({ error: 'Wallet address mismatch' });
    }

    // 6. GET MARKET DETAILS FROM BLOCKCHAIN
    console.log(`📊 Fetching Market #${marketId} from blockchain...`);
    const market = await contract.markets(marketId);

    // Check if market is resolved (status = 1)
    if (market.status !== 1n) {
      auditLog.error = 'Market not resolved';
      await logAudit(auditLog);
      return res.status(400).json({ error: 'Market has not been resolved yet' });
    }

    // 7. GET PLAYER'S TICKETS
    const tickets = await contract.ticketsBought(marketId, wallet.address);
    console.log(`🎫 User's Tickets: ${tickets.toString()}`);

    // 8. CHECK IF ALREADY CLAIMED
    const hasClaimed = await contract.getUserHasClaimed(marketId, wallet.address);
    if (hasClaimed) {
      auditLog.error = 'Already claimed';
      await logAudit(auditLog);
      return res.status(400).json({ error: 'You have already claimed your winnings' });
    }

    // 9. DETERMINE ELIGIBILITY
    const isMarketMaker = wallet.address.toLowerCase() === market.marketMaker.toLowerCase();

    if (market.outcome && !isMarketMaker) {
      auditLog.error = 'Not eligible - maker won';
      await logAudit(auditLog);
      return res.status(400).json({ 
        error: 'Market Maker won this market. You cannot claim.',
        details: 'Challengers did not win this time.'
      });
    }

    if (!market.outcome && tickets === 0n) {
      auditLog.error = 'No tickets purchased';
      await logAudit(auditLog);
      return res.status(400).json({ error: 'You did not purchase any tickets in this market' });
    }

    if (!market.outcome && isMarketMaker) {
      auditLog.error = 'Not eligible - challengers won';
      await logAudit(auditLog);
      return res.status(400).json({ error: 'Challengers won this market. Market maker cannot claim.' });
    }

    // 10. CALCULATE ESTIMATED PAYOUT
    let estimatedPayout;
    if (market.outcome && isMarketMaker) {
      estimatedPayout = market.totalPayout;
    } else {
      estimatedPayout = (market.totalPayout * tickets) / market.ticketsSold;
    }

    console.log(`💰 Estimated Payout: ${ethers.formatEther(estimatedPayout)} BNB`);

    // Get balance before
    const balanceBefore = await provider.getBalance(wallet.address);

    // 11. CLAIM WINNINGS ON BLOCKCHAIN
    console.log('🎉 Claiming winnings on blockchain...');
    const tx = await contract.claimWinnings(marketId, {
      gasLimit: 300000n
    });

    console.log(`⏳ Transaction sent: ${tx.hash}`);
    auditLog.tx_hash = tx.hash;

    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    // Get balance after
    const balanceAfter = await provider.getBalance(wallet.address);
    const netReceived = balanceAfter - balanceBefore;

    console.log('✅ Winnings claimed successfully!');
    console.log(`📋 Transaction Hash: ${receipt.hash}`);
    console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);

    // Parse the WinningsClaimed event to get actual amount
    let actualAmount = estimatedPayout;
    try {
      const claimEvent = receipt.logs
        .map(log => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(event => event && event.name === 'WinningsClaimed');

      if (claimEvent) {
        actualAmount = claimEvent.args.amount;
      }
    } catch (e) {
      console.log('⚠️ Could not parse event, using estimated amount');
    }

    // 12. RECORD IN DATABASE (optional tracking)
    try {
      await supabase
        .from('winnings_claimed')
        .insert({
          market_id: marketId,
          user_id: authenticatedUser.user_id,
          wallet_address: wallet.address,
          amount: ethers.formatEther(actualAmount),
          tx_hash: receipt.hash,
          claimed_at: new Date().toISOString()
        });
    } catch (dbError) {
      console.error('⚠️ Failed to record claim in database:', dbError.message);
      // Don't fail the request - blockchain transaction succeeded
    }

    // 13. SUCCESS AUDIT LOG
    auditLog.success = true;
    auditLog.market_id = marketId;
    auditLog.amount = ethers.formatEther(actualAmount);
    await logAudit(auditLog);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Winnings claimed successfully!',
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      grossWinnings: ethers.formatEther(actualAmount),
      netReceived: ethers.formatEther(netReceived),
      newBalance: ethers.formatEther(balanceAfter)
    });

  } catch (error) {
    console.error('\n❌ Claim Winnings Error:', error);
    
    auditLog.error = error.message;
    await logAudit(auditLog);
    
    // Parse error messages
    let errorMessage = 'Failed to claim winnings';
    if (error.reason) {
      errorMessage = error.reason;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return res.status(500).json({ 
      error: errorMessage,
      details: error.message
    });
  }
}
