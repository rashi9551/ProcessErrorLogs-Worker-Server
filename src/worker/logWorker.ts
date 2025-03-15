// src/workers/logWorker.ts
import { Job, Worker } from 'bullmq';
import { LogProcessingJobData, JobResult, LogEntry } from '../interface/interface.js';
import { connection } from '../config/redis.js';
import { handleJobFailure, initializeJobStatus } from '../services/jobStatusService.js';
import { getFileStream, processLogFile } from '../services/fileService.js';
import { handleSuccessfulProcessing } from '../services/logProcessingService.js';

export function createLogWorker(): Worker<LogProcessingJobData, JobResult> {
  return new Worker<LogProcessingJobData, JobResult>(
    'log-processing',
    async (job: Job<LogProcessingJobData>): Promise<JobResult> => {
      const jobStartDate = new Date().toISOString();
      console.log(`🔄 Processing job ${job.id}: ${job.name}`);

      const { userId, originalFilename } = job.data;
      let processedLines = 0;
      let errorCount = 0;
      const logEntries: LogEntry[] = [];

      try {
        await initializeJobStatus(job, userId, originalFilename, jobStartDate);
        const readStream = await getFileStream(job.data);
        await processLogFile(readStream, job, logEntries, processedLines, errorCount);
        return await handleSuccessfulProcessing(job, logEntries, processedLines, errorCount);
      } catch (error) {
        await handleJobFailure(job, processedLines, logEntries.length, errorCount, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || "4"),
    }
  );
}