const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
const { sanitizeResponse } = require('./auth-middleware');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      marketId, 
      buyer, 
      ticketCount, 
      totalCost, 
      timestamp,
      txHash,
      blockNumber
    } = req.body;

    console.log('🎟️ Ticket webhook received:', { marketId, buyer, ticketCount });

    // Find buyer in database
    const { data: buyerData, error: buyerError } = await supabase
      .from('users')
      .select('user_id, username')
      .eq('wallet_address', buyer)
      .single();

    if (buyerError || !buyerData) {
      console.error('❌ Buyer not found:', buyer);
      return res.status(404).json({ error: 'Buyer not found' });
    }

    const costInBNB = parseFloat(ethers.formatEther(totalCost));

    // Save transaction
    const { data: newTransaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        market_id: marketId.toString(),
        buyer_id: buyerData.user_id,
        buyer_username: buyerData.username,
        buyer_wallet: buyer,
        ticket_count: parseInt(ticketCount.toString()),
        total_cost: costInBNB,
        tx_hash: txHash,
        block_number: blockNumber,
        timestamp: parseInt(timestamp.toString()),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save transaction' });
    }

    console.log('✅ Transaction saved to database:', newTransaction);

    // Update market tickets_sold
    const { data: market, error: marketError } = await supabase
      .from('markets')
      .select('tickets_sold')
      .eq('market_id', marketId.toString())
      .single();

    if (!marketError && market) {
      const newTicketsSold = market.tickets_sold + parseInt(ticketCount.toString());
      
      const { error: updateError } = await supabase
        .from('markets')
        .update({ tickets_sold: newTicketsSold })
        .eq('market_id', marketId.toString());

      if (updateError) {
        console.error('⚠️ Failed to update tickets_sold:', updateError);
      } else {
        console.log('✅ Market updated - tickets_sold:', newTicketsSold);
      }
    }

    // SECURITY: Sanitize response - remove sensitive IDs
    return res.status(200).json({
      success: true,
      transaction: sanitizeResponse(newTransaction)
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
};