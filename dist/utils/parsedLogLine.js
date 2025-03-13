import dotenv from 'dotenv';
dotenv.config();
const keywords = process.env.ERROR_KEYWORDS ? process.env.ERROR_KEYWORDS.split(',') : [];
// Function to check if a message contains any of the keywords
function findKeywords(message) {
    const foundKeywords = keywords.filter(keyword => message.toLowerCase().includes(keyword.toLowerCase().trim()));
    return foundKeywords.length > 0 ? foundKeywords : ['unknown-keywords'];
}
// Function to parse a log line
export function parseLogLine(line, keywords = []) {
    try {
        // Regex to match: [TIMESTAMP] LEVEL MESSAGE {optional JSON}
        const regex = /\[(.*?)\]\s+(\w+)\s+(.*?)(?:\s+(\{.*\}))?$/;
        const match = line.match(regex);
        if (!match)
            return null;
        let [, timestamp, level, message, jsonPayload] = match;
        // Parse JSON payload if it exists
        let parsedPayload = {};
        if (jsonPayload) {
            try {
                parsedPayload = JSON.parse(jsonPayload);
            }
            catch (err) {
                console.error(`Error parsing JSON payload: ${err.message}, payload: ${jsonPayload}`);
            }
        }
        // Find keywords in the message
        const foundKeywords = findKeywords(message);
        return {
            timestamp,
            level,
            message,
            keywords: foundKeywords,
            ...parsedPayload
        };
    }
    catch (error) {
        console.error(`Error parsing log line: ${error.message}, line: ${line}`);
        return null; // Skip this line but don't fail the entire process
    }
}
//# sourceMappingURL=parsedLogLine.js.map