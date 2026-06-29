/**
 * Presenter Dashboard Component
 * 
 * Desktop-optimized, dark-themed dashboard for the teacher/presenter.
 * Features:
 * - 3-column grid layout
 * - Left: QR code for students to scan + live vote counter
 * - Middle: Live stream of incoming encrypted ciphertexts & student check-in status
 * - Right: Decrypt button to reveal aggregate tally
 */

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import socket from '../lib/socket.js';
import axios from 'axios';
import { addCiphertexts, decryptAggregate } from '../crypto/lwe.js';

function PresenterDashboard() {
  const [votes, setVotes] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [decryptionResult, setDecryptionResult] = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [lanIp, setLanIp] = useState('localhost');
  const [roster, setRoster] = useState([]);
  const [activeTab, setActiveTab] = useState('stream'); // 'stream' or 'roster'
  const [confirmReset, setConfirmReset] = useState(false);

  // Get current URL for QR code - if loaded from an external domain or custom IP, use that instead
  const getVoteUrl = () => {
    const host = window.location.host;
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
      return `http://${lanIp}:3000/vote`;
    }
    return `${window.location.protocol}//${host}/vote`;
  };

  const voteUrl = getVoteUrl();

  // Fetch initial data on mount
  useEffect(() => {
    fetchVotes();
    fetchLanIp();
    fetchRoster();
  }, []);

  // Listen for real-time Socket.IO events
  useEffect(() => {
    const handleNewVote = (data) => {
      setVotes(prev => [...prev, data]);
      setTotalVotes(data.totalVotes);
    };

    const handleStudentVoted = (data) => {
      setRoster(prev => prev.map(student => {
        if (student.name.toLowerCase() === data.name.toLowerCase()) {
          return { ...student, hasVoted: true };
        }
        return student;
      }));
    };

    const handleVotesReset = () => {
      setVotes([]);
      setTotalVotes(0);
      setDecryptionResult(null);
      setRoster(prev => prev.map(student => ({ ...student, hasVoted: false })));
    };

    socket.on('new_vote', handleNewVote);
    socket.on('student_voted', handleStudentVoted);
    socket.on('votes_reset', handleVotesReset);

    return () => {
      socket.off('new_vote', handleNewVote);
      socket.off('student_voted', handleStudentVoted);
      socket.off('votes_reset', handleVotesReset);
    };
  }, []);

  const fetchVotes = async () => {
    try {
      const response = await axios.get('/api/vote/all');
      setVotes(response.data.votes);
      setTotalVotes(response.data.totalVotes);
    } catch (error) {
      console.error('Failed to fetch votes:', error);
    }
  };

  const fetchLanIp = async () => {
    try {
      const response = await axios.get('/api/health');
      if (response.data && response.data.localIp) {
        setLanIp(response.data.localIp);
      }
    } catch (error) {
      console.error('Failed to fetch LAN IP:', error);
      const hostname = window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        setLanIp(hostname);
      }
    }
  };

  const fetchRoster = async () => {
    try {
      const response = await axios.get('/api/vote/roster-status');
      if (response.data && response.data.students) {
        setRoster(response.data.students);
      }
    } catch (error) {
      console.error('Failed to fetch roster status:', error);
    }
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000); // Reset confirmation state after 3s
      return;
    }

    try {
      await axios.post('/api/vote/reset');
      setConfirmReset(false);
      setDecryptionResult(null);
    } catch (error) {
      console.error('Failed to reset evaluation:', error);
    }
  };

  const handleDecrypt = async () => {
    setIsDecrypting(true);
    setDecryptionResult(null);

    try {
      const response = await axios.get('/api/vote/all');
      const allVotes = response.data.votes;
      const voteCount = response.data.totalVotes;

      if (voteCount === 0) {
        setDecryptionResult({ error: 'No votes to decrypt' });
        setIsDecrypting(false);
        return;
      }

      let aggregate = {
        vector_cA: [0, 0],
        scalar_cB: 0
      };

      for (const vote of allVotes) {
        aggregate = addCiphertexts(aggregate, vote);
      }

      const result = decryptAggregate(aggregate, voteCount);
      setDecryptionResult(result);

    } catch (error) {
      console.error('Decryption failed:', error);
      setDecryptionResult({ error: 'Decryption failed' });
    }

    setIsDecrypting(false);
  };

  const formatCiphertext = (vote) => {
    return `cA:[${vote.vector_cA.join(',')}] cB:${vote.scalar_cB}`;
  };

  const getScoreLabel = (avg) => {
    if (avg < 0.5) return 'Poor';
    if (avg < 1.5) return 'Average';
    return 'Excellent';
  };

  const getScoreColor = (avg) => {
    if (avg < 0.5) return 'text-rose-400';
    if (avg < 1.5) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const votedCount = roster.filter(s => s.hasVoted).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div className="mb-4 sm:mb-0 text-left">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent mb-2">
              Confidential Teacher Evaluation
            </h1>
            <p className="text-slate-400">Live Results Dashboard</p>
          </div>
          <div>
            <button
              onClick={handleReset}
              className={`font-semibold py-2.5 px-5 rounded-xl transition-all duration-200 text-sm flex items-center space-x-2 border shadow-lg ${
                confirmReset
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 animate-pulse'
                  : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/85'
              }`}
            >
              <span>{confirmReset ? '⚠' : '🔄'}</span>
              <span>{confirmReset ? 'Confirm Reset?' : 'Reset Evaluation'}</span>
            </button>
          </div>
        </div>

        {/* 3-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: QR Code */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-4 text-emerald-400">Scan to Vote</h2>
              
              <div className="mb-4">
                <label className="block text-slate-400 text-sm mb-2">Your LAN IP (for mobile access)</label>
                <input
                  type="text"
                  value={lanIp}
                  onChange={(e) => setLanIp(e.target.value)}
                  placeholder="e.g., 192.168.1.5"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-slate-500 text-xs mt-1">
                  Find your IP: Run <code className="bg-slate-800 px-1 rounded">ipconfig</code> (Windows) or <code className="bg-slate-800 px-1 rounded">ifconfig</code> (Mac/Linux)
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 flex justify-center mb-4">
                <QRCodeSVG value={voteUrl} size={200} />
              </div>
              
              <div className="text-center mb-4">
                <p className="text-slate-400 text-xs break-all select-all font-mono bg-slate-950 p-2 rounded-lg border border-slate-800">
                  {voteUrl}
                </p>
              </div>
            </div>

            <div className="text-center pt-4 border-t border-slate-800">
              <div className="text-5xl font-bold text-emerald-400 mb-2">{totalVotes}</div>
              <div className="text-slate-400 text-sm">Total Votes Cast</div>
            </div>
          </div>

          {/* Middle Column: Live Vote Stream & Voter Roster */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex flex-col h-[520px]">
            <div className="flex border-b border-slate-800 mb-4 pb-2 justify-between items-center">
              <div className="flex space-x-4">
                <button
                  onClick={() => setActiveTab('stream')}
                  className={`text-lg font-semibold pb-1 transition-all ${
                    activeTab === 'stream'
                      ? 'text-indigo-400 border-b-2 border-indigo-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Encrypted Stream
                </button>
                <button
                  onClick={() => setActiveTab('roster')}
                  className={`text-lg font-semibold pb-1 transition-all ${
                    activeTab === 'roster'
                      ? 'text-indigo-400 border-b-2 border-indigo-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Voter Roster
                </button>
              </div>
              <span className="bg-slate-850 text-xs px-2.5 py-1 rounded-full text-slate-300 border border-slate-800 font-mono">
                {votedCount}/{roster.length} Voted
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {activeTab === 'stream' ? (
                votes.length === 0 ? (
                  <div className="text-slate-500 text-center py-8">
                    No votes received yet
                  </div>
                ) : (
                  votes.map((vote, index) => (
                    <div 
                      key={index}
                      className="bg-slate-800 rounded-lg px-4 py-2 font-mono text-sm text-slate-300 border border-slate-700"
                    >
                      {formatCiphertext(vote)}
                    </div>
                  ))
                )
              ) : (
                roster.length === 0 ? (
                  <div className="text-slate-500 text-center py-8">
                    Loading student roster...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {roster.map((student, idx) => (
                      <div 
                        key={idx} 
                        className="bg-slate-850 rounded-xl p-3 border border-slate-800 flex items-center justify-between transition-all hover:bg-slate-800/80"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${student.hasVoted ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                          <div>
                            <div className="text-sm font-semibold text-slate-200">{student.name}</div>
                            <div className="text-xs text-slate-500 font-mono">{student.usn}</div>
                          </div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          student.hasVoted 
                            ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900' 
                            : 'bg-slate-800 text-slate-500 border border-slate-750'
                        }`}>
                          {student.hasVoted ? 'Voted' : 'Not Voted'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Right Column: Decryption */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-amber-400">Decrypt Aggregate</h2>
            
            <button
              onClick={handleDecrypt}
              disabled={isDecrypting || totalVotes === 0}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 mb-6"
            >
              {isDecrypting ? 'Decrypting...' : '🔑 Decrypt Aggregate Tally'}
            </button>

            {decryptionResult && (
              <div className="space-y-4">
                {decryptionResult.error ? (
                  <div className="bg-rose-900/30 border border-rose-700 rounded-xl p-4 text-rose-400">
                    {decryptionResult.error}
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
                      <div className="text-slate-400 text-sm mb-2">Average Score</div>
                      <div className={`text-6xl font-bold ${getScoreColor(decryptionResult.averageScore)} mb-2`}>
                        {decryptionResult.averageScore.toFixed(2)}
                      </div>
                      <div className={`text-xl font-semibold ${getScoreColor(decryptionResult.averageScore)}`}>
                        {getScoreLabel(decryptionResult.averageScore)}
                      </div>
                    </div>

                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total Votes:</span>
                        <span className="text-white font-mono">{totalVotes}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Decoded Sum:</span>
                        <span className="text-white font-mono">{decryptionResult.decodedSum}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Noisy Coordinate:</span>
                        <span className="text-white font-mono">{decryptionResult.noisy}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>Powered by Lattice-Based Cryptography (LWE)</p>
          <p className="mt-1">All votes are encrypted before transmission and cannot be traced to individual students</p>
        </div>
      </div>
    </div>
  );
}

export default PresenterDashboard;
