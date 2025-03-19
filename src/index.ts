import dotenv from 'dotenv';
import { createLogWorker } from './worker/logWorker.js';
import { registerEventHandlers } from './worker/eventHandlers.js';
import { registerShutdownHandler } from './worker/shutdownHandler.js';
import { Server } from 'socket.io';
import { createServer } from 'http';

dotenv.config();

console.log("🚀 Starting log processing microservice...");

// Create HTTP server and WebSocket server
const httpServer = createServer();
export const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000", // Allow connections from the Next.js UI
    methods: ["GET", "POST"],
  },
});


// Initialize worker with the WebSocket server instance
const worker = createLogWorker();

// Register handlers
registerEventHandlers(worker);
registerShutdownHandler(worker);

// Start the HTTP server
httpServer.listen(3001, () => {
  console.log('WebSocket server is running on port 3001');
});

console.log("✅ Log processing worker started and waiting for jobs");