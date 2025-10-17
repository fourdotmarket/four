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
            content: `You are an expert market analyst for a prediction market platform. Provide comprehensive, in-depth analysis of predictions with detailed reasoning.
            
Rules:
- For crypto price predictions (BTC, ETH, SOL, BNB), analyze: current price levels, recent trends, technical indicators, market sentiment, volume patterns, and key resistance/support levels
- For social media follower counts, analyze: current growth rate, recent viral content, platform trends, competitor analysis
- If Twitter/X link provided, incorporate social media sentiment and community discussion into analysis
- For generic/test markets (e.g., "TEST will reach X"), return "SKIP"
- Analysis MUST be between 400-600 characters
- Provide detailed probability assessment with percentage
- Include multiple factors: technical analysis, market conditions, historical patterns, risk factors, and social sentiment if available
- Structure: [Probability] + [Current State] + [Technical/Social Factors] + [Market Context] + [Risk Assessment] + [Conclusion]
- If insufficient data, provide detailed explanation of what's missing and why

Output format (400-600 characters):
[X% Probability]: [Current market state]. [Technical/social analysis with specifics]. [Market sentiment and volume/community analysis]. [Key levels or growth patterns]. [Risk factors and catalysts]. [Final assessment with reasoning].

Example: "35% Probability: Bitcoin currently trading at $65,340, consolidating after pullback from $68K. Technical indicators show RSI at 52 (neutral), MACD weakening, 50-day MA support at $64,800. Twitter sentiment is cautiously optimistic with increased whale activity discussions. Market volume down 12% suggesting profit-taking. A move to $70K within 24h requires 15-20% volume increase and breakthrough of $67,500 resistance. Key catalysts: regulatory news or institutional announcements. Current macro conditions suggest continued consolidation more likely than breakout."`
          },
          {
            role: 'user',
            content: `Analyze this prediction market:\n\nQuestion: ${question}${context}\n\nProvide your analysis.`
          }
        ],
        model: 'grok-2-1212', // Fastest model
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

