// src/workers/eventHandlers.ts
import { Worker } from 'bullmq';
import { LogProcessingJobData, JobResult } from '../interface/interface.js';
import { markJobCompleted, markJobFailed } from '../services/jobStatusService.js';

export function registerEventHandlers(worker: Worker<LogProcessingJobData, JobResult>) {
  worker.on('completed', async (job, result) => {
    try {
      await markJobCompleted(job, {
        processedLines: result.processedLines,
        entryCount: result.entryCount,
        errorCount: result.errorCount
      });
      console.log(`✅ Job ${job.id} completed. Processed ${result.processedLines} lines`);
    } catch (error) {
      console.error('Completion update error:', error instanceof Error ? error.message : String(error));
    }
  });

  worker.on('failed', async (job:any, err) => {
    try {
      console.error(`❌ Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts || 1}): ${err.message}`);
      await markJobFailed(job, err);
      console.log(`📝 Recorded failure for job ${job.id}`);
      
      if (job.attemptsMade >= (job.opts.attempts || 1)) {
        console.error(`⛔ Final failure for ${job.id} after ${job.attemptsMade} attempts`);
      }
    } catch (dbError) {
      console.error('Failure update error:', dbError instanceof Error ? dbError.message : String(dbError));
    }
  });

  worker.on('error', (err) => {
    console.error(`⚠️ Worker error: ${err.message}`);
  });
}