/**
 * Student Roster Data Module
 * 
 * This module manages the student roster loaded from environment variables.
 * The roster is loaded once at startup and stored in memory.
 * 
 * CRITICAL PRIVACY DESIGN: The student roster and vote store are COMPLETELY SEPARATE.
 * - Students table: stores name, USN, and hasVoted flag
 * - Votes table: stores ONLY encrypted ciphertexts (no names, IDs, or timestamps)
 * - No foreign keys, no shared identifiers, no links between tables
 * This separation ensures that even if the server is compromised, votes cannot be traced to students.
 */

import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// In-memory student roster
let roster = [];

/**
 * Initialize the student roster from environment variable
 * Called once at server startup
 */
export function initializeRoster() {
  const rosterEnv = process.env.STUDENT_ROSTER;
  
  if (!rosterEnv) {
    console.error('ERROR: STUDENT_ROSTER environment variable is missing');
    console.error('Please set STUDENT_ROSTER in .env as a JSON array string');
    console.error('Example: STUDENT_ROSTER=[{"name":"Alice","usn":"1MS21CS001"}]');
    process.exit(1);
  }

  try {
    const parsedRoster = JSON.parse(rosterEnv);
    
    if (!Array.isArray(parsedRoster) || parsedRoster.length === 0) {
      throw new Error('STUDENT_ROSTER must be a non-empty array');
    }

    // Build roster with hasVoted flag initialized to false
    // hasVoted is NOT stored in the env - it's reset on each server restart
    // This ensures students can vote again if the server restarts (for demo purposes)
    roster = parsedRoster.map(student => ({
      name: student.name,
      usn: student.usn,
      hasVoted: false
    }));

    console.log(`✓ Student roster loaded: ${roster.length} students`);
  } catch (error) {
    console.error('ERROR: Failed to parse STUDENT_ROSTER');
    console.error('Make sure STUDENT_ROSTER is valid JSON');
    console.error(`Parse error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Find a student by name and USN
 * Case-insensitive and trimmed matching for user convenience
 * 
 * @param {string} name - Student name (case-insensitive)
 * @param {string} usn - Student USN (case-insensitive)
 * @returns {Object|null} Student object or null if not found
 */
export function findStudent(name, usn) {
  const normalizedName = name.trim().toLowerCase();
  const normalizedUsn = usn.trim().toLowerCase();

  return roster.find(student => 
    student.name.trim().toLowerCase() === normalizedName &&
    student.usn.trim().toLowerCase() === normalizedUsn
  ) || null;
}

/**
 * Mark a student as having voted
 * This is called BEFORE the vote is cast to prevent double-voting
 * 
 * CRITICAL: hasVoted is flipped BEFORE voting, not after.
 * This prevents race conditions where a student could submit multiple votes
 * in rapid succession before the first one is recorded.
 * 
 * @param {string} name - Student name
 * @param {string} usn - Student USN
 * @returns {boolean} True if successfully marked, false if already voted or not found
 */
export function markAsVoted(name, usn) {
  const student = findStudent(name, usn);
  
  if (!student) {
    return false;
  }

  if (student.hasVoted) {
    return false;
  }

  student.hasVoted = true;
  return true;
}

/**
 * Get the current roster (for debugging/admin purposes)
 * @returns {Array} Current roster state
 */
export function getRoster() {
  return [...roster];
}

/**
 * Get count of students who have voted
 * @returns {number} Number of students with hasVoted = true
 */
export function getVotedCount() {
  return roster.filter(s => s.hasVoted).length;
}

/**
 * Reset all hasVoted flags (for demo/testing purposes)
 * In production, this would be disabled or require admin authentication
 */
export function resetVotes() {
  roster.forEach(student => {
    student.hasVoted = false;
  });
  console.log('⚠ All hasVoted flags reset');
}
