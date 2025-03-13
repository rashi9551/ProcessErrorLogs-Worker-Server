// __tests__/unit/analyzeLogEntries.test.ts
import analyzeLogEntries from '../../src/utils/analyzeLogEntries.js';

describe('analyzeLogEntries', () => {
  test('should correctly analyze log entries', () => {
    const entries = [
      { timestamp: '2025-02-20T10:00:00Z', level: 'ERROR', message: 'Database timeout', keywords: ['timeout'], ip: '192.168.1.1' },
      { timestamp: '2025-02-20T10:01:00Z', level: 'INFO', message: 'User logged in', keywords: ['unknown-keywords'], ip: '192.168.1.2' },
      { timestamp: '2025-02-20T10:02:00Z', level: 'ERROR', message: 'Connection error', keywords: ['error'], ip: '192.168.1.1' }
    ];
    
    const result = analyzeLogEntries(entries);
    
    expect(result.total_entries).toBe(3);
    expect(result.level_distribution).toEqual({ ERROR: 2, INFO: 1 });
    expect(result.unique_ips).toBe(2);
    expect(result.top_ips[0].ip).toBe('192.168.1.1');
    expect(result.top_ips[0].count).toBe(2);
    
    // Add tests for timestamps if you implemented them
    if (result.firstTimestamp) {
      expect(result.firstTimestamp).toBe('2025-02-20T10:00:00Z');
      expect(result.lastTimestamp).toBe('2025-02-20T10:02:00Z');
    }
  });
  
  test('should handle empty array of entries', () => {
    const result = analyzeLogEntries([]);
    
    expect(result.total_entries).toBe(0);
    expect(result.level_distribution).toEqual({});
    expect(result.unique_ips).toBe(0);
    expect(result.top_ips).toEqual([]);
  });
});