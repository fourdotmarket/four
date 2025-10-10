const { createClient } = require('@supabase/supabase-js');
const jose = require('jose');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify JWT token and return authenticated user
 * @param {string} authHeader - Authorization header
 * @returns {Promise<object>} - User object from database
 */
async function verifyAuth(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.substring(7);
  
  // Decode JWT to get app ID
  const decoded = jose.decodeJwt(token);
  const appIdFromToken = decoded.aud;

  // Verify JWT with Privy's public key
  const JWKS = jose.createRemoteJWKSet(
    new URL(`https://auth.privy.io/api/v1/apps/${appIdFromToken}/jwks.json`)
  );

  const { payload } = await jose.jwtVerify(token, JWKS, {
    issuer: 'privy.io',
    audience: appIdFromToken
  });

  const privyUserId = payload.sub;

  // Fetch user from database using privy_user_id
  const { data: user, error } = await supabase
    .from('users')
    .select('user_id, user_order_id, privy_user_id, wallet_address, wallet_private_key, username, email')
    .eq('privy_user_id', privyUserId)
    .single();

  if (error || !user) {
    throw new Error('User not found in database');
  }

  return user;
}

/**
 * Validate and sanitize input to prevent injection attacks
 */
function validateInput(data, schema) {
  const errors = [];
  
  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} is required`);
      continue;
    }
    
    // Skip validation if not required and value is missing
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }
    
    // Type validation
    if (rules.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push(`${key} must be a number`);
        continue;
      }
      
      if (rules.min !== undefined && num < rules.min) {
        errors.push(`${key} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && num > rules.max) {
        errors.push(`${key} must be at most ${rules.max}`);
      }
    }
    
    if (rules.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${key} must be a string`);
        continue;
      }
      
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${key} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${key} must be at most ${rules.maxLength} characters`);
      }
      
      // Pattern validation
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${key} has invalid format`);
      }
    }
  }
  
  return errors;
}

/**
 * Rate limiting using in-memory store (use Redis in production for >1000 users)
 */
const rateLimitStore = new Map();

function checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const userRequests = rateLimitStore.get(identifier) || [];
  
  // Remove old requests outside the window
  const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (validRequests.length >= maxRequests) {
    return {
      allowed: false,
      resetIn: Math.ceil((validRequests[0] + windowMs - now) / 1000)
    };
  }
  
  validRequests.push(now);
  rateLimitStore.set(identifier, validRequests);
  
  // Cleanup old entries periodically
  if (Math.random() < 0.01) { // 1% chance
    cleanupRateLimitStore(now, windowMs);
  }
  
  return { allowed: true };
}

function cleanupRateLimitStore(now, windowMs) {
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, validTimestamps);
    }
  }
}

/**
 * Log security audit events
 */
async function logAudit(auditData) {
  try {
    await supabase.from('audit_logs').insert({
      ...auditData,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

module.exports = {
  verifyAuth,
  validateInput,
  checkRateLimit,
  logAudit
};