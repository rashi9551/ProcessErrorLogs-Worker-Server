import { Job, Worker } from 'bullmq';
import { LogProcessingJobData, JobResult, LogEntry } from '../interface/interface.js';
import { connection } from '../config/redis.js';
import { handleJobFailure, initializeJobStatus } from '../services/jobStatusService.js';
import { getFileStream, processLogFile } from '../services/fileService.js';
import { handleSuccessfulProcessing } from '../services/logProcessingService.js';
import { io } from '../index.js';

export function createLogWorker(): Worker<LogProcessingJobData, JobResult> {
  return new Worker<LogProcessingJobData, JobResult>(
    'log-processing',
    async (job: Job<LogProcessingJobData>): Promise<JobResult> => {
      const jobStartDate = new Date().toISOString();
      const message = `🔄 Processing job ${job.id}: ${job.name}`;
      console.log(message);
      // await new Promise(resolve => setTimeout(resolve, 60000)); 
      io.emit('consoleMessage', { type: 'info', message }); // Broadcast console message

      const { userId, originalFilename } = job.data;
      let processedLines = 0;
      let errorCount = 0;
      let logEntries: LogEntry[] = [];

      try {
        await initializeJobStatus(job, userId, originalFilename, jobStartDate);
        const readStream = await getFileStream(job.data);

        const result=await processLogFile(readStream, job, logEntries, processedLines, errorCount) as {processedLines:number,errorCount:number}

        processedLines=result.processedLines
        errorCount=result.errorCount

        const completionMessage = `✅ Job ${job.id} completed successfully`;
        console.log(completionMessage);

        io.emit('consoleMessage', { type: 'success', message: completionMessage }); // Broadcast completion message

        return await handleSuccessfulProcessing(job, logEntries, processedLines, errorCount);
      } catch (error: any) {
        const errorMessage = `❌ Job ${job.id} failed: ${error.message}`;
        console.error(errorMessage);
        io.emit('consoleMessage', { type: 'error', message: errorMessage }); // Broadcast error message


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