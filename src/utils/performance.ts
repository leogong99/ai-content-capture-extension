/**
 * Performance monitoring utilities for the AI Content Capture extension
 */

export interface PerformanceMetrics {
  memoryUsage: number
  entryCount: number
  averageEntrySize: number
  totalStorageSize: number
  lastCleanup: string | null
  searchPerformance: {
    averageSearchTime: number
    lastSearchTime: number
  }
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetrics = {
    memoryUsage: 0,
    entryCount: 0,
    averageEntrySize: 0,
    totalStorageSize: 0,
    lastCleanup: null,
    searchPerformance: {
      averageSearchTime: 0,
      lastSearchTime: 0,
    },
  }

  private searchTimes: number[] = []
  private maxSearchTimes = 10 // Keep last 10 search times

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Measure memory usage (if available)
   */
  measureMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
      return memory?.usedJSHeapSize ? memory.usedJSHeapSize / 1024 / 1024 : 0 // Convert to MB
    }
    return 0
  }

  /**
   * Record search performance
   */
  recordSearchTime(searchTime: number): void {
    this.searchTimes.push(searchTime)
    if (this.searchTimes.length > this.maxSearchTimes) {
      this.searchTimes.shift()
    }

    this.metrics.searchPerformance.lastSearchTime = searchTime
    this.metrics.searchPerformance.averageSearchTime =
      this.searchTimes.reduce((sum, time) => sum + time, 0) /
      this.searchTimes.length
  }

  /**
   * Update storage metrics
   */
  updateStorageMetrics(entryCount: number, totalSize: number): void {
    this.metrics.entryCount = entryCount
    this.metrics.totalStorageSize = totalSize
    this.metrics.averageEntrySize = entryCount > 0 ? totalSize / entryCount : 0
  }

  /**
   * Record cleanup operation
   */
  recordCleanup(): void {
    this.metrics.lastCleanup = new Date().toISOString()
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    this.metrics.memoryUsage = this.measureMemoryUsage()
    return { ...this.metrics }
  }

  /**
   * Check if performance is degrading
   */
  isPerformanceDegrading(): boolean {
    const metrics = this.getMetrics()

    // Check memory usage
    if (metrics.memoryUsage > 100) {
      // More than 100MB
      return true
    }

    // Check search performance
    if (metrics.searchPerformance.averageSearchTime > 1000) {
      // More than 1 second
      return true
    }

    // Check storage size
    if (metrics.totalStorageSize > 50 * 1024 * 1024) {
      // More than 50MB
      return true
    }

    return false
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = []
    const metrics = this.getMetrics()

    if (metrics.memoryUsage > 50) {
      recommendations.push(
        'High memory usage detected. Consider reducing the number of loaded entries.'
      )
    }

    if (metrics.searchPerformance.averageSearchTime > 500) {
      recommendations.push(
        'Search performance is slow. Consider using more specific search terms.'
      )
    }

    if (metrics.totalStorageSize > 100 * 1024 * 1024) {
      recommendations.push(
        'Very large storage size detected (>100MB). Consider exporting old entries for backup.'
      )
    }

    if (metrics.entryCount > 10000) {
      recommendations.push(
        'Large number of entries (>10,000). Performance remains optimal with pagination.'
      )
    }

    return recommendations
  }

  /**
   * Log performance metrics to console
   */
  logMetrics(): void {
    const metrics = this.getMetrics()
    console.group('🚀 Performance Metrics')
    console.log(`Memory Usage: ${metrics.memoryUsage.toFixed(2)} MB`)
    console.log(`Entry Count: ${metrics.entryCount}`)
    console.log(
      `Average Entry Size: ${metrics.averageEntrySize.toFixed(2)} bytes`
    )
    console.log(
      `Total Storage Size: ${(metrics.totalStorageSize / 1024 / 1024).toFixed(2)} MB`
    )
    console.log(`Last Cleanup: ${metrics.lastCleanup || 'Never'}`)
    console.log(
      `Average Search Time: ${metrics.searchPerformance.averageSearchTime.toFixed(2)} ms`
    )
    console.log(
      `Last Search Time: ${metrics.searchPerformance.lastSearchTime.toFixed(2)} ms`
    )

    const recommendations = this.getRecommendations()
    if (recommendations.length > 0) {
      console.group('💡 Recommendations')
      recommendations.forEach(rec => console.log(`• ${rec}`))
      console.groupEnd()
    }

    console.groupEnd()
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()

/**
 * Utility function to measure async operation performance
 */
export async function measureAsyncOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  const startTime = performance.now()

  try {
    const result = await operation()
    const endTime = performance.now()
    const duration = endTime - startTime

    console.log(`⏱️ ${operationName} took ${duration.toFixed(2)}ms`)

    // Record search performance if it's a search operation
    if (operationName.toLowerCase().includes('search')) {
      performanceMonitor.recordSearchTime(duration)
    }

    return result
  } catch (error) {
    const endTime = performance.now()
    const duration = endTime - startTime
    console.error(
      `❌ ${operationName} failed after ${duration.toFixed(2)}ms:`,
      error
    )
    throw error
  }
}

/**
 * Utility function to measure sync operation performance
 */
export function measureSyncOperation<T>(
  operation: () => T,
  operationName: string
): T {
  const startTime = performance.now()

  try {
    const result = operation()
    const endTime = performance.now()
    const duration = endTime - startTime

    console.log(`⏱️ ${operationName} took ${duration.toFixed(2)}ms`)
    return result
  } catch (error) {
    const endTime = performance.now()
    const duration = endTime - startTime
    console.error(
      `❌ ${operationName} failed after ${duration.toFixed(2)}ms:`,
      error
    )
    throw error
  }
}
