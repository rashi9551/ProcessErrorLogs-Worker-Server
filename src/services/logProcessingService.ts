import { Job } from "bullmq";
import { supabase } from "../config/supabase.js";
import { JobResult, LogEntry, LogProcessingJobData } from "../interface/interface.js";
import analyzeLogEntries from "../utils/analyzeLogEntries.js";
import { batchInsertLogEntries } from "../utils/batchInsertLogEntries.js";

export async function handleSuccessfulProcessing(
  job: Job<LogProcessingJobData>,
  logEntries: LogEntry[],
  processedLines: number,
  errorCount: number
): Promise<JobResult> {
  try {
    if (logEntries.length === 0) {
      return { processedLines, entryCount: 0, errorCount, success: true };
    }

    // Update job status to processing with error handling
    const { error: statusError } = await supabase
      .from("job_status")
      .update({ 
        status: "processing",
        processed_lines: processedLines,
        valid_entries: logEntries.length,
        error_count: errorCount
      })
      .eq("job_id", job.id);

    if (statusError) {
      throw new Error(`Status update to processing failed: ${statusError.message}`);
    }

    // Batch insert log entries with detailed error handling
    const insertResult = await batchInsertLogEntries(logEntries, (job.id)as string);
    if (!insertResult.success) {
      console.warn(`Partial insert: ${insertResult.inserted}/${insertResult.total}`);
      if (insertResult.inserted === 0) {
        throw new Error("Failed to insert any log entries");
      }
      // Handle partial failure if needed
    }

    // Analyze and store stats with proper error handling
    try {
      const analysis = analyzeLogEntries(logEntries);
      const { error: statsError } = await supabase
        .from("log_stats")  // Changed table name
        .insert({
          job_id: job.id,
          ...analysis,
          created_at: new Date().toISOString()
        });

      if (statsError) {
        console.log(statsError);
        throw new Error(`Stats insertion failed: ${statsError.message}`);
      }
    } catch (statsError) {
      console.error("Failed to insert log stats:", statsError);
      throw new Error("Log stats storage failed");
    }

    return { 
      processedLines, 
      entryCount: logEntries.length, 
      errorCount, 
      success: true 
    };

  } catch (error) {
    // Update job status with failure details
    const errorMessage = error instanceof Error ? error.message : String(error);
    const { error: dbError } = await supabase
      .from("job_status")
      .update({
        status: "failed",
        error_message: errorMessage,
        failed_at: new Date().toISOString()
      })
      .eq("job_id", job.id);

    if (dbError) {
      console.error("Failed to record failure status:", dbError.message);
    }

    // Re-throw to ensure BullMQ marks job as failed
    throw error;
  }
}