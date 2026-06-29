/**
 * Encrypted Votes Data Module
 * 
 * This module stores encrypted votes in memory.
 * 
 * CRITICAL PRIVACY DESIGN: This table contains ONLY encrypted ciphertexts.
 * - No student names
 * - No student IDs (USN)
 * - No timestamps
 * - No IP addresses
 * - No session tokens
 * - No identifiers of any kind
 * 
 * Each entry is just: { vector_cA: [a, b], scalar_cB: c }
 * 
 * The complete separation from the student roster ensures that even with full
 * access to the server database, it's cryptographically impossible to link
 * any vote to any student. This is the core privacy guarantee of the system.
 */

// In-memory vote store - plain array of ciphertexts
// No database, no persistence, no identifiers
const votes = [];

/**
 * Add an encrypted vote to the store
 * 
 * @param {Object} payload - Ciphertext { vector_cA: [a,b], scalar_cB: c }
 * @returns {boolean} True if added successfully
 */
export function addEncryptedVote(payload) {
  // Validate payload structure
  if (!payload || !Array.isArray(payload.vector_cA) || payload.vector_cA.length !== 2) {
    console.error('Invalid vote: vector_cA must be a 2-element array');
    return false;
  }

  if (typeof payload.scalar_cB !== 'number') {
    console.error('Invalid vote: scalar_cB must be a number');
    return false;
  }

  // Store ONLY the ciphertext - no metadata
  votes.push({
    vector_cA: [...payload.vector_cA], // Copy to prevent mutation
    scalar_cB: payload.scalar_cB
  });

  console.log(`✓ Encrypted vote added (total: ${votes.length})`);
  return true;
}

/**
 * Get all encrypted votes
 * 
 * @returns {Array} Array of ciphertexts
 */
export function getAllVotes() {
  // Return a copy to prevent external mutation
  return votes.map(vote => ({
    vector_cA: [...vote.vector_cA],
    scalar_cB: vote.scalar_cB
  }));
}

/**
 * Get the total number of votes cast
 * 
 * @returns {number} Vote count
 */
export function getVoteCount() {
  return votes.length;
}

/**
 * Clear all votes (for demo/testing purposes)
 * In production, this would be disabled or require admin authentication
 */
export function clearVotes() {
  votes.length = 0;
  console.log('⚠ All votes cleared');
}
