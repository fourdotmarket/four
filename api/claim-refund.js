// API Endpoint: Claim Refund from Cancelled Markets
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { verifyAuth, validateInput, checkRateLimit, logAudit } from './auth-middleware';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x8dDbbBEAc546B4AeF8DFe8edd0084eF19B9077b6";
const BSC_RPC_URL = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/";

// Contract ABI - only the functions we need
const CONTRACT_ABI = [
  "function markets(uint256) view returns (string question, address marketMaker, uint256 marketMakerStake, uint256 ticketPrice, uint256 totalTickets, uint256 ticketsSold, uint256 totalPayout, uint256 deadline, bool outcome, uint8 status)",
  "function claimableRefunds(uint256 marketId, address user) view returns (uint256)",
  "function claimRefund(uint256 marketId)",
  "event RefundClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount)"
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
    endpoint: 'claim-refund',
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
        details: 'Please sign in to claim refund'
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

    console.log(`\n💵 Claim Refund Request`);
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

    // Check if market is cancelled (status = 2)
    if (market.status !== 2n) {
      auditLog.error = 'Market not cancelled';
      await logAudit(auditLog);
      return res.status(400).json({ 
        error: 'Market has not been cancelled',
        details: 'Only cancelled markets allow refund claims.'
      });
    }

    // 7. CHECK CLAIMABLE REFUND AMOUNT
    const refundAmount = await contract.claimableRefunds(marketId, wallet.address);
    console.log(`💵 User's Claimable Refund: ${ethers.formatEther(refundAmount)} BNB`);

    if (refundAmount === 0n) {
      auditLog.error = 'No refund available';
      await logAudit(auditLog);
      return res.status(400).json({ 
        error: 'No refund available',
        details: 'Either you didn\'t participate or you already claimed your refund.'
      });
    }

    // Get balance before
    const balanceBefore = await provider.getBalance(wallet.address);

    // 8. CLAIM REFUND ON BLOCKCHAIN
    console.log('🔄 Claiming refund on blockchain...');
    const tx = await contract.claimRefund(marketId, {
      gasLimit: 300000n
    });

    console.log(`⏳ Transaction sent: ${tx.hash}`);
    auditLog.tx_hash = tx.hash;

    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    // Get balance after
    const balanceAfter = await provider.getBalance(wallet.address);
    const netReceived = balanceAfter - balanceBefore;

    console.log('✅ Refund claimed successfully!');
    console.log(`📋 Transaction Hash: ${receipt.hash}`);
    console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);

    // Parse the RefundClaimed event to get actual amount
    let actualAmount = refundAmount;
    try {
      const claimEvent = receipt.logs
        .map(log => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(event => event && event.name === 'RefundClaimed');

      if (claimEvent) {
        actualAmount = claimEvent.args.amount;
      }
    } catch (e) {
      console.log('⚠️ Could not parse event, using claimable amount');
    }

    // 9. RECORD IN DATABASE (optional tracking)
    try {
      await supabase
        .from('refunds_claimed')
        .insert({
          market_id: marketId,
          user_id: authenticatedUser.user_id,
          wallet_address: wallet.address,
          amount: ethers.formatEther(actualAmount),
          tx_hash: receipt.hash,
          claimed_at: new Date().toISOString()
        });
    } catch (dbError) {
      console.error('⚠️ Failed to record refund in database:', dbError.message);
      // Don't fail the request - blockchain transaction succeeded
    }

    // 10. SUCCESS AUDIT LOG
    auditLog.success = true;
    auditLog.market_id = marketId;
    auditLog.amount = ethers.formatEther(actualAmount);
    await logAudit(auditLog);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Refund claimed successfully!',
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      refundAmount: ethers.formatEther(actualAmount),
      netReceived: ethers.formatEther(netReceived),
      newBalance: ethers.formatEther(balanceAfter)
    });

  } catch (error) {
    console.error('\n❌ Claim Refund Error:', error);
    
    auditLog.error = error.message;
    await logAudit(auditLog);
    
    // Parse error messages
    let errorMessage = 'Failed to claim refund';
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
