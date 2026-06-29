/**
 * Socket.IO Client Configuration
 * 
 * This module exports a singleton Socket.IO client instance
 * connected to the backend server for real-time vote updates.
 * 
 * The dashboard uses this to listen for "new_vote" events,
 * which broadcast newly submitted encrypted votes in real-time.
 */

import { io } from 'socket.io-client';

// Create Socket.IO client instance
// Connects to the host that served the page, proxied through Vite in development
const socket = io({
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// Log connection events for debugging
socket.on('connect', () => {
  console.log('🔌 Socket.IO connected');
});

socket.on('disconnect', () => {
  console.log('🔌 Socket.IO disconnected');
});

socket.on('connect_error', (error) => {
  console.error('🔌 Socket.IO connection error:', error);
});

export default socket;
