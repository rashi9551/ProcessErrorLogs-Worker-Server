// __tests__/unit/parsedLogLine.test.ts
import { parseLogLine } from '../../src/utils/parsedLogLine.js';
describe('parseLogLine', () => {
  test('should correctly parse a valid log line', () => {
    const line = '[2025-02-20T10:00:00Z] ERROR Database timeout {"userId": 123, "ip": "192.168.1.1"}';
    const result = parseLogLine(line);
    
    expect(result).toEqual({
      timestamp: '2025-02-20T10:00:00Z',
      level: 'ERROR',
      message: 'Database timeout',
      keywords: expect.any(Array),
      userId: 123,
      ip: '192.168.1.1'
    });
  });
  
  test('should handle log lines without JSON payload', () => {
    const line = '[2025-02-20T10:00:00Z] INFO Server started';
    const result = parseLogLine(line);
    
    expect(result).toEqual({
      timestamp: '2025-02-20T10:00:00Z',
      level: 'INFO',
      message: 'Server started',
      keywords: expect.any(Array)
    });
  });
  
  test('should return null for invalid log lines', () => {
    const line = 'This is not a valid log line';
    const result = parseLogLine(line);
    
    expect(result).toBeNull();
  });
});