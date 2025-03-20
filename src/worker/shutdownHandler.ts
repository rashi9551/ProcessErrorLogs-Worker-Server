// src/workers/shutdownHandler.ts
import { Worker } from 'bullmq';
import { io } from '../index.js';

export function registerShutdownHandler(worker: Worker) {
  const shutdown = async (signal: string) => {
    const message=`${signal} received, closing worker...`
    io.emit('consoleMessage', { type: 'info', message }); // Broadcast console messages
    console.log(message);
    await worker.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}