import { Job } from "bullmq";
import { JobProgress, LogProcessingJobData } from "../interface/interface.js";
import { supabase } from "../config/supabase.js";

 // Helper functions
 export async function initializeJobStatus(
  job: Job<LogProcessingJobData>,
  userId: string,
  originalFilename: string,
  jobStartDate: string
) {
  const { error } = await supabase.from("job_status").upsert({
    job_id: job.id,
    user_id: userId,
    file_name: originalFilename,
    status: "pending",
    started_at: jobStartDate,
    created_at: new Date().toISOString(),
  }, { onConflict: "job_id" });

  if (error) throw new Error(`Job status initialization failed: ${error.message}`);
}

export async function updateJobProgress(
  job: Job<LogProcessingJobData>,
  processedLines: number,
  validEntries: number,
  errorCount: number
) {
  await job.updateProgress({ processedLines, validEntries, errorCount } as JobProgress);
  const message=`Progress: ${processedLines} lines, ${validEntries} valid, ${errorCount} errors`
  console.log(message);
  
}

export async function handleJobFailure(
  job: Job<LogProcessingJobData>,
  processedLines: number,
  logEntriesCount: number,
  errorCount: number,
  error: unknown
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  try {
    const { error: dbError } = await supabase
      .from('job_status')
      .upsert({
        job_id: job.id,
        user_id:job.data.userId,
        status: 'failed',
        processed_lines: processedLines,
        valid_entries: logEntriesCount,
        error_count: errorCount,
        error_message: errorMessage,
        failed_at: new Date().toISOString()
      }, { onConflict: 'job_id' });

    if (dbError) {
      throw new Error(`Failed status update: ${dbError.message}`);
    }
  } catch (dbError) {
    console.error('Database update failed:', dbError);
    throw dbError; // Preserve original error chain
  }
}

export async function markJobCompleted(
    job: Job<LogProcessingJobData>,
    result: { processedLines: number; entryCount: number; errorCount: number }
  ): Promise<void> {
    const { error } = await supabase
      .from('job_status')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        attempts_made: job.attemptsMade ?? 1,
        processed_lines: result.processedLines,
        valid_entries: result.entryCount,
        error_count: result.errorCount
      })
      .eq('job_id', job.id);
  
    if (error) {
      throw new Error(`Completion update failed: ${error.message}`);
    }
  }
  
  export async function markJobFailed(
    job: Job<LogProcessingJobData>,
    error: Error
  ): Promise<void> {
    const { error: dbError } = await supabase
      .from('job_status')
      .upsert({
        job_id: job.id,
        user_id: job.data.userId,
        status: 'failed',
        attempts_made: job.attemptsMade,
        error_message: error.message.substring(0, 1000), // Prevent overflow
        failed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, { onConflict: 'job_id' });
      
    if (dbError) {
        throw new Error(`Failure update failed: ${dbError.message}`);
    }
    console.log(`✅ Successfully upserted failed job ${job.id} in database`);
  }