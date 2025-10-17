// API Endpoint: Claim Refund from Cancelled Markets
const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Import auth middleware
const { authenticateToken } = require('./auth-middleware');

// Contract ABI - only the functions we need
const CONTRACT_ABI = [
  "function markets(uint256) view returns (string question, address marketMaker, uint256 marketMakerStake, uint256 ticketPrice, uint256 totalTickets, uint256 ticketsSold, uint256 totalPayout, uint256 deadline, bool outcome, uint8 status)",
  "function claimableRefunds(uint256 marketId, address user) view returns (uint256)",
  "function claimRefund(uint256 marketId)",
  "event RefundClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount)"
];

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const authenticatedUser = authenticateToken(req);
    if (!authenticatedUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { marketId } = req.body;

    if (!marketId && marketId !== 0) {
      return res.status(400).json({ error: 'Market ID is required' });
    }

    console.log(`\n💵 Claim Refund Request`);
    console.log(`User: ${authenticatedUser.username} (${authenticatedUser.wallet_address})`);
    console.log(`Market ID: ${marketId}`);

    // Get user's private key securely
    const { data: keyData, error: keyError } = await supabase
      .from('user_keys')
      .select('encrypted_private_key')
      .eq('user_id', authenticatedUser.user_id)
      .single();

    if (keyError || !keyData) {
      console.error('❌ Private key not found:', keyError);
      return res.status(404).json({ error: 'Private key not found' });
    }

    const privateKey = keyData.encrypted_private_key;

    // Validate private key format
    if (!privateKey.startsWith('0x')) {
      return res.status(400).json({ error: 'Invalid private key format' });
    }

    // Connect to BSC
    console.log('🔧 Connecting to BSC network...');
    const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    // Verify wallet address matches authenticated user
    if (wallet.address.toLowerCase() !== authenticatedUser.wallet_address.toLowerCase()) {
      console.error('❌ Wallet address mismatch!');
      return res.status(403).json({ error: 'Wallet address mismatch' });
    }

    // Get market details from blockchain
    console.log(`📊 Fetching Market #${marketId} from blockchain...`);
    const market = await contract.markets(marketId);

    // Check if market is cancelled (status = 2)
    if (market.status !== 2n) {
      return res.status(400).json({ 
        error: 'Market has not been cancelled',
        details: 'Only cancelled markets allow refund claims.'
      });
    }

    // Check claimable refund amount
    const refundAmount = await contract.claimableRefunds(marketId, wallet.address);
    console.log(`💵 User's Claimable Refund: ${ethers.formatEther(refundAmount)} BNB`);

    if (refundAmount === 0n) {
      return res.status(400).json({ 
        error: 'No refund available',
        details: 'Either you didn\'t participate or you already claimed your refund.'
      });
    }

    // Get balance before
    const balanceBefore = await provider.getBalance(wallet.address);

    // Claim refund
    console.log('🔄 Claiming refund on blockchain...');
    const tx = await contract.claimRefund(marketId, {
      gasLimit: 300000n
    });

    console.log(`⏳ Transaction sent: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await tx.wait();

    // Get balance after
    const balanceAfter = await provider.getBalance(wallet.address);
    const netReceived = balanceAfter - balanceBefore;

    console.log('✅ Refund claimed successfully!');
    console.log(`📋 Transaction Hash: ${receipt.hash}`);
    console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);

    // Parse the RefundClaimed event to get actual amount
    const claimEvent = receipt.logs
      .map(log => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(event => event && event.name === 'RefundClaimed');

    const actualAmount = claimEvent ? claimEvent.args.amount : refundAmount;

    // Update database to mark as claimed (optional tracking)
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
};

