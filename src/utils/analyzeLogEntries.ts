import { LogEntry } from "../interface/interface.js";

// utils/analyzeLogEntries.ts (continued)
export default function analyzeLogEntries(entries: LogEntry[]) {
    // Exit early if no entries
    if (!entries || entries.length === 0) {
        return {
            total_entries: 0,
            level_distribution: {},
            keyword_frequency: {},
            unique_ips: 0,
            ip_occurrences: {},
            top_ips: []
        };
    }

    const stats = entries.reduce((acc: {
        total_entries: number;
        level_distribution: Record<string, number>;
        keyword_frequency: Record<string, number>;
        unique_ips: Set<string>;
        ip_occurrences: Record<string, number>;
    }, entry: LogEntry) => {
        // Handle level distribution
        const level = entry.level || 'UNKNOWN';
        acc.level_distribution[level] = (acc.level_distribution[level] || 0) + 1;

        // Handle keywords
        entry.keywords?.forEach((keyword: string) => {
            acc.keyword_frequency[keyword] = (acc.keyword_frequency[keyword] || 0) + 1;
        });

        // Handle IP address statistics
        const ip = entry.ip || 'unknown';
        acc.unique_ips.add(ip);
        acc.ip_occurrences[ip] = (acc.ip_occurrences[ip] || 0) + 1;

        return acc;
    }, {
        total_entries: entries.length,
        level_distribution: {},
        keyword_frequency: {},
        unique_ips: new Set<string>(),
        ip_occurrences: {}
    });

    // Convert unique_ips Set to count
    const uniqueIpsCount = stats.unique_ips.size;

    // Calculate top_ips (top 5 IPs by occurrence)
    const topIps = Object.entries(stats.ip_occurrences)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => ({ ip: entry[0], count: entry[1] }));

    return {
        total_entries: stats.total_entries,
        level_distribution: stats.level_distribution,
        keyword_frequency: stats.keyword_frequency,
        unique_ips: uniqueIpsCount,
        ip_occurrences: stats.ip_occurrences,
        top_ips: topIps
    };
}