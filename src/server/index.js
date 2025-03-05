const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const { setupGameRoutes } = require('./routes/gameRoutes');
const { setupLLMHandlers } = require('./services/llmService');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../../public')));
app.use(express.json());

// Set up game routes
setupGameRoutes(app);

// Set up socket handlers for real-time interactions
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Set up LLM-specific handlers
  setupLLMHandlers(io, socket);
  
  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});