// utils/batchInsertLogEntries.ts
import { supabase } from '../config/supabase.js';
import { DatabaseLogEntry, LogEntry } from '../interface/interface.js';

const BATCH_SIZE: number = 100;
const RATE_LIMIT_DELAY: number = 50; // ms between batch requests


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