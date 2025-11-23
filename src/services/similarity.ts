import { ContentEntry, DuplicateMatch } from '@/types'

class SimilarityService {
  /**
   * Calculate similarity score between two entries (0-1)
   */
  calculateSimilarity(entry1: ContentEntry, entry2: ContentEntry): number {
    // Exact duplicate check
    if (this.isExactDuplicate(entry1, entry2)) {
      return 1.0
    }

    // URL-based similarity
    const urlSimilarity = this.calculateURLSimilarity(entry1.url, entry2.url)
    if (urlSimilarity === 1.0) {
      return 0.95 // High similarity but not exact (different content/timestamp)
    }

    // Content-based similarity
    let contentSimilarity = 0
    if (entry1.type === entry2.type) {
      if (entry1.type === 'text' || entry1.type === 'page') {
        contentSimilarity = this.calculateTextSimilarity(
          entry1.content,
          entry2.content
        )
      } else if (entry1.type === 'image') {
        contentSimilarity = this.calculateImageSimilarity(entry1, entry2)
      }
    }

    // Title similarity
    const titleSimilarity = this.calculateTextSimilarity(
      entry1.title,
      entry2.title
    )

    // Weighted combination
    const weights = {
      url: 0.3,
      content: 0.5,
      title: 0.2,
    }

    return (
      urlSimilarity * weights.url +
      contentSimilarity * weights.content +
      titleSimilarity * weights.title
    )
  }

  /**
   * Find potential duplicates for a new entry
   */
  findDuplicates(
    newEntry: ContentEntry,
    existingEntries: ContentEntry[],
    threshold: number = 0.8
  ): DuplicateMatch[] {
    const matches: DuplicateMatch[] = []

    for (const existing of existingEntries) {
      // Skip self
      if (existing.id === newEntry.id) continue

      const similarity = this.calculateSimilarity(newEntry, existing)

      if (similarity >= threshold) {
        const matchType = this.determineMatchType(newEntry, existing, similarity)
        const reason = this.generateMatchReason(newEntry, existing, matchType)

        matches.push({
          entry: existing,
          similarity,
          matchType,
          reason,
        })
      }
    }

    // Sort by similarity (highest first)
    return matches.sort((a, b) => b.similarity - a.similarity)
  }

  /**
   * Check if two entries are exact duplicates
   */
  isExactDuplicate(entry1: ContentEntry, entry2: ContentEntry): boolean {
    // Same URL and same content hash
    if (entry1.url === entry2.url) {
      const hash1 = this.generateContentHash(entry1.content)
      const hash2 = this.generateContentHash(entry2.content)
      return hash1 === hash2
    }
    return false
  }

  /**
   * Generate content hash for fast exact matching
   */
  generateContentHash(content: string): string {
    // Simple hash function for content
    // For production, consider using crypto.subtle.digest for better hashing
    let hash = 0
    const normalized = this.normalizeText(content)
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  /**
   * Calculate text similarity using Jaccard similarity and Levenshtein distance
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0

    const normalized1 = this.normalizeText(text1)
    const normalized2 = this.normalizeText(text2)

    // For very short texts, use Levenshtein distance
    if (normalized1.length < 50 || normalized2.length < 50) {
      return this.levenshteinSimilarity(normalized1, normalized2)
    }

    // For longer texts, use Jaccard similarity on word sets
    return this.jaccardSimilarity(normalized1, normalized2)
  }

  /**
   * Calculate URL similarity
   */
  private calculateURLSimilarity(url1: string, url2: string): number {
    try {
      const parsed1 = new URL(url1)
      const parsed2 = new URL(url2)

      // Same domain and path = high similarity
      if (
        parsed1.hostname === parsed2.hostname &&
        parsed1.pathname === parsed2.pathname
      ) {
        return 0.9
      }

      // Same domain only = medium similarity
      if (parsed1.hostname === parsed2.hostname) {
        return 0.5
      }

      return 0
    } catch {
      // Invalid URLs, compare as strings
      return url1 === url2 ? 1.0 : 0
    }
  }

  /**
   * Calculate image similarity
   */
  private calculateImageSimilarity(
    entry1: ContentEntry,
    entry2: ContentEntry
  ): number {
    // Compare image URLs
    const url1 = entry1.metadata?.imageUrl || entry1.content
    const url2 = entry2.metadata?.imageUrl || entry2.content

    if (url1 === url2) {
      return 1.0
    }

    // For data URLs, compare first part of base64
    if (url1.startsWith('data:') && url2.startsWith('data:')) {
      const base64_1 = url1.substring(0, 1000)
      const base64_2 = url2.substring(0, 1000)
      if (base64_1 === base64_2) {
        return 0.95
      }
    }

    // Compare alt text if available
    const alt1 = entry1.metadata?.altText || ''
    const alt2 = entry2.metadata?.altText || ''
    if (alt1 && alt2) {
      return this.calculateTextSimilarity(alt1, alt2)
    }

    return 0
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Calculate Jaccard similarity (intersection over union of word sets)
   */
  private jaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2))
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2))

    if (words1.size === 0 && words2.size === 0) return 1.0
    if (words1.size === 0 || words2.size === 0) return 0.0

    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  /**
   * Calculate similarity using Levenshtein distance
   */
  private levenshteinSimilarity(text1: string, text2: string): number {
    const maxLen = Math.max(text1.length, text2.length)
    if (maxLen === 0) return 1.0

    const distance = this.levenshteinDistance(text1, text2)
    return 1 - distance / maxLen
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Determine the type of match
   */
  private determineMatchType(
    entry1: ContentEntry,
    entry2: ContentEntry,
    similarity: number
  ): 'exact' | 'near-duplicate' | 'url' | 'content' {
    if (similarity >= 0.99) {
      return 'exact'
    }

    if (entry1.url === entry2.url) {
      return 'url'
    }

    const contentSim = this.calculateTextSimilarity(entry1.content, entry2.content)
    if (contentSim >= 0.8) {
      return 'content'
    }

    return 'near-duplicate'
  }

  /**
   * Generate human-readable reason for the match
   */
  private generateMatchReason(
    _entry1: ContentEntry,
    _entry2: ContentEntry,
    matchType: 'exact' | 'near-duplicate' | 'url' | 'content'
  ): string {
    switch (matchType) {
      case 'exact':
        return 'Exact duplicate: Same URL and content'
      case 'url':
        return 'Same URL: Content captured from the same page'
      case 'content':
        return 'Similar content: Text is very similar'
      case 'near-duplicate':
        return 'Near duplicate: Similar title and content'
      default:
        return 'Similar entry detected'
    }
  }
}

export const similarityService = new SimilarityService()

