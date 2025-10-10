import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { verifyAuth, validateInput, checkRateLimit, logAudit } from './auth-middleware';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTRACT_ADDRESS = "0xB05bAeff61e6E2CfB85d383911912C3248e3214f";
const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

const CONTRACT_ABI = [
  "function buyTickets(uint256 _marketId, uint256 _ticketCount) external payable",
  "function getMarketDetails(uint256 _marketId) external view returns (string memory question, address marketMaker, uint256 marketMakerStake, uint256 ticketPrice, uint256 totalTickets, uint256 ticketsSold, uint256 deadline, bool resolved, address winner)",
  "event TicketsPurchased(uint256 indexed marketId, address indexed buyer, uint256 ticketCount, uint256 totalCost, uint256 timestamp)"
];

// Allowed origins - UPDATE WITH YOUR ACTUAL DOMAINS
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
    endpoint: 'buy-ticket',
    timestamp: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    success: false
  };

  try {
    // 1. VERIFY JWT TOKEN - Extract user from token, NOT from request body
    try {
      authenticatedUser = await verifyAuth(req.headers.authorization);
      auditLog.user_id = authenticatedUser.user_id;
      auditLog.wallet = authenticatedUser.wallet_address;
    } catch (authError) {
      auditLog.error = 'Authentication failed';
      await logAudit(auditLog);
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'Please sign in to buy tickets'
      });
    }

    // 2. RATE LIMITING - Max 5 purchases per minute per user
    const rateLimit = checkRateLimit(authenticatedUser.user_id, 5, 60000);
    if (!rateLimit.allowed) {
      auditLog.error = 'Rate limit exceeded';
      await logAudit(auditLog);
      return res.status(429).json({ 
        error: 'Too many requests',
        details: `Please wait ${rateLimit.resetIn} seconds before trying again`
      });
    }

    // 3. VALIDATE INPUT - NO user_id in body anymore!
    const { market_id, ticket_count } = req.body;
    
    const validationErrors = validateInput(req.body, {
      market_id: { 
        required: true, 
        type: 'string',
        pattern: /^\d+$/  // Only numeric strings
      },
      ticket_count: { 
        required: true, 
        type: 'number',
        min: 1,
        max: 100  // Prevent abuse
      }
    });

    if (validationErrors.length > 0) {
      auditLog.error = 'Validation failed';
      auditLog.validation_errors = validationErrors;
      await logAudit(auditLog);
      return res.status(400).json({ 
        error: 'Invalid input',
        details: validationErrors
      });
    }

    auditLog.market_id = market_id;
    auditLog.ticket_count = ticket_count;

    console.log('🎟️ Buying tickets for authenticated user:', authenticatedUser.user_id);

    // User is already fetched from JWT token
    if (!authenticatedUser.wallet_private_key) {
      console.error('❌ No private key for user:', authenticatedUser.user_id);
      return res.status(400).json({ error: 'Wallet not configured' });
    }

    console.log('✅ User authenticated:', authenticatedUser.wallet_address);

    // Connect to BSC
    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    const wallet = new ethers.Wallet(authenticatedUser.wallet_private_key, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    
    console.log('✅ Wallet connected:', wallet.address);

    // Get market details to calculate cost
    const marketDetails = await contract.getMarketDetails(market_id);
    const ticketPrice = marketDetails[3];
    const ticketsSold = marketDetails[5];
    const totalTickets = marketDetails[4];
    const marketMaker = marketDetails[1];
    
    console.log('📊 Market details:', {
      ticketPrice: ethers.formatEther(ticketPrice),
      ticketsSold: ticketsSold.toString(),
      totalTickets: totalTickets.toString(),
      marketMaker: marketMaker
    });

    // CRITICAL: Prevent market maker from buying their own tickets
    if (marketMaker.toLowerCase() === wallet.address.toLowerCase()) {
      auditLog.error = 'Market maker cannot buy own tickets';
      await logAudit(auditLog);
      return res.status(403).json({ 
        error: 'Cannot buy your own tickets',
        details: 'Market creators cannot purchase tickets in their own markets'
      });
    }

    // Check if enough tickets available
    const ticketsAvailable = totalTickets - ticketsSold;
    if (BigInt(ticket_count) > ticketsAvailable) {
      return res.status(400).json({ 
        error: 'Not enough tickets available',
        details: `Only ${ticketsAvailable.toString()} tickets left`,
        available: ticketsAvailable.toString()
      });
    }

    // Calculate total cost
    const totalCost = ticketPrice * BigInt(ticket_count);
    const totalCostInBNB = parseFloat(ethers.formatEther(totalCost));
    
    console.log('💰 Total cost:', totalCostInBNB, 'BNB');

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    const balanceInBNB = parseFloat(ethers.formatEther(balance));
    
    console.log('💰 Wallet balance:', balanceInBNB, 'BNB');

    const estimatedGas = 0.001;
    const totalRequired = totalCostInBNB + estimatedGas;
    
    if (balanceInBNB < totalRequired) {
      return res.status(400).json({ 
        error: 'Insufficient BNB balance',
        details: `Your wallet has ${balanceInBNB.toFixed(4)} BNB but needs ${totalRequired.toFixed(4)} BNB (${totalCostInBNB} for tickets + ${estimatedGas} gas)`,
        walletAddress: wallet.address,
        currentBalance: balanceInBNB,
        requiredAmount: totalRequired
      });
    }

    console.log('📤 Sending transaction:', {
      market_id,
      ticket_count,
      totalCost: totalCost.toString()
    });

    // Send transaction
    const tx = await contract.buyTickets(market_id, ticket_count, { 
      value: totalCost 
    });
    
    console.log('⏳ Transaction sent:', tx.hash);
    auditLog.tx_hash = tx.hash;

    // Wait for confirmation with timeout
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction timeout after 50s')), 50000)
      )
    ]);

    console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);
    auditLog.block_number = receipt.blockNumber;

    // Get timestamp from block
    const block = await provider.getBlock(receipt.blockNumber);
    const timestamp = block.timestamp;

    // Save to database
    try {
      console.log('💾 Saving transaction to database...');

      const { data: insertedTransaction, error: insertError } = await supabase
        .from('transactions')
        .insert({
          market_id: market_id.toString(),
          buyer_id: authenticatedUser.user_id,  // From JWT token
          buyer_username: authenticatedUser.username,
          buyer_wallet: wallet.address,
          ticket_count: ticket_count,
          total_cost: totalCostInBNB,
          tx_hash: tx.hash,
          block_number: receipt.blockNumber,
          timestamp: timestamp,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Failed to save transaction to DB:', insertError);
      } else {
        console.log('✅ Transaction saved to database:', insertedTransaction);
      }

      // Update market tickets_sold count
      const newTicketsSold = parseInt(ticketsSold.toString()) + ticket_count;
      
      const { error: updateError } = await supabase
        .from('markets')
        .update({ 
          tickets_sold: newTicketsSold
        })
        .eq('market_id', market_id.toString());

      if (updateError) {
        console.error('❌ Failed to update tickets_sold:', updateError);
      } else {
        console.log('✅ Market tickets_sold updated to:', newTicketsSold);
      }
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
    }

    // Log successful audit
    auditLog.success = true;
    await logAudit(auditLog);

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      ticketCount: ticket_count,
      totalCost: totalCostInBNB,
      buyer: wallet.address,
      gasUsed: receipt.gasUsed.toString()
    });

  } catch (error) {
    console.error('❌ Error buying tickets:', error);
    
    // Log failed audit
    auditLog.error = error.message;
    await logAudit(auditLog);
    
    // Handle specific error types
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ 
        error: 'Insufficient BNB balance',
        details: 'Your wallet does not have enough BNB to buy these tickets'
      });
    }

    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      return res.status(400).json({ 
        error: 'Transaction would fail',
        details: 'The contract rejected this transaction. Tickets may be sold out or market closed.'
      });
    }

    if (error.message && error.message.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Transaction timeout',
        details: 'The blockchain transaction took too long. It may still complete. Check BSCScan.'
      });
    }

    return res.status(500).json({ 
      error: 'Failed to buy tickets',
      details: error.message 
    });
  }
}