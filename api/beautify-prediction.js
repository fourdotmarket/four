// API Endpoint: Beautify Prediction using GROK AI (x.ai)
const axios = require('axios');

// Rate limiting store (in-memory)
const rateLimitStore = new Map();
const MAX_REQUESTS = 10; // Max 10 requests per user
const TIME_WINDOW = 60000; // 1 minute window

function checkRateLimit(identifier) {
  const now = Date.now();
  const userRequests = rateLimitStore.get(identifier) || [];
  
  // Remove old requests outside the time window
  const validRequests = userRequests.filter(timestamp => now - timestamp < TIME_WINDOW);
  
  if (validRequests.length >= MAX_REQUESTS) {
    const oldestRequest = validRequests[0];
    const resetIn = Math.ceil((oldestRequest + TIME_WINDOW - now) / 1000);
    return {
      allowed: false,
      resetIn
    };
  }
  
  validRequests.push(now);
  rateLimitStore.set(identifier, validRequests);
  
  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    cleanupRateLimitStore(now);
  }
  
  return { allowed: true };
}

function cleanupRateLimitStore(now) {
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const validTimestamps = timestamps.filter(ts => now - ts < TIME_WINDOW);
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, validTimestamps);
    }
  }
}

// Allowed origins
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://four-lovat-mu.vercel.app',
  'https://four.market'
];

module.exports = async function handler(req, res) {
  // CORS
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Rate limiting based on IP
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const rateLimit = checkRateLimit(clientIp);
    
    if (!rateLimit.allowed) {
      console.log(`⚠️ Rate limit exceeded for ${clientIp}`);
      return res.status(429).json({ 
        error: 'Too many requests',
        message: `Please wait ${rateLimit.resetIn} seconds before trying again`
      });
    }

    const { prediction, timeframe } = req.body;

    if (!prediction) {
      return res.status(400).json({ error: 'Prediction text is required' });
    }

    if (!timeframe) {
      return res.status(400).json({ error: 'Timeframe is required' });
    }

    // Check for API key
    const apiKey = process.env.API_KEY_GROK;
    if (!apiKey) {
      console.error('❌ API_KEY_GROK not configured in environment');
      return res.status(500).json({ 
        error: 'AI service not configured',
        message: 'API key missing from environment'
      });
    }

    console.log('🤖 Beautifying prediction with GROK AI...');
    console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');
    console.log('📝 Original prediction:', prediction);
    console.log('⏱️  Timeframe:', timeframe);

    // Map timeframe values to readable format
    const timeframeMap = {
      '6': '6 hours',
      '12': '12 hours',
      '18': '18 hours',
      '24': '24 hours',
      '3d': '3 days',
      '7d': '7 days'
    };

    const readableTimeframe = timeframeMap[timeframe] || timeframe;

    // Call GROK AI API (x.ai)
    let grokResponse;
    try {
      grokResponse = await axios.post(
        'https://api.x.ai/v1/chat/completions',
        {
          messages: [
            {
              role: 'system',
              content: `You are an assistant. Your purpose is to fix grammar and format prediction statements for a Polymarket-style site. For example, if someone's prediction is 'solana above 150$', you will rephrase it as 'Solana WILL reach or go above $150 in the next ${readableTimeframe}' based on the provided parameters. If the prediction is about followers, such as 'Elon 9999999 followers', and the selected parameter is ${readableTimeframe}, you will write 'Elon WILL reach 9,999,999 followers in the next ${readableTimeframe}'. Always capitalize the words WILL and WILL NOT, and ensure each formatted statement is between 40 and 240 characters long. Only return the formatted prediction, nothing else.`
            },
            {
              role: 'user',
              content: `Format this prediction for the timeframe "${readableTimeframe}": ${prediction}`
            }
          ],
          model: 'grok-2-1212',
          stream: false,
          temperature: 0
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 15000, // 15 second timeout
          validateStatus: function (status) {
            return status < 500; // Accept any status code below 500
          }
        }
      );
    } catch (axiosError) {
      console.error('❌ Axios Error Details:');
      console.error('Status:', axiosError.response?.status);
      console.error('Status Text:', axiosError.response?.statusText);
      console.error('Data:', JSON.stringify(axiosError.response?.data, null, 2));
      console.error('Headers:', axiosError.response?.headers);
      throw axiosError;
    }

    console.log('📦 GROK Response Status:', grokResponse.status);
    console.log('📦 GROK Response Data:', JSON.stringify(grokResponse.data, null, 2));

    // Validate response structure
    if (!grokResponse.data || !grokResponse.data.choices || !grokResponse.data.choices[0]) {
      console.error('❌ Invalid GROK response structure:', grokResponse.data);
      throw new Error('Invalid response from AI service');
    }

    const beautifiedPrediction = grokResponse.data.choices[0].message.content.trim();

    console.log('✅ Beautified:', beautifiedPrediction);

    return res.status(200).json({
      success: true,
      original: prediction,
      beautified: beautifiedPrediction,
      timeframe: readableTimeframe
    });

  } catch (error) {
    console.error('❌ GROK AI Error:', error.message);
    
    // Detailed error logging
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    // Handle specific errors
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'AI service timeout',
        message: 'Request took too long'
      });
    }

    if (error.response?.status === 401) {
      return res.status(500).json({
        error: 'AI authentication failed',
        message: 'Invalid API key'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'AI rate limit exceeded',
        message: 'Too many requests to AI service'
      });
    }

    return res.status(500).json({
      error: 'Failed to beautify prediction',
      message: error.response?.data?.error?.message || error.message
    });
  }
};
