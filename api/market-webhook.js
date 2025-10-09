const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');

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
      question, 
      marketMaker, 
      marketMakerStake, 
      ticketPrice, 
      totalTickets, 
      deadline, 
      createdAt,
      txHash,
      blockNumber
    } = req.body;

    console.log('📥 Webhook received:', { marketId, question, marketMaker });

    const { data: creator, error: creatorError } = await supabase
      .from('users')
      .select('user_id, username')
      .eq('wallet_address', marketMaker)
      .single();

    if (creatorError || !creator) {
      console.error('❌ Creator not found:', marketMaker);
      return res.status(404).json({ error: 'Creator not found' });
    }

    const stakeInBNB = parseFloat(ethers.formatEther(marketMakerStake));
    const ticketPriceInBNB = parseFloat(ethers.formatEther(ticketPrice));

    const { data: newMarket, error: insertError } = await supabase
      .from('markets')
      .insert({
        market_id: marketId.toString(),
        question: question,
        creator_id: creator.user_id,
        creator_username: creator.username,
        creator_wallet: marketMaker,
        stake: stakeInBNB,
        ticket_price: ticketPriceInBNB,
        total_tickets: totalTickets.toString(),
        tickets_sold: 0,
        deadline: deadline.toString(),
        created_at_timestamp: createdAt.toString(),
        tx_hash: txHash,
        block_number: blockNumber,
        status: 'active',
        banner_url: null
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save market' });
    }

    console.log('✅ Market saved to database:', newMarket);

    return res.status(200).json({
      success: true,
      market: newMarket
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
};