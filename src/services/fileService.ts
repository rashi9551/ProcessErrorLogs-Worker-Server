import { Readable } from "stream";
import { LogEntry, LogProcessingJobData } from "../interface/interface.js";
import { Job } from "bullmq";
import { parseLogLine } from '../utils/parsedLogLine.js'; // Remove .js
import { updateJobProgress } from "./jobStatusService.js";
import readline from "readline";
import { supabase } from "../config/supabase.js";

declare global {
    interface ReadableStream<R = any> {
        [Symbol.asyncIterator](): AsyncIterableIterator<R>;
    }
}
  
export async function processLogFile(
  stream: Readable,
  job: Job<LogProcessingJobData>,
  logEntries: LogEntry[],
  processedLines: number,
  errorCount: number
) {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    try {
      processedLines++; // Always update processedLines

      if (!line.trim() || line.startsWith("#")) {
        continue;
      }

      const parsed = parseLogLine(line);
      parsed ? logEntries.push(parsed) : errorCount++;
      let count =0
      if (processedLines > 0 && processedLines % 10000 === 0) {
        await updateJobProgress(job, processedLines, logEntries.length, errorCount);
      }

    } catch (error: any) {
      errorCount++;
      console.error(`Line ${processedLines} error: ${error.message}`);
    }
  }

  try {
    await updateJobProgress(job, processedLines, logEntries.length, errorCount);
    return { processedLines, errorCount };
  } catch (error) {
    throw error;
  }
}

export async function getFileStream(data: LogProcessingJobData) {
  const { fileUrl, storagePath, bucketName } = data;
  
  if (fileUrl) {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`File download failed: ${response.statusText}`);
    return Readable.from(response.body!);
  }

  if (storagePath && bucketName) {
    const { data: fileData, error } = await supabase.storage
      .from(bucketName)
      .download(storagePath);
    
    if (error) throw new Error(`Supabase download failed: ${error.message}`);
    return Readable.from(Buffer.from(await fileData.arrayBuffer()));
  }

  throw new Error("No valid file source provided");
}