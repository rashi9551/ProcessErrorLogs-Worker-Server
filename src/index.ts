import dotenv from 'dotenv';
import { createLogWorker } from './worker/logWorker.js';
import { registerEventHandlers } from './worker/eventHandlers.js';
import { registerShutdownHandler } from './worker/shutdownHandler.js';
import { Server } from 'socket.io';
import { createServer } from 'http';

dotenv.config();

console.log("🚀 Starting log processing microservice...");


const httpServer = createServer();
export const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000", 
    methods: ["GET", "POST"],
  },
});



const worker = createLogWorker();


registerEventHandlers(worker);
registerShutdownHandler(worker);


httpServer.listen(3001, () => {
  console.log('WebSocket server is running on port 3001');
});

console.log("✅ Log processing worker started and waiting for jobs");