/**
 * Vote Routes
 * 
 * Handles encrypted vote submission and retrieval.
 * 
 * PRIVACY DESIGN:
 * - Votes are submitted as encrypted ciphertexts only
 * - Server never sees the actual vote value (0, 1, or 2)
 * - Server only stores: { vector_cA: [a,b], scalar_cB: c }
 * - No student information is linked to votes
 * - Tokens are single-use and consumed immediately
 * - Socket.IO broadcasts new votes in real-time (for dashboard)
 * 
 * The vote submission flow:
 * 1. Client encrypts vote locally using LWE scheme
 * 2. Client sends ciphertext + token to server
 * 3. Server validates token (single-use, expires in 5 min)
 * 4. Server consumes token (deletes it)
 * 5. Server stores ciphertext in votes table
 * 6. Server broadcasts new ciphertext via Socket.IO
 * 
 * At no point does the server know which student cast which vote.
 */

import express from 'express';
import { addEncryptedVote, getAllVotes, getVoteCount, clearVotes } from '../data/votes.js';
import { consumeToken } from './auth.js';
import { getRoster, resetVotes } from '../data/students.js';

const router = express.Router();

// Socket.IO instance will be set by server.js
let io = null;

/**
 * Set the Socket.IO instance (called by server.js)
 * @param {Object} socketIo - Socket.IO server instance
 */
export function setSocketIo(socketIo) {
  io = socketIo;
}

/**
 * POST /api/vote/submit
 * 
 * Accepts an encrypted vote from a student.
 * 
 * Body: { token: string, vector_cA: [number, number], scalar_cB: number }
 * 
 * Flow:
 * 1. Validate request body structure
 * 2. Validate token exists and is not expired
 * 3. Consume token (delete it - single-use)
 * 4. Store the encrypted ciphertext
 * 5. Broadcast new vote via Socket.IO
 * 6. Return success
 * 
 * Errors:
 * - 400: Malformed request body
 * - 401: Invalid or expired token
 */
router.post('/submit', (req, res) => {
  const { token, vector_cA, scalar_cB } = req.body;

  // Validate request body
  if (!token || !vector_cA || scalar_cB === undefined) {
    return res.status(400).json({ 
      error: 'Missing required fields: token, vector_cA, scalar_cB' 
    });
  }

  // Validate vector_cA is a 2-element array
  if (!Array.isArray(vector_cA) || vector_cA.length !== 2) {
    return res.status(400).json({ 
      error: 'vector_cA must be a 2-element array' 
    });
  }

  // Validate vector_cA elements are numbers
  if (typeof vector_cA[0] !== 'number' || typeof vector_cA[1] !== 'number') {
    return res.status(400).json({ 
      error: 'vector_cA elements must be numbers' 
    });
  }

  // Validate scalar_cB is a number
  if (typeof scalar_cB !== 'number') {
    return res.status(400).json({ 
      error: 'scalar_cB must be a number' 
    });
  }

  // Validate token
  if (!consumeToken(token)) {
    return res.status(401).json({ 
      error: 'Invalid or expired token' 
    });
  }

  // Store the encrypted vote
  const added = addEncryptedVote({ vector_cA, scalar_cB });
  
  if (!added) {
    return res.status(500).json({ 
      error: 'Failed to store vote' 
    });
  }

  // Broadcast new vote via Socket.IO
  // This allows the dashboard to update in real-time
  if (io) {
    io.emit('new_vote', {
      vector_cA,
      scalar_cB,
      totalVotes: getVoteCount()
    });
  }

  console.log(`✓ Vote submitted (total: ${getVoteCount()})`);

  return res.json({ 
    success: true 
  });
});

/**
 * GET /api/vote/all
 * 
 * Returns all encrypted votes for the dashboard to aggregate.
 * 
 * Returns: { votes: [...], totalVotes: number }
 * 
 * The dashboard will:
 * 1. Fetch all votes
 * 2. Sum them homomorphically using addCiphertexts
 * 3. Decrypt the aggregate using the private key
 * 4. Display the average score
 * 
 * This endpoint is public because the votes are already encrypted.
 * Knowing all ciphertexts doesn't reveal individual votes without the private key.
 */
router.get('/all', (req, res) => {
  const votes = getAllVotes();
  const totalVotes = getVoteCount();

  return res.json({ 
    votes,
    totalVotes 
  });
});

// GET /api/vote/roster-status
// Returns the list of all students with their hasVoted status
router.get('/roster-status', (req, res) => {
  try {
    const roster = getRoster();
    const studentsStatus = roster.map(student => ({
      name: student.name,
      usn: student.usn,
      hasVoted: student.hasVoted
    }));
    return res.json({ students: studentsStatus });
  } catch (error) {
    console.error('Failed to get roster status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/vote/voted-students
// Returns a list of names of students who have voted
router.get('/voted-students', (req, res) => {
  try {
    const roster = getRoster();
    const votedStudents = roster
      .filter(student => student.hasVoted)
      .map(student => student.name);
    return res.json({ votedStudents });
  } catch (error) {
    console.error('Failed to get voted students:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/vote/reset
// Resets the evaluation: clears all votes and resets roster hasVoted flags
router.post('/reset', (req, res) => {
  try {
    clearVotes();
    resetVotes();

    // Broadcast reset event via Socket.IO
    if (io) {
      io.emit('votes_reset');
    }

    console.log('⚠ Evaluation reset successfully');
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to reset evaluation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
