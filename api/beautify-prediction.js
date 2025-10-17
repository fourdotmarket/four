// API Endpoint: Beautify Prediction using GROK AI
import axios from 'axios';

export default async function handler(req, res) {
  // Enable CORS
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
    const { prediction, timeframe } = req.body;

    if (!prediction) {
      return res.status(400).json({ error: 'Prediction text is required' });
    }

    if (!timeframe) {
      return res.status(400).json({ error: 'Timeframe is required' });
    }

    console.log('🤖 Beautifying prediction with GROK AI...');
    console.log('Original:', prediction);
    console.log('Timeframe:', timeframe);

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

    // Call GROK AI API
    const grokResponse = await axios.post(
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
        model: 'grok-beta',
        stream: false,
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_KEY_GROK}`
        }
      }
    );

    const beautifiedPrediction = grokResponse.data.choices[0].message.content.trim();

    console.log('✅ Beautified:', beautifiedPrediction);

    return res.status(200).json({
      success: true,
      original: prediction,
      beautified: beautifiedPrediction,
      timeframe: readableTimeframe
    });

  } catch (error) {
    console.error('❌ GROK AI Error:', error.response?.data || error.message);
    
    return res.status(500).json({
      error: 'Failed to beautify prediction',
      details: error.response?.data?.error?.message || error.message
    });
  }
}

