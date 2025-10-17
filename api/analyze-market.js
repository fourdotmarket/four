// API Endpoint: AI Market Analysis using GROK AI
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Rate limiting store
const analysisCache = new Map();
const CACHE_DURATION = 3600000; // 1 hour

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

    // Check cache first
    const cacheKey = `${marketId}`;
    const cached = analysisCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log('📋 Returning cached analysis for market:', marketId);
      return res.status(200).json({ analysis: cached.analysis });
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
            content: `You are an expert market analyst with real-time data access. Use your web search capabilities to find CURRENT prices and data.

CRITICAL: ALWAYS search for current prices FIRST before analyzing:
- For BTC/ETH/SOL/BNB: Search Twitter, CoinGecko, CoinMarketCap for REAL current price
- For followers: Search for ACTUAL current follower count
- If Twitter/X link provided: Search and read the actual post + community reactions

Rules:
- STEP 1: Search for current price/data
- STEP 2: Analyze using REAL data from your search
- Analysis MUST be 400-600 characters
- Include ACTUAL numbers from search results
- Provide probability % based on REAL current data
- Structure: [Probability] + [Current REAL Price/State] + [Technical/Social Analysis] + [Market Context] + [Risk Assessment]
- For test markets: return "SKIP"

Output format (400-600 characters with REAL data):
[X% Probability]: [Asset] currently at $[SEARCHED PRICE] (verified [time]). [Technical analysis with real indicators]. [Market sentiment from Twitter/socials]. [Key levels]. [Risk factors]. [Conclusion based on real data].

Example: "42% Probability: Bitcoin at $67,234 (verified 3 min ago via CoinGecko). Recent 4H candles show consolidation $66.8K-$67.5K. Twitter crypto sentiment 64% bullish (last 6hrs). RSI 56 (neutral-bullish), MACD upward. Whale wallets +8% activity. Move to $70K needs $68.2K resistance break + 18% volume. Support $66K. Moderate probability given consolidation + positive sentiment."`
          },
          {
            role: 'user',
            content: `Analyze this prediction market:\n\nQuestion: ${question}${context}\n\nProvide your analysis.`
          }
        ],
        model: 'grok-4-latest', // Latest model with real-time web search
        stream: false,
        temperature: 0.3,
        max_tokens: 800
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokApiKey}`
        },
        timeout: 8000 // 8 second timeout
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

    // Store in cache
    analysisCache.set(cacheKey, {
      analysis,
      timestamp: Date.now()
    });

    // Save to database
    try {
      const { error: updateError } = await supabase
        .from('markets')
        .update({ ai_analysis: analysis })
        .eq('market_id', marketId);

      if (updateError) {
        console.error('❌ Error saving analysis to DB:', updateError);
      } else {
        console.log('💾 Analysis saved to database');
      }
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      // Don't fail the request if DB save fails
    }

    return res.status(200).json({ analysis });

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

