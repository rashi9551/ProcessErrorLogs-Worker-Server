// interface/interface.ts
export interface LogProcessingJobData {
  fileUrl?: string;
  storagePath?: string;
  bucketName?: string;
  userId: string;
  email?: string;
  originalFilename: string;
}

export interface JobProgress {
  processedLines: number;
  validEntries: number;
  errorCount: number;
}

export interface JobResult {
  success: boolean;
  processedLines: number;
  entryCount: number;
  errorCount: number;
  error?: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  keywords: string[];
  userId?: number;
  ip?: string;
  requestId?: string;
  duration?: number;
  status?: number;
  [key: string]: any; // Allow for additional fields
}

export interface DatabaseLogEntry {
  job_id: string;
  timestamp: string;
  level: string;
  message: string;
  keywords: string[];
  user_id: number;  // Snake_case for database compatibility
  ip: string;
  metadata: {
    requestId?: string;
    duration?: number;
    status?: number;
    [key: string]: any; // Allow for additional metadata
  };
}