import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

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

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, market_id, ticket_count } = req.body;

    // Validation
    if (!user_id || !market_id || !ticket_count) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['user_id', 'market_id', 'ticket_count']
      });
    }

    if (ticket_count < 1) {
      return res.status(400).json({ error: 'Ticket count must be at least 1' });
    }

    console.log('🎟️ Buying tickets for user:', user_id);

    // Fetch user from database
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

    // Connect to BSC
    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    const wallet = new ethers.Wallet(userData.wallet_private_key, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    
    console.log('✅ Wallet connected:', wallet.address);

    // Get market details to calculate cost
    const marketDetails = await contract.getMarketDetails(market_id);
    const ticketPrice = marketDetails[3]; // ticketPrice is 4th return value
    const ticketsSold = marketDetails[5]; // ticketsSold is 6th return value
    const totalTickets = marketDetails[4]; // totalTickets is 5th return value
    
    console.log('📊 Market details:', {
      ticketPrice: ethers.formatEther(ticketPrice),
      ticketsSold: ticketsSold.toString(),
      totalTickets: totalTickets.toString()
    });

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

    const estimatedGas = 0.001; // ~0.001 BNB for gas
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

    // Wait for confirmation with timeout
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction timeout after 50s')), 50000)
      )
    ]);

    console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);

    // Get timestamp from block
    const block = await provider.getBlock(receipt.blockNumber);
    const timestamp = block.timestamp;

    console.log('⏰ Block timestamp:', timestamp);

    // ALWAYS save to database - don't rely on event parsing
    try {
      console.log('💾 Saving transaction to database...');

      const { data: insertedTransaction, error: insertError } = await supabase
        .from('transactions')
        .insert({
          market_id: market_id.toString(),
          buyer_id: user_id,
          buyer_username: userData.username,
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
        // Still return success since blockchain transaction succeeded
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
      console.error('Full error:', JSON.stringify(dbError, null, 2));
      // Still return success since blockchain transaction succeeded
    }

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