// API Endpoint: AI Market Analysis using GROK AI
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Cache duration - 24 hours to prevent re-analysis on refresh
const CACHE_DURATION = 86400000; // 24 hours

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { marketId, question, twitterLink } = req.body;

    if (!marketId || !question) {
      return res.status(400).json({ error: 'Market ID and question required' });
    }

    // CRITICAL: Check database FIRST to prevent re-analysis on refresh
    console.log('🔍 Checking database for existing analysis...');
    const { data: existingMarket, error: dbError } = await supabase
      .from('markets')
      .select('ai_analysis')
      .eq('market_id', marketId)
      .single();

    if (!dbError && existingMarket && existingMarket.ai_analysis) {
      console.log('✅ Found existing analysis in database for market:', marketId);
      return res.status(200).json({ 
        analysis: existingMarket.ai_analysis,
        fromCache: true 
      });
    }

    // Check if market should be analyzed
    if (shouldSkipAnalysis(question)) {
      console.log('⏭️ Skipping analysis for generic/test market:', question);
      return res.status(200).json({ 
        analysis: null,
        skipped: true,
        reason: 'Generic or test market'
      });
    }

    console.log('🤖 Starting AI analysis for market:', marketId);

    // Get context from Twitter link if provided
    let context = '';
    if (twitterLink) {
      context = `\nRelated link: ${twitterLink}`;
    }

    // Call GROK AI
    const grokApiKey = process.env.API_KEY_GROK;
    if (!grokApiKey) {
      throw new Error('GROK API key not configured');
    }

    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        messages: [
          {
            role: 'system',
            content: `You are an expert market analyst with real-time web search capabilities. You MUST search the web for current data before analyzing.

MANDATORY STEPS:
1. SEARCH WEB for current prices/data (CoinGecko, CoinMarketCap, Twitter, news sites)
2. VERIFY the data is recent (within last hour)
3. ANALYZE using ONLY the real data you found

For crypto predictions (BTC, ETH, SOL, BNB):
- Search "bitcoin price" OR "BTC USD" on CoinGecko/CoinMarketCap
- Get EXACT current price (e.g., $67,234.56)
- Check recent price action (1H, 4H, 24H charts)
- Search Twitter for "BTC" + "crypto" sentiment

For social media predictions (followers, engagement):
- Search the actual profile/page
- Get REAL current follower count
- Check recent growth trends

For event predictions:
- Search news sites for latest updates
- Verify event status and timeline
- Check expert opinions and betting odds

OUTPUT FORMAT (400-600 characters):
[X% Probability]: [Asset] at $[EXACT PRICE] (via [source], [time] ago). [Price action: support/resistance levels]. [Technical indicators if applicable]. [Market sentiment from social/news]. [Key factors affecting outcome]. [Risk assessment]. [Conclusion with reasoning].

CRITICAL: Include ACTUAL numbers from your search. Do NOT estimate or guess prices. If you cannot find real data, state "Unable to verify current data" and provide limited analysis.

Example: "38% Probability: Bitcoin currently at $67,234 (CoinGecko, 2 min ago). Trading in $66.8K-$67.5K range past 4 hours. Target $70K requires breaking $68.2K resistance with volume spike. Twitter sentiment 61% bullish. RSI 54 (neutral). Major support at $66K. Moderate-low probability given tight consolidation and resistance overhead."`
          },
          {
            role: 'user',
            content: `Analyze this prediction market. You MUST search the web for current prices/data first:\n\nQuestion: ${question}${context}\n\nSearch for real-time data and provide your analysis based on what you find.`
          }
        ],
        model: 'grok-2-latest', // Latest GROK model with web search
        stream: false,
        temperature: 0.2, // Lower temp for more factual responses
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokApiKey}`
        },
        timeout: 300000 // 5 minutes timeout - allows time for web searches
      }
    );

    const analysis = response.data.choices[0]?.message?.content?.trim();

    if (!analysis || analysis === 'SKIP') {
      console.log('⏭️ AI skipped analysis');
      return res.status(200).json({ 
        analysis: null,
        skipped: true 
      });
    }

    console.log('✅ AI analysis generated:', analysis);

    // Save to database immediately (primary cache)
    try {
      const { error: updateError } = await supabase
        .from('markets')
        .update({ ai_analysis: analysis })
        .eq('market_id', marketId);

      if (updateError) {
        console.error('❌ Error saving analysis to DB:', updateError);
      } else {
        console.log('💾 Analysis saved to database - will be cached for 24 hours');
      }
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      // Don't fail the request if DB save fails
    }

    return res.status(200).json({ 
      analysis,
      fromCache: false 
    });

  } catch (error) {
    console.error('❌ Error in AI analysis:', error);

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(200).json({ 
        analysis: 'Analysis timeout - market too complex',
        timeout: true 
      });
    }

    return res.status(500).json({
      error: 'Failed to analyze market',
      message: error.response?.data?.error?.message || error.message
    });
  }
};

// Helper function to check if market should be skipped
function shouldSkipAnalysis(question) {
  const skipPatterns = [
    /test/i,
    /\$?test\b/i,
    /example/i,
    /demo/i,
    /^[a-z]{1,4}\s+(above|below|reach)/i // Very generic like "xyz above 100"
  ];

  const lowerQuestion = question.toLowerCase();

  // Skip if matches skip patterns
  for (const pattern of skipPatterns) {
    if (pattern.test(lowerQuestion)) {
      return true;
    }
  }

  // Check if it mentions known crypto tokens
  const knownTokens = ['btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana', 'bnb', 'binance'];
  const hasKnownToken = knownTokens.some(token => lowerQuestion.includes(token));

  // If no known tokens and no specific context, skip
  if (!hasKnownToken && question.length < 20) {
    return true;
  }

  return false;
}

