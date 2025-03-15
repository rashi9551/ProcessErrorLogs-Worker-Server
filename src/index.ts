// src/index.ts
import dotenv from 'dotenv';
import { createLogWorker } from './worker/logWorker.js';
import { registerEventHandlers } from './worker/eventHandlers.js';
import { registerShutdownHandler } from './worker/shutdownHandler.js';


dotenv.config();

console.log("🚀 Starting log processing microservice...");

// Initialize worker
const worker = createLogWorker();

// Register handlers
registerEventHandlers(worker);
registerShutdownHandler(worker);

console.log("✅ Log processing worker started and waiting for jobs");