// API Endpoint: AI Market Analysis - DISABLED
// This endpoint has been disabled

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Return disabled message
  return res.status(200).json({ 
    skipped: true,
    message: 'AI analysis has been disabled'
  });
};
