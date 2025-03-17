import { Job } from "bullmq";
import { supabase } from "../config/supabase.js";
import { DatabaseLogEntry, JobResult, LogEntry, LogProcessingJobData } from "../interface/interface.js";
import analyzeLogEntries from "../utils/analyzeLogEntries.js";

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
      console.log(analysis,"=-=-=-");
      
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


const BATCH_SIZE: number = 100;
const RATE_LIMIT_DELAY: number = 50; 

export async function batchInsertLogEntries(
    logEntries: LogEntry[],
    jobId: string
): Promise<{ success: boolean; total: number; inserted: number; batches: number; errors: number }> {
    const stats = {
        success: true,
        total: logEntries.length,
        inserted: 0,
        batches: 0,
        errors: 0
    };

    // Exit early if no entries to process
    if (logEntries.length === 0) {
        return stats;
    }

    try {
        // Transform log entries with defaults
        const transformedEntries: DatabaseLogEntry[] = logEntries.map((entry: LogEntry) => ({
            job_id: jobId,
            timestamp: entry.timestamp || new Date().toISOString(),
            level: entry.level || "INFO",
            message: entry.message || "No message provided",
            keywords: entry.keywords || [],
            user_id: entry.userId ?? 0,
            ip: entry.ip || "0.0.0.0",
            metadata: {
                requestId: entry.requestId || undefined,
                duration: entry.duration || undefined,
                status: entry.status || undefined
            }
        }));

        // Process in batches with error tracking
        for (let i = 0; i < transformedEntries.length; i += BATCH_SIZE) {
            stats.batches++;
            const batch = transformedEntries.slice(i, i + BATCH_SIZE);
            
            try {
                const { error } = await supabase
                    .from('log_entries')
                    .insert(batch);

                if (error) {
                    stats.errors++;
                    console.error(`Batch ${stats.batches} failed:`, error);
                    // Continue with next batch instead of throwing
                } else {
                    stats.inserted += batch.length;
                }
                
            } catch (batchError) {
                stats.errors++;
                console.error(`Batch ${stats.batches} failed with exception:`, batchError);
            }

            // Rate limiting pause between batches
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }

        // Set success based on whether all batches were processed successfully
        stats.success = stats.errors === 0;
        
        return stats;
        
    } catch (error) {
        console.error('Batch insert failed:', error);
        return {
            ...stats,
            success: false
        };
    }
}