/**
 * Main Server Entry Point
 * 
 * Express + Socket.IO server for the Confidential Teacher Evaluation App.
 * 
 * Architecture:
 * - Express handles REST API endpoints (auth, vote)
 * - Socket.IO handles real-time broadcasts of new votes
 * - All data is stored in-memory (students, votes, tokens)
 * - Cryptographic operations happen on the client side
 * - Server only stores and forwards encrypted ciphertexts
 * 
 * Privacy Guarantee:
 * - Server never sees plaintext votes
 * - Server cannot link votes to students
 * - Even with full server access, individual votes remain private
 * - Only the aggregate tally can be decrypted (with private key)
 */

import dotenv from 'dotenv';
import express from 'express';
import os from 'os';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializeRoster } from './data/students.js';
import authRouter, { setSocketIo as setAuthSocketIo } from './routes/auth.js';
import voteRouter, { setSocketIo } from './routes/vote.js';

// Load environment variables FIRST
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 4000;

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Create Socket.IO server with CORS enabled
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for demo purposes
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize student roster from environment variable
// This will exit if STUDENT_ROSTER is missing or invalid
initializeRoster();

// Pass Socket.IO instance to routers for broadcasting
setSocketIo(io);
setAuthSocketIo(io);

// Mount routers
app.use('/api/auth', authRouter);
app.use('/api/vote', voteRouter);

// Get local IPv4 address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      const family = iface.family;
      if ((family === 'IPv4' || family === 4) && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    localIp: getLocalIp()
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Start server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('\n=================================');
  console.log('🚀 Confidential Teacher Evaluation Server');
  console.log('=================================');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`📡 Server accessible on network at http://0.0.0.0:${PORT}`);
  console.log(`🔌 Socket.IO ready for connections`);
  console.log('=================================\n');
});
