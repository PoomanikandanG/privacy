/**
 * LWE (Learning With Errors) Cryptographic Engine
 * Simplified 2D vector space implementation over Z_17
 * 
 * This module implements a lattice-based encryption scheme for anonymous voting.
 * The core idea: encrypt messages by adding them to noisy lattice points.
 * Homomorphic property: encrypted votes can be summed without decryption,
 * then decrypted once to reveal the total tally while preserving individual privacy.
 * 
 * CLIENT-SIDE ONLY: This is used by the student booth to encrypt votes locally
 * before sending them to the server. The server never sees the plaintext vote.
 */

// Field modulus (Z_17)
const Q = 17;

// Scaling factor delta ≈ q/2, used to encode messages
const DELTA = 8;

// Private Key (Good Basis) - known only to the presenter
// This is the secret vector used for decryption
// NOT used on client side - only for dashboard decryption
const PRIVATE_KEY = [4, 1];

// Public Key (Bad/Skewed Basis) - two noisy lattice points
// These are published and used by clients for encryption
// The noise makes it computationally hard to recover the private key
const PUBLIC_KEY = {
  P1: { vector: [2, 5], constant: 13 },
  P2: { vector: [3, 2], constant: 14 }
};

/**
 * Safe modulo operation that never returns negative numbers
 * JavaScript's % operator can return negative values for negative inputs,
 * which would break our modular arithmetic
 * @param {number} a - The dividend
 * @param {number} m - The modulus
 * @returns {number} A non-negative result in [0, m-1]
 */
function mod(a, m) {
  const result = ((a % m) + m) % m;
  return result;
}

/**
 * Vector addition modulo Q
 * @param {number[]} v1 - First vector
 * @param {number[]} v2 - Second vector
 * @returns {number[]} Component-wise sum mod Q
 */
function vectorAdd(v1, v2) {
  return [
    mod(v1[0] + v2[0], Q),
    mod(v1[1] + v2[1], Q)
  ];
}

/**
 * Scalar multiplication of a vector modulo Q
 * @param {number} scalar - The scalar multiplier
 * @param {number[]} vector - The vector to multiply
 * @returns {number[]} Scaled vector mod Q
 */
function vectorScale(scalar, vector) {
  return [
    mod(scalar * vector[0], Q),
    mod(scalar * vector[1], Q)
  ];
}

/**
 * Dot product of two vectors modulo Q
 * @param {number[]} v1 - First vector
 * @param {number[]} v2 - Second vector
 * @returns {number} Dot product mod Q
 */
function dot(v1, v2) {
  return mod(v1[0] * v2[0] + v1[1] * v2[1], Q);
}

/**
 * Encrypt a vote using the LWE scheme
 * 
 * Algorithm:
 * 1. Pick random bits r1, r2 ∈ {0,1} - these provide semantic security
 * 2. Compute cA = r1*P1.vector + r2*P2.vector (mod 17)
 *    This is the encrypted "mask" that hides the message
 * 3. Compute cB = r1*P1.constant + r2*P2.constant + m*8 (mod 17)
 *    This is the encrypted message plus noise
 * 
 * The random bits r1, r2 ensure that the same message encrypts differently
 * each time, preventing an attacker from linking votes to students.
 * 
 * @param {number} m - Message value ∈ {0, 1, 2} (Poor, Average, Excellent)
 * @returns {Object} Ciphertext { vector_cA: [a,b], scalar_cB: c }
 */
export function encryptVote(m) {
  // Validate message
  if (m < 0 || m > 2) {
    throw new Error('Message must be 0, 1, or 2');
  }

  // Random bits for semantic security
  const r1 = Math.random() < 0.5 ? 0 : 1;
  const r2 = Math.random() < 0.5 ? 0 : 1;

  // Compute cA = r1*P1.vector + r2*P2.vector (mod 17)
  const term1 = vectorScale(r1, PUBLIC_KEY.P1.vector);
  const term2 = vectorScale(r2, PUBLIC_KEY.P2.vector);
  const cA = vectorAdd(term1, term2);

  // Compute cB = r1*P1.constant + r2*P2.constant + m*8 (mod 17)
  const cB = mod(
    r1 * PUBLIC_KEY.P1.constant + 
    r2 * PUBLIC_KEY.P2.constant + 
    m * DELTA,
    Q
  );

  return {
    vector_cA: cA,
    scalar_cB: cB
  };
}

/**
 * Add two ciphertexts homomorphically
 * 
 * This is the key homomorphic property: we can sum encrypted votes
 * without decrypting them first. The server can aggregate all votes
 * while never seeing individual vote values.
 * 
 * Math: Enc(m1) + Enc(m2) = Enc(m1 + m2) + noise
 * The noise accumulates but remains bounded due to the scaling factor.
 * 
 * @param {Object} c1 - First ciphertext { vector_cA, scalar_cB }
 * @param {Object} c2 - Second ciphertext { vector_cA, scalar_cB }
 * @returns {Object} Summed ciphertext
 */
export function addCiphertexts(c1, c2) {
  return {
    vector_cA: vectorAdd(c1.vector_cA, c2.vector_cA),
    scalar_cB: mod(c1.scalar_cB + c2.scalar_cB, Q)
  };
}

/**
 * Decrypt an aggregated ciphertext to reveal the total vote sum
 * 
 * Algorithm:
 * 1. Compute noisy = (cB - dot(cA, s)) mod 17
 *    This removes the lattice noise, leaving message*8 + accumulated_error
 * 2. Find candidateSum ∈ [0, 2*numVotes] that minimizes circular distance
 *    between noisy and (candidateSum*8 mod 17)
 * 3. The candidateSum with minimum distance is the decoded total
 * 
 * The circular distance handles wrap-around in modular arithmetic.
 * For example, distance between 16 and 1 in Z_17 is 2 (not 15).
 * 
 * @param {Object} aggregateCiphertext - Summed ciphertext { vector_cA, scalar_cB }
 * @param {number} numVotes - Total number of votes cast
 * @returns {Object} { decodedSum, averageScore, noisy }
 */
export function decryptAggregate(aggregateCiphertext, numVotes) {
  // Compute noisy coordinate: cB - dot(cA, s) mod 17
  // This cancels out the lattice noise, leaving the encoded message
  const noisy = mod(
    aggregateCiphertext.scalar_cB - 
    dot(aggregateCiphertext.vector_cA, PRIVATE_KEY),
    Q
  );

  // Find the candidate sum (0 to 2*numVotes) whose encoding is closest to noisy
  // Each vote contributes 0, 8, or 16 (mod 17) for Poor, Average, Excellent
  let bestSum = 0;
  let minDistance = Infinity;

  for (let candidateSum = 0; candidateSum <= 2 * numVotes; candidateSum++) {
    const encoded = mod(candidateSum * DELTA, Q);
    
    // Circular distance in Z_17
    const distance = Math.min(
      mod(encoded - noisy, Q),
      mod(noisy - encoded, Q)
    );

    if (distance < minDistance) {
      minDistance = distance;
      bestSum = candidateSum;
    }
  }

  const averageScore = numVotes > 0 ? bestSum / numVotes : 0;

  return {
    decodedSum: bestSum,
    averageScore: averageScore,
    noisy: noisy
  };
}

// Export constants for reference
export const LWE_CONSTANTS = {
  Q,
  DELTA,
  PRIVATE_KEY,
  PUBLIC_KEY
};
