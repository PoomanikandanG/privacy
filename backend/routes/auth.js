/**
 * Authentication Routes
 * 
 * Handles student login and anonymous session token generation.
 * 
 * SECURITY DESIGN:
 * - Login validates against the student roster
 * - hasVoted flag is checked and flipped BEFORE returning a token
 * - This prevents race conditions where a student could get multiple tokens
 * - Tokens are single-use and expire after 5 minutes
 * - Tokens are stored in-memory (reset on server restart)
 * - No passwords - authentication is based on roster membership only
 * 
 * The token system provides a layer of separation between the student identity
 * and their vote. Even if the token store is leaked, it only contains random
 * tokens with no student information.
 */

import express from 'express';
import crypto from 'crypto';
import { findStudent, markAsVoted } from '../data/students.js';

const router = express.Router();

// In-memory token store with expiry timestamps
// Map: token -> expiry timestamp (milliseconds since epoch)
const tokenStore = new Map();

// Token expiry time: 5 minutes
const TOKEN_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Clean up expired tokens
 * Called periodically to prevent memory leaks
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [token, expiry] of tokenStore.entries()) {
    if (expiry < now) {
      tokenStore.delete(token);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired tokens`);
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredTokens, 60 * 1000);

/**
 * POST /api/auth/login
 * 
 * Authenticates a student and returns an anonymous session token.
 * 
 * Body: { name: string, usn: string }
 * 
 * Flow:
 * 1. Validate request body
 * 2. Find student in roster (case-insensitive)
 * 3. Check if student has already voted
 * 4. If valid: mark as voted (BEFORE generating token), generate token, store with expiry
 * 5. Return { token }
 * 
 * Errors:
 * - 400: Missing or invalid request body
 * - 404: Student not found in roster
 * - 403: Student has already voted
 */
router.post('/login', (req, res) => {
  const { name, usn } = req.body;

  // Validate request body
  if (!name || !usn) {
    return res.status(400).json({ 
      error: 'Missing required fields: name and usn' 
    });
  }

  if (typeof name !== 'string' || typeof usn !== 'string') {
    return res.status(400).json({ 
      error: 'name and usn must be strings' 
    });
  }

  // Find student in roster
  const student = findStudent(name, usn);
  
  if (!student) {
    return res.status(404).json({ 
      error: 'Student not found in roster' 
    });
  }

  // Check if already voted
  if (student.hasVoted) {
    return res.status(403).json({ 
      error: 'Student has already voted' 
    });
  }

  // Mark as voted BEFORE generating token
  // This prevents race conditions where a student could request multiple tokens
  const marked = markAsVoted(name, usn);
  
  if (!marked) {
    // This should never happen if the checks above pass, but handle defensively
    return res.status(403).json({ 
      error: 'Failed to mark student as voted' 
    });
  }

  // Generate random anonymous token
  // 32 bytes = 256 bits of entropy, more than enough for security
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store token with expiry
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  tokenStore.set(token, expiry);

  console.log(`✓ Login: ${name} (${usn}) - Token issued`);

  // Broadcast that this student has voted/checked-in to dashboard
  if (io) {
    io.emit('student_voted', { name: student.name });
  }

  return res.json({ 
    token 
  });
});

/**
 * Validate a token (internal helper function)
 * Used by the vote route to verify tokens before accepting votes
 * 
 * @param {string} token - The token to validate
 * @returns {boolean} True if token is valid and not expired
 */
export function validateToken(token) {
  const expiry = tokenStore.get(token);
  
  if (!expiry) {
    return false; // Token not found
  }

  if (expiry < Date.now()) {
    tokenStore.delete(token); // Clean up expired token
    return false; // Token expired
  }

  return true; // Token is valid
}

/**
 * Consume a token (internal helper function)
 * Deletes the token from the store after use (single-use)
 * 
 * @param {string} token - The token to consume
 * @returns {boolean} True if token was valid and consumed
 */
export function consumeToken(token) {
  const isValid = validateToken(token);
  
  if (isValid) {
    tokenStore.delete(token);
    return true;
  }
  
  return false;
}

/**
 * Get token store stats (for debugging)
 * @returns {Object} Stats about the token store
 */
export function getTokenStats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;
  
  for (const expiry of tokenStore.values()) {
    if (expiry < now) {
      expired++;
    } else {
      active++;
    }
  }
  
  return {
    total: tokenStore.size,
    active,
    expired
  };
}

let io = null;

/**
 * Set the Socket.IO instance (called by server.js)
 * @param {Object} socketIo - Socket.IO server instance
 */
export function setSocketIo(socketIo) {
  io = socketIo;
}

export default router;
