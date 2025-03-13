// log-processing-service/index.ts
import { Worker } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { Readable } from 'stream';
import readline from 'readline';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Redis } from 'ioredis';
;
import { parseLogLine } from './utils/parsedLogLine.js';
import analyzeLogEntries from './utils/analyzeLogEntries.js';
// Setup __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load environment variables
dotenv.config();
// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');
const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null, // Ensures the worker retries indefinitely on failed commands
});
console.log('🚀 Starting log processing microservice...');
// Initialize BullMQ worker
const worker = new Worker('log-processing', async (job) => {
    const jobStartDate = new Date().toISOString();
    console.log(`🔄 Processing job ${job.id}: ${job.name}`);
    const { fileUrl, storagePath, bucketName, userId, email, originalFilename } = job.data;
    let processedLines = 0;
    let errorCount = 0;
    const logEntries = [];
    try {
        const { error: pendingError } = await supabase
            .from('job_status')
            .insert({
            job_id: job.id,
            user_id: userId,
            file_name: originalFilename,
            status: 'pending',
            started_at: new Date(jobStartDate).toISOString(),
            created_at: new Date().toISOString(),
        });
        if (pendingError)
            throw new Error(`Pending status insert failed: ${pendingError.message}`);
        // If we have storagePath and bucketName, we can download directly from Supabase
        let fileContent;
        if (fileUrl) {
            // Download file using the signed URL
            console.log(`Downloading file from signed URL: ${fileUrl}`);
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`Failed to download file: ${response.statusText}`);
            }
            fileContent = await response.arrayBuffer();
        }
        else if (storagePath && bucketName) {
            // Download file directly from Supabase storage
            console.log(`Downloading file from Supabase: ${bucketName}/${storagePath}`);
            const { data, error } = await supabase.storage.from(bucketName).download(storagePath);
            if (error) {
                throw new Error(`Failed to download file from Supabase: ${error.message}`);
            }
            fileContent = await data.arrayBuffer();
        }
        else {
            throw new Error('No file source provided. Need either fileUrl or storagePath+bucketName');
        }
        const readStream = Readable.from(Buffer.from(fileContent));
        // Create readline interface to process file line by line
        const rl = readline.createInterface({
            input: readStream,
            crlfDelay: Infinity,
        });
        // Process file line by line
        for await (const line of rl) {
            try {
                if (line.trim() && !line.startsWith('#')) {
                    const parsedLine = parseLogLine(line);
                    if (parsedLine) {
                        logEntries.push(parsedLine);
                    }
                    else {
                        errorCount++;
                    }
                }
                processedLines++;
                if (processedLines % 10000 === 0) {
                    // Update job progress every 10,000 lines
                    await job.updateProgress({
                        processedLines,
                        validEntries: logEntries.length,
                        errorCount,
                    });
                    console.log(`Progress: ${processedLines} lines processed, ${logEntries.length} valid entries, ${errorCount} errors`);
                }
            }
            catch (lineError) {
                errorCount++;
                console.error(`Error processing line #${processedLines}: ${lineError.message}`);
                // Continue processing other lines
            }
        }
        // Final progress update
        await job.updateProgress({
            processedLines,
            validEntries: logEntries.length,
            errorCount,
        });
        console.log(`Completed processing ${processedLines} lines with ${logEntries.length} valid entries and ${errorCount} errors`);
        // Store processed entries in Supabase
        if (logEntries.length > 0) {
            const analyzeLogEntriesResult = analyzeLogEntries(logEntries);
            console.log(analyzeLogEntriesResult, '-- Analysis Results --');
            try {
                // Insert to job_status
                const { error: statusError } = await supabase
                    .from('job_status')
                    .update({
                    status: 'completed',
                    processed_lines: processedLines,
                    valid_entries: logEntries.length,
                    error_count: errorCount,
                    completed_at: new Date().toISOString(),
                })
                    .eq('job_id', job.id);
                if (statusError)
                    throw new Error(`Job status insert failed: ${statusError.message}`);
                // Insert to logs_stats
                try {
                    const { error: statsError } = await supabase.from('logs_stats').insert({
                        job_id: job.id,
                        total_entries: analyzeLogEntriesResult.total_entries,
                        level_distribution: analyzeLogEntriesResult.level_distribution,
                        keyword_frequency: analyzeLogEntriesResult.keyword_frequency,
                        unique_ips: analyzeLogEntriesResult.unique_ips,
                        ip_occurrences: analyzeLogEntriesResult.ip_occurrences,
                        top_ips: analyzeLogEntriesResult.top_ips,
                        created_at: new Date().toISOString(),
                    });
                    if (statsError)
                        throw new Error(`Log stats insert failed: ${statsError.message}`);
                }
                catch (statsError) {
                    console.error('Failed to insert log stats:', statsError.message);
                    // Roll back job_status if needed
                    await supabase.from('job_status').delete().eq('job_id', job.id);
                    throw statsError;
                }
            }
            catch (statusError) {
                console.error('❌ Failed to update job status:', statusError.message);
                throw statusError;
            }
        }
        return {
            processedLines,
            entryCount: logEntries.length,
            errorCount,
            success: true,
        };
    }
    catch (error) {
        console.error(`Job failed: ${error instanceof Error ? error.message : String(error)}`);
        // Update job status to failed with error details
        try {
            const { error: statusError } = await supabase
                .from('job_status')
                .update({
                status: 'failed',
                valid_entries: logEntries.length,
                error_message: error instanceof Error ? error.message : String(error),
                failed_at: new Date().toISOString(),
            })
                .eq('job_id', job.id);
            if (statusError) {
                console.error('❌ Failed to record failure status:', statusError.message);
            }
        }
        catch (insertError) {
            console.error('Critical failure - could not record job failure:', insertError.message);
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            processedLines,
            entryCount: logEntries.length,
            errorCount,
        };
    }
}, {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '4'),
});
// Handle Bull events with more detailed logging
worker.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed. Processed ${result.processedLines} lines with ${result.entryCount} valid entries and ${result.errorCount} errors.`);
});
worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
});
worker.on('error', (err) => {
    console.error(`⚠️ Worker error: ${err.message}`);
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing worker...');
    await worker.close();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, closing worker...');
    await worker.close();
    process.exit(0);
});
console.log('✅ Log processing worker started and waiting for jobs');
//# sourceMappingURL=index.js.map