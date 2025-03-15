// src/workers/shutdownHandler.ts
import { Worker } from 'bullmq';

export function registerShutdownHandler(worker: Worker) {
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, closing worker...`);
    await worker.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}