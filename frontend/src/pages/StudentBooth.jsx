/**
 * Student Booth Component
 * 
 * Mobile-responsive, dark-themed voting interface for students.
 * Features:
 * - 3-stage flow: login → rate → done
 * - Stage 1 (login): Name + USN form with validation
 * - Stage 2 (rate): 3 tappable cards for Poor/Average/Excellent
 * - Stage 3 (done): Confirmation with ciphertext display
 * 
 * Privacy Features:
 * - Vote is encrypted locally in the browser
 * - Only encrypted ciphertext is sent to server
 * - Server cannot link vote to student identity
 * - Confirmation shows the ciphertext (proving it's unreadable)
 */

import { useState } from 'react';
import axios from 'axios';
import { encryptVote } from '../crypto/lwe.js';

function StudentBooth() {
  const [stage, setStage] = useState('login'); // 'login', 'rate', 'done'
  const [name, setName] = useState('');
  const [usn, setUsn] = useState('');
  const [token, setToken] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCiphertext, setSubmittedCiphertext] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await axios.post('/api/auth/login', { name, usn });
      setToken(response.data.token);
      setStage('rate');
    } catch (error) {
      if (error.response?.status === 404) {
        setError('Student not found in roster');
      } else if (error.response?.status === 403) {
        setError('You have already voted');
      } else {
        setError('Login failed. Please try again.');
      }
    }

    setIsSubmitting(false);
  };

  const handleVote = async (rating) => {
    setError('');
    setIsSubmitting(true);

    try {
      // Encrypt vote locally using LWE scheme
      const ciphertext = encryptVote(rating);

      // Submit encrypted vote to server
      const response = await axios.post('/api/vote/submit', {
        token,
        vector_cA: ciphertext.vector_cA,
        scalar_cB: ciphertext.scalar_cB
      });

      if (response.data.success) {
        setSubmittedCiphertext(ciphertext);
        setStage('done');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        setError('Session expired. Please login again.');
        setStage('login');
      } else {
        setError('Failed to submit vote. Please try again.');
      }
    }

    setIsSubmitting(false);
  };

  const formatCiphertext = (c) => {
    return `cA:[${c.vector_cA.join(',')}] cB:${c.scalar_cB}`;
  };

  // Login Stage
  if (stage === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Teacher Evaluation</h1>
              <p className="text-slate-400">Anonymous Voting</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  USN
                </label>
                <input
                  type="text"
                  value={usn}
                  onChange={(e) => setUsn(e.target.value)}
                  placeholder="Enter your USN"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  required
                />
              </div>

              {error && (
                <div className="bg-rose-900/30 border border-rose-700 rounded-xl px-4 py-3 text-rose-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200"
              >
                {isSubmitting ? 'Verifying...' : 'Continue to Vote'}
              </button>
            </form>

            <div className="mt-6 text-center text-slate-500 text-xs">
              <p>Your vote will be encrypted before transmission</p>
              <p className="mt-1">Cannot be traced back to you</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rate Stage
  if (stage === 'rate') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Rate the Teacher</h1>
              <p className="text-slate-400">Select your rating</p>
            </div>

            <div className="space-y-4">
              {/* Poor */}
              <button
                onClick={() => handleVote(0)}
                disabled={isSubmitting}
                className="w-full bg-slate-800 hover:bg-rose-900/30 border-2 border-slate-700 hover:border-rose-500 rounded-2xl p-6 transition-all duration-200 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center justify-center space-x-4">
                  <span className="text-4xl">😞</span>
                  <div className="text-left">
                    <div className="text-xl font-bold text-white group-hover:text-rose-400">Poor</div>
                    <div className="text-slate-400 text-sm">Needs improvement</div>
                  </div>
                </div>
              </button>

              {/* Average */}
              <button
                onClick={() => handleVote(1)}
                disabled={isSubmitting}
                className="w-full bg-slate-800 hover:bg-amber-900/30 border-2 border-slate-700 hover:border-amber-500 rounded-2xl p-6 transition-all duration-200 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center justify-center space-x-4">
                  <span className="text-4xl">😐</span>
                  <div className="text-left">
                    <div className="text-xl font-bold text-white group-hover:text-amber-400">Average</div>
                    <div className="text-slate-400 text-sm">Meets expectations</div>
                  </div>
                </div>
              </button>

              {/* Excellent */}
              <button
                onClick={() => handleVote(2)}
                disabled={isSubmitting}
                className="w-full bg-slate-800 hover:bg-emerald-900/30 border-2 border-slate-700 hover:border-emerald-500 rounded-2xl p-6 transition-all duration-200 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center justify-center space-x-4">
                  <span className="text-4xl">😊</span>
                  <div className="text-left">
                    <div className="text-xl font-bold text-white group-hover:text-emerald-400">Excellent</div>
                    <div className="text-slate-400 text-sm">Exceeds expectations</div>
                  </div>
                </div>
              </button>
            </div>

            {error && (
              <div className="mt-6 bg-rose-900/30 border border-rose-700 rounded-xl px-4 py-3 text-rose-400 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Done Stage
  if (stage === 'done') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🔒</div>
              <h1 className="text-3xl font-bold text-white mb-2">Vote Cast Privately</h1>
              <p className="text-slate-400">Your vote has been encrypted and submitted</p>
            </div>

            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
              <div className="text-slate-400 text-sm mb-3 text-center">
                Encrypted Ciphertext (Unreadable)
              </div>
              <div className="font-mono text-xs text-indigo-400 text-center break-all">
                {submittedCiphertext && formatCiphertext(submittedCiphertext)}
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-400">
              <div className="flex items-start space-x-3">
                <span className="text-emerald-400">✓</span>
                <p>Vote encrypted on your device before transmission</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-emerald-400">✓</span>
                <p>Server cannot decrypt individual votes</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-emerald-400">✓</span>
                <p>Vote cannot be traced back to you</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-emerald-400">✓</span>
                <p>Only aggregate tally will be revealed</p>
              </div>
            </div>

            <button
              onClick={() => {
                setStage('login');
                setName('');
                setUsn('');
                setToken(null);
                setSubmittedCiphertext(null);
                setError('');
              }}
              className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default StudentBooth;
