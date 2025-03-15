// utils/parsedLogLine.ts
import { LogEntry } from '../interface/interface.js';

// Load keywords from environment or use defaults
const DEFAULT_KEYWORDS = ['error', 'failed', 'exception', 'warning', 'critical'];
const keywords = process.env.ERROR_KEYWORDS 
    ? process.env.ERROR_KEYWORDS.split(',').map(k => k.trim().toLowerCase()) 
    : DEFAULT_KEYWORDS;


function findKeywords(message: string, customKeywords?: string[]): string[] {
  const searchKeywords = customKeywords && customKeywords.length > 0 ? customKeywords : keywords;
  
  const foundKeywords = searchKeywords.filter(keyword =>
    message.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return foundKeywords.length > 0 ? foundKeywords : [];
}

/**
 * Parse a log line into structured data
 * @param line - Raw log line to parse
 * @param customKeywords - Optional keywords to search for
 * @returns Parsed log entry or null if parsing fails
 */
export function parseLogLine(line: string, customKeywords?: string[]): LogEntry | null {
  try {
    // Regex to match: [TIMESTAMP] LEVEL MESSAGE {optional JSON}
    const regex = /\[(.*?)\]\s+(\w+)\s+(.*?)(?:\s+(\{.*\}))?$/;
    const match = line.match(regex);
    
    if (!match) return null;
    
    const [, timestamp, level, message, jsonPayload] = match;
    
    // Parse JSON payload if it exists
    let parsedPayload: Record<string, any> = {};
    if (jsonPayload) {
      try {
        parsedPayload = JSON.parse(jsonPayload);
      } catch (err) {
        console.error(`Error parsing JSON payload: ${err instanceof Error ? err.message : String(err)}, payload: ${jsonPayload}`);
      }
    }
    
    // Find keywords in the message using provided or default keywords
    const foundKeywords = findKeywords(message, customKeywords);
    
    // Return structured log entry
    return {
      timestamp,
      level,
      message,
      keywords: foundKeywords,
      ...parsedPayload
    };
  } catch (error) {
    console.error(`Error parsing log line: ${error instanceof Error ? error.message : String(error)}, line: ${line}`);
    return null; // Skip this line but don't fail the entire process
  }
}