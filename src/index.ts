import { Worker, Job } from "bullmq";
import dotenv from "dotenv";
import {
  JobResult,
  LogEntry,
  LogProcessingJobData,
} from "./interface/interface.js";
import { handleJobFailure, initializeJobStatus, markJobCompleted, markJobFailed } from "./services/jobStatusService.js";
import { getFileStream, processLogFile } from "./services/fileService.js";
import { handleSuccessfulProcessing } from "./services/logProcessingService.js";
import { connection } from "./config/redis.js";


// Load environment variables
dotenv.config();


console.log("🚀 Starting log processing microservice...");

const worker = new Worker<LogProcessingJobData, JobResult>(
  "log-processing",
  async (job: Job<LogProcessingJobData>): Promise<JobResult> => {
    const jobStartDate = new Date().toISOString();
    console.log(`🔄 Processing job ${job.id}: ${job.name}`);

    // Destructure job data with default values
    const { userId, originalFilename } = job.data;
    let processedLines = 0;
    let errorCount = 0;
    const logEntries: LogEntry[] = [];

    try {
      // Initialize job status with upsert
      await initializeJobStatus(job, userId, originalFilename, jobStartDate);

      // Process log file
      const readStream = await getFileStream(job.data);
      await processLogFile(readStream, job, logEntries, processedLines, errorCount);

      // Store results
      return await handleSuccessfulProcessing(job, logEntries, processedLines, errorCount);
    } catch (error) {
      try {
        await handleJobFailure(job,processedLines,logEntries.length,errorCount,error);
      } catch (dbError) {
        console.error("Failed to update job status:", dbError);
        throw dbError
      }
      throw error
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "4"),
  }
);


// Handle Bull events with more detailed logging
worker.on(
  "completed",
  async (job: Job<LogProcessingJobData>, result: JobResult) => {
    try {
      await markJobCompleted(job, {
        processedLines: result.processedLines,
        entryCount: result.entryCount,
        errorCount: result.errorCount
      });
    } catch (error) {
      console.error(
        `Error updating job completion: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    console.log(
      `✅ Job ${job.id} completed. Processed ${result.processedLines} lines with ${result.entryCount} valid entries and ${result.errorCount} errors.`
    );
  }
);

worker.on("failed", async (job: any, err: Error) => {
  console.error(
    `❌ Jobs ${job.id} failed (attempt ${job.attemptsMade}/${
      job.opts.attempts || 1
    }): ${err.message}`
  );

  try {
    console.log(`📝 Attempting to update database for job ${job.id}...`);
    await markJobFailed(job, err);
    // Log when all retries are exhausted
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      console.error(
        `⛔ Job ${job.id} has failed all ${job.opts.attempts} retry attempts. No further retries will be attempted.`
      );
    }
  } catch (updateError) {
    console.error(
      `Error in database operation: ${
        updateError instanceof Error ? updateError.message : String(updateError)
      }`
    );
    throw updateError;
  }
});

worker.on("error", (err: Error) => {
  console.error(`⚠️ Worker error: ${err.message}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing worker...");
  await worker.close();
  process.exit(0);
});

console.log("✅ Log processing worker started and waiting for job");

