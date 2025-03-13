export default function analyzeLogEntries(entries) {
    const startTime = Date.now();

    const stats = entries.reduce((acc, entry) => {
        acc.level_distribution[entry.level] = (acc.level_distribution[entry.level] || 0) + 1;

        entry.keywords?.forEach(keyword => {
            acc.keyword_frequency[keyword] = (acc.keyword_frequency[keyword] || 0) + 1;
        });

        acc.unique_ips.add(entry.ip);
        acc.ip_occurrences[entry.ip] = (acc.ip_occurrences[entry.ip] || 0) + 1;

        return acc;
    }, {
        total_entries: entries.length,
        level_distribution: {},
        keyword_frequency: {},
        unique_ips: new Set(),
        ip_occurrences: {}
    });

    stats.unique_ips = stats.unique_ips.size;

    // Calculate top_ips (e.g., top 5 IPs by occurrence)
    stats.top_ips = Object.entries(stats.ip_occurrences)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) // Adjust based on desired top count
        .map(entry => ({ ip: entry[0], count: entry[1] }));

    return stats; // Don't forget to return!
}