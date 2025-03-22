import { Readable } from "stream";
import { processLogFile } from "../src/services/fileService";
import { Job } from "bullmq";
import { LogProcessingJobData, LogEntry } from "../src/interface/interface";
import { updateJobProgress } from "../src/services/jobStatusService.js";
import { parseLogLine } from "../src/utils/parsedLogLine.js";

// Mock dependencies
jest.mock("../src/services/jobStatusService", () => ({
  updateJobProgress: jest.fn(),
}));

jest.mock("../src/utils/parsedLogLine", () => ({
  parseLogLine: jest.fn(),
}));

describe("processLogFile", () => {
  let job: Job<LogProcessingJobData>;
  let logEntries: LogEntry[];
  let processedLines: number;
  let errorCount: number;

  beforeEach(() => {
    job = { id: "test-job" } as Job<LogProcessingJobData>; // Mock job
    logEntries = [{
      timestamp: '2025-03-08T15:43:31Z',
      level: 'DEBUG',
      message: 'Authentication failed',
      keywords: [],
      userId: 1567,
      ip: '192.168.5.39'
    },
    {
      timestamp: '2025-03-08T15:43:31Z',
      level: 'DEBUG',
      message: 'Authentication failed',
      keywords: [],
      userId: 1567,
      ip: '192.168.5.39'
    }];
    processedLines = 0;
    errorCount = 0;
    jest.clearAllMocks();
  });

  function createMockStream(lines: string[]): Readable {
    return Readable.from(lines.join("\n"));
  }

  it("should process valid log lines correctly", async () => {
    (parseLogLine as jest.Mock)
      .mockReturnValueOnce({ userId: 3927, ip: "172.16.54.29", requestId: "req-b8e2f7a5" })
      .mockReturnValueOnce({ userId: 1234, ip: "192.168.1.1", requestId: "req-aabbccdd" });

    const stream = createMockStream([
      '[2025-02-24T03:58:13Z] WARN Invalid request parameters {"userId": 3927, "ip": "172.16.54.29", "requestId": "req-b8e2f7a5"}',
      '[2025-02-24T04:00:00Z] INFO User login {"userId": 1234, "ip": "192.168.1.1", "requestId": "req-aabbccdd"}',
    ]);

    await processLogFile(stream, job, logEntries, processedLines, errorCount);

    expect(logEntries).toHaveLength(2);
    expect(errorCount).toBe(0);
    expect(processedLines).toBe(2);
    expect(updateJobProgress).toHaveBeenCalledTimes(1);
  });

  it("should count errors for invalid log lines", async () => {
    (parseLogLine as jest.Mock)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ userId: 1234, ip: "192.168.1.1", requestId: "req-aabbccdd" });

    const stream = createMockStream([
      "INVALID LOG ENTRY",
      '[2025-02-24T04:00:00Z] INFO User login {"userId": 1234, "ip": "192.168.1.1", "requestId": "req-aabbccdd"}',
    ]);

    await processLogFile(stream, job, logEntries, processedLines, errorCount);

    expect(logEntries).toHaveLength(1);
    expect(errorCount).toBe(1);
    expect(processedLines).toBe(2);
  });

  it("should handle errors during processing without crashing", async () => {
    (parseLogLine as jest.Mock).mockImplementation(() => {
      throw new Error("Parsing failed");
    });

    const stream = createMockStream([
      '[2025-02-24T03:58:13Z] WARN Invalid request parameters {"userId": 3927, "ip": "172.16.54.29", "requestId": "req-b8e2f7a5"}',
      '[2025-02-24T04:00:00Z] INFO User login {"userId": 1234, "ip": "192.168.1.1", "requestId": "req-aabbccdd"}',
    ]);

    await processLogFile(stream, job, logEntries, processedLines, errorCount);

    expect(errorCount).toBe(2);
    expect(processedLines).toBe(2);
  });
});
