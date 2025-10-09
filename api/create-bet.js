import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTRACT_ADDRESS = "0xB05bAeff61e6E2CfB85d383911912C3248e3214f";
const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

const CONTRACT_ABI = [
  "function createMarket(string memory _question, uint8 _duration, uint8 _ticketAmount) external payable returns (uint256)",
  "event MarketCreated(uint256 indexed marketId, string question, address indexed marketMaker, uint256 marketMakerStake, uint256 ticketPrice, uint256 totalTickets, uint256 deadline, uint256 createdAt)"
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { user_id, question, stakeAmount, duration, ticketAmount } = req.body;

    if (!user_id || !question || !stakeAmount || duration === undefined || ticketAmount === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['user_id', 'question', 'stakeAmount', 'duration', 'ticketAmount']
      });
    }

    console.log('📝 Creating bet for user:', user_id);

    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('wallet_address, wallet_private_key, username')
      .eq('user_id', user_id)
      .single();

    if (fetchError || !userData) {
      console.error('❌ User fetch error:', fetchError);
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userData.wallet_private_key) {
      console.error('❌ No private key for user:', user_id);
      return res.status(400).json({ error: 'Wallet not configured' });
    }

    console.log('✅ User found:', userData.wallet_address);

    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    const wallet = new ethers.Wallet(userData.wallet_private_key, provider);
    
    console.log('✅ Wallet connected:', wallet.address);

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

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    const stakeInWei = ethers.parseEther(stakeAmount.toString());

    console.log('📤 Sending transaction:', {
      question,
      duration,
      ticketAmount,
      stakeInWei: stakeInWei.toString()
    });

    const tx = await contract.createMarket(question, duration, ticketAmount, { value: stakeInWei });
    console.log('⏳ Transaction sent:', tx.hash);

    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction timeout after 50s')), 50000)
      )
    ]);

    console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);

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
        // Skip logs that don't match
      }
    }

    console.log('📊 Market ID:', marketId);

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
            creator_id: user_id,
            creator_username: userData.username,
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
          console.error(⚠️ Failed to save market to DB:', insertError);
        } else {
          console.log('✅ Market saved to database:', insertedMarket);
        }
      } catch (dbError) {
        console.error('⚠️ Database save failed (non-critical):', dbError.message);
      }
    }

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