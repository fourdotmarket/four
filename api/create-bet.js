import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { verifyAuth, validateInput, checkRateLimit, logAudit, sanitizeResponse } from './auth-middleware';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTRACT_ADDRESS = "0x1975B27384a4B2597Bc105C5CB37c2ee486957fF";
const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

const CONTRACT_ABI = [
  "function createMarket(string memory _question, uint8 _duration, uint8 _ticketAmount) external payable returns (uint256)",
  "event MarketCreated(uint256 indexed marketId, string question, address indexed marketMaker, uint256 marketMakerStake, uint256 ticketPrice, uint256 totalTickets, uint256 deadline, uint256 createdAt)"
];

// SECURITY: Enforced limits - cannot be bypassed by API requests
const MIN_STAKE = 0.05;
const MAX_STAKE = 100;
const MIN_PREDICTION_LENGTH = 50;
const MAX_PREDICTION_LENGTH = 256;

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
    endpoint: 'create-bet',
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
        details: 'Please sign in to create a bet'
      });
    }

    // 2. RATE LIMITING - Max 3 market creations per hour per user
    const rateLimit = checkRateLimit(`create-${authenticatedUser.user_id}`, 3, 3600000);
    if (!rateLimit.allowed) {
      auditLog.error = 'Rate limit exceeded';
      await logAudit(auditLog);
      return res.status(429).json({ 
        error: 'Too many markets created',
        details: `Please wait ${Math.ceil(rateLimit.resetIn / 60)} minutes before creating another market`
      });
    }

    // 3. VALIDATE INPUT - NO user_id in body!
    const { question, stakeAmount, duration, ticketAmount } = req.body;
    
    // SECURITY: Enforced server-side validation - cannot be bypassed
    const validationErrors = validateInput(req.body, {
      question: { 
        required: true, 
        type: 'string',
        minLength: MIN_PREDICTION_LENGTH,  // ENFORCED: Minimum 50 characters
        maxLength: MAX_PREDICTION_LENGTH   // ENFORCED: Maximum 256 characters
      },
      stakeAmount: {
        required: true,
        type: 'number',
        min: MIN_STAKE,  // ENFORCED: Minimum 0.05 BNB
        max: MAX_STAKE   // ENFORCED: Maximum 100 BNB to prevent errors
      },
      duration: {
        required: true,
        type: 'number',
        min: 0,
        max: 4  // Valid duration indices: 0=6h, 1=12h, 2=24h, 3=3d, 4=7d
      },
      ticketAmount: {
        required: true,
        type: 'number',
        min: 0,
        max: 3  // Valid ticket amount indices: 0=1, 1=10, 2=50, 3=100
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

    // ADDITIONAL SECURITY: Double-check stake amount (can't be bypassed)
    if (parseFloat(stakeAmount) < MIN_STAKE) {
      auditLog.error = 'Stake below minimum';
      await logAudit(auditLog);
      return res.status(400).json({ 
        error: 'Invalid stake amount',
        details: `Minimum stake is ${MIN_STAKE} BNB`
      });
    }

    // ADDITIONAL SECURITY: Double-check question length (can't be bypassed)
    if (question.length < MIN_PREDICTION_LENGTH) {
      auditLog.error = 'Prediction too short';
      await logAudit(auditLog);
      return res.status(400).json({ 
        error: 'Prediction too short',
        details: `Prediction must be at least ${MIN_PREDICTION_LENGTH} characters (currently ${question.length})`
      });
    }

    if (question.length > MAX_PREDICTION_LENGTH) {
      auditLog.error = 'Prediction too long';
      await logAudit(auditLog);
      return res.status(400).json({ 
        error: 'Prediction too long',
        details: `Prediction must be at most ${MAX_PREDICTION_LENGTH} characters (currently ${question.length})`
      });
    }

    auditLog.question = question;
    auditLog.stake_amount = stakeAmount;

    console.log('🔒 Creating bet for authenticated user:', authenticatedUser.user_id);

    // User already fetched from JWT token
    if (!authenticatedUser.wallet_private_key) {
      console.error('❌ No private key for user:', authenticatedUser.user_id);
      return res.status(400).json({ error: 'Wallet not configured' });
    }

    console.log('✅ User authenticated:', authenticatedUser.wallet_address);

    // Connect to BSC
    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    const wallet = new ethers.Wallet(authenticatedUser.wallet_private_key, provider);
    
    console.log('✅ Wallet connected:', wallet.address);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    const balanceInBNB = parseFloat(ethers.formatEther(balance));
    const stakeInBNB = parseFloat(stakeAmount);
    
    console.log('💰 Wallet balance:', balanceInBNB, 'BNB');
    console.log('💰 Required stake:', stakeInBNB, 'BNB');

    const estimatedGas = 0.001;
    const totalRequired = stakeInBNB + estimatedGas;
    
    if (balanceInBNB < totalRequired) {
      return res.status(400).json({ 
        error: 'Insufficient BNB balance',
        details: `Your wallet has ${balanceInBNB.toFixed(4)} BNB but needs ${totalRequired.toFixed(4)} BNB (${stakeInBNB} stake + ${estimatedGas} gas)`,
        walletAddress: wallet.address,
        currentBalance: balanceInBNB,
        requiredAmount: totalRequired
      });
    }

    // Create contract instance
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    const stakeInWei = ethers.parseEther(stakeAmount.toString());

    console.log('📤 Sending transaction:', {
      question,
      duration,
      ticketAmount,
      stakeInWei: stakeInWei.toString()
    });

    // Send transaction
    const tx = await contract.createMarket(question, duration, ticketAmount, { 
      value: stakeInWei 
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

    // Parse event logs to get market ID
    let marketId = null;
    let eventData = null;

    for (const log of receipt.logs) {
      try {
        const parsedLog = contract.interface.parseLog(log);
        if (parsedLog && parsedLog.name === 'MarketCreated') {
          marketId = parsedLog.args.marketId.toString();
          eventData = {
            marketId: parsedLog.args.marketId.toString(),
            question: parsedLog.args.question,
            marketMaker: parsedLog.args.marketMaker,
            marketMakerStake: parsedLog.args.marketMakerStake.toString(),
            ticketPrice: parsedLog.args.ticketPrice.toString(),
            totalTickets: parsedLog.args.totalTickets.toString(),
            deadline: parsedLog.args.deadline.toString(),
            createdAt: parsedLog.args.createdAt.toString()
          };
          break;
        }
      } catch (e) {
        // Skip logs that don't match our event
      }
    }

    console.log('📊 Market ID:', marketId);
    auditLog.market_id = marketId;

    // Save to database
    if (eventData) {
      try {
        const stakeInBNB = parseFloat(ethers.formatEther(eventData.marketMakerStake));
        const ticketPriceInBNB = parseFloat(ethers.formatEther(eventData.ticketPrice));

        console.log('💾 Saving to database...');

        const { data: insertedMarket, error: insertError } = await supabase
          .from('markets')
          .insert({
            market_id: eventData.marketId,
            question: eventData.question,
            creator_id: authenticatedUser.user_id,  // From JWT token
            creator_username: authenticatedUser.username,
            creator_wallet: eventData.marketMaker,
            stake: stakeInBNB,
            ticket_price: ticketPriceInBNB,
            total_tickets: parseInt(eventData.totalTickets),
            tickets_sold: 0,
            deadline: parseInt(eventData.deadline),
            created_at_timestamp: parseInt(eventData.createdAt),
            tx_hash: tx.hash,
            block_number: receipt.blockNumber,
            status: 'active',
            banner_url: null
          })
          .select()
          .single();

        if (insertError) {
          console.error('⚠️ Failed to save market to DB:', insertError);
        } else {
          console.log('✅ Market saved to database');
          // Don't log full market data (contains creator_id)
        }
      } catch (dbError) {
        console.error('⚠️ Database save failed (non-critical):', dbError.message);
      }
    }

    // Log successful audit
    auditLog.success = true;
    await logAudit(auditLog);

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      marketId: marketId,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      creator: wallet.address
    });

  } catch (error) {
    console.error('❌ Error creating bet:', error);
    
    // Log failed audit
    auditLog.error = error.message;
    await logAudit(auditLog);
    
    // Handle specific error types
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ 
        error: 'Insufficient BNB balance',
        details: 'Your wallet does not have enough BNB to create this bet'
      });
    }

    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      return res.status(400).json({ 
        error: 'Transaction would fail',
        details: 'The contract rejected this transaction. Check your parameters.'
      });
    }

    if (error.message && error.message.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Transaction timeout',
        details: 'The blockchain transaction took too long. It may still complete. Check BSCScan.'
      });
    }

    return res.status(500).json({ 
      error: 'Failed to create bet',
      details: error.message 
    });
  }
}