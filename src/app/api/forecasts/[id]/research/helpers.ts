import type { SearchResult } from '@/lib/utils/webSearch'

/**
 * Strip common English stopwords and future-tense helpers from a claim to get
 * a tighter keyword query. E.g. "The Israeli Shekel will strengthen against the
 * US Dollar by the end of February 24, 2026" → "Israeli Shekel strengthen US
 * Dollar February 2026"
 */
export function extractKeyTerms(claimText: string, resolveByDatetime: Date): string {
    const stopwords = new Set([
        'the', 'a', 'an', 'will', 'would', 'should', 'could', 'may', 'might',
        'by', 'against', 'of', 'end', 'to', 'in', 'on', 'at', 'and', 'or',
        'be', 'is', 'are', 'was', 'were', 'that', 'this', 'it', 'its',
        'have', 'has', 'had', 'do', 'does', 'did', 'not', 'for', 'with',
        'from', 'up', 'about', 'into', 'than', 'then', 'so', 'if', 'as',
    ])
    const year = resolveByDatetime.getFullYear()
    const terms = claimText
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopwords.has(w.toLowerCase()))
        .join(' ')
    // Append year only if not already present in the terms
    return terms.includes(String(year)) ? terms : `${terms} ${year}`
}

export function dedup(items: SearchResult[]): SearchResult[] {
    const seen = new Set<string>()
    return items.filter(r => {
        if (seen.has(r.url)) return false
        seen.add(r.url)
        return true
    })
}

/**
 * Returns true if at least `minMatches` results contain one of the given terms
 * in their title or snippet (case-insensitive). Used to detect irrelevant results.
 */
export function hasRelevantResults(results: SearchResult[], terms: string[], minMatches = 2): boolean {
    const lowerTerms = terms.map(t => t.toLowerCase())
    let matches = 0
    for (const r of results) {
        const hay = `${r.title} ${r.snippet}`.toLowerCase()
        if (lowerTerms.some(t => hay.includes(t))) {
            matches++
            if (matches >= minMatches) return true
        }
    }
    return false
}
