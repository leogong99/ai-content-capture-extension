import { ContentEntry, UserAgreement, ExtensionSettings } from '@/types'
import { performanceMonitor, measureAsyncOperation } from '@/utils/performance'

const DB_NAME = 'AIContentCapture'
const DB_VERSION = 1
const STORE_NAME = 'entries'
const CONFIG_STORE = 'config'

class StorageService {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create entries store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const entriesStore = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
          })
          entriesStore.createIndex('url', 'url', { unique: false })
          entriesStore.createIndex('createdAt', 'createdAt', { unique: false })
          entriesStore.createIndex('category', 'category', { unique: false })
          entriesStore.createIndex('tags', 'tags', {
            unique: false,
            multiEntry: true,
          })
        }

        // Create config store
        if (!db.objectStoreNames.contains(CONFIG_STORE)) {
          db.createObjectStore(CONFIG_STORE, { keyPath: 'key' })
        }
      }
    })
  }

  async saveEntry(entry: ContentEntry): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(entry)

      request.onsuccess = async () => {
        // Check storage limits after saving
        await this.enforceStorageLimits()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async enforceStorageLimits(): Promise<void> {
    try {
      const settings = await this.getConfig('settings') as ExtensionSettings | null

      // Only enforce limits if autoCleanup is explicitly enabled
      if (!settings?.storage?.autoCleanup) {
        console.log('Auto cleanup is disabled - keeping all records')
        return
      }

      if (!settings.storage.maxEntries) {
        console.log('No max entries limit set - keeping all records')
        return
      }

      const maxEntries = settings.storage.maxEntries
      const totalCount = await this.getTotalCount()

      if (totalCount > maxEntries) {
        const entriesToDelete = totalCount - maxEntries
        await this.deleteOldestEntries(entriesToDelete)
        performanceMonitor.recordCleanup()
        console.log(
          `Cleaned up ${entriesToDelete} old entries to maintain limit of ${maxEntries}`
        )
      } else {
        console.log(
          `Storage within limits: ${totalCount}/${maxEntries} entries`
        )
      }
    } catch (error) {
      console.error('Failed to enforce storage limits:', error)
    }
  }

  async getTotalCount(): Promise<number> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.count()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async deleteOldestEntries(count: number): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('createdAt')
      const request = index.openCursor() // Oldest first

      let deletedCount = 0

      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result
        if (cursor && deletedCount < count) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async getEntry(id: string): Promise<ContentEntry | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async getAllEntries(): Promise<ContentEntry[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getEntriesPaginated(
    page: number = 1,
    pageSize: number = 50,
    sortBy: 'date' | 'title' | 'category' = 'date',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ entries: ContentEntry[]; total: number; hasMore: boolean }> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)

      // Get total count first
      const countRequest = store.count()
      countRequest.onsuccess = () => {
        const total = countRequest.result
        const offset = (page - 1) * pageSize

        if (offset >= total) {
          resolve({ entries: [], total, hasMore: false })
          return
        }

        // For better compatibility, load all entries and sort in memory
        // This ensures consistent sorting behavior across all fields
        const allRequest = store.getAll()
        allRequest.onsuccess = () => {
          const allEntries = allRequest.result
          const sorted = allEntries.sort((a, b) => {
            let comparison = 0

            switch (sortBy) {
              case 'date':
                comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                break
              case 'title':
                comparison = a.title.localeCompare(b.title)
                break
              case 'category':
                comparison = a.category.localeCompare(b.category)
                break
              default:
                comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            }

            return sortOrder === 'asc' ? comparison : -comparison
          })
          
          const entries = sorted.slice(offset, offset + pageSize)
          resolve({ entries, total, hasMore: offset + pageSize < total })
        }
        allRequest.onerror = () => reject(allRequest.error)
      }

      countRequest.onerror = () => reject(countRequest.error)
    })
  }

  async getRecentEntries(limit: number = 10): Promise<ContentEntry[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('createdAt')
      const request = index.openCursor(null, 'prev') // Most recent first

      const entries: ContentEntry[] = []

      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result
        if (cursor && entries.length < limit) {
          entries.push(cursor.value)
          cursor.continue()
        } else {
          resolve(entries)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async deleteEntry(id: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async searchEntries(
    query: string,
    filters?: {
      tags?: string[]
      category?: string
      type?: 'text' | 'image' | 'page'
      dateFrom?: string
      dateTo?: string
    },
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ entries: ContentEntry[]; total: number; hasMore: boolean }> {
    return measureAsyncOperation(async () => {
      if (!this.db) await this.init()

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)

        // Start with all entries and apply filters
        const request = store.getAll()

        request.onsuccess = () => {
          let filteredEntries = request.result

          // Apply filters first (more efficient)
          if (filters?.category) {
            filteredEntries = filteredEntries.filter(
              entry => entry.category === filters.category
            )
          }

          if (filters?.type) {
            filteredEntries = filteredEntries.filter(
              entry => entry.type === filters.type
            )
          }

          if (filters?.dateFrom) {
            const fromDate = new Date(filters.dateFrom)
            filteredEntries = filteredEntries.filter(
              entry => new Date(entry.createdAt) >= fromDate
            )
          }

          if (filters?.dateTo) {
            const toDate = new Date(filters.dateTo)
            filteredEntries = filteredEntries.filter(
              entry => new Date(entry.createdAt) <= toDate
            )
          }

          if (filters?.tags && filters.tags.length > 0) {
            filteredEntries = filteredEntries.filter(entry =>
              filters.tags!.some(filterTag =>
                entry.tags.some((entryTag: string) =>
                  entryTag.toLowerCase().includes(filterTag.toLowerCase())
                )
              )
            )
          }

          // Apply text search last (most expensive)
          if (query) {
            const searchText = query.toLowerCase()
            filteredEntries = filteredEntries.filter(
              entry =>
                entry.title.toLowerCase().includes(searchText) ||
                entry.content.toLowerCase().includes(searchText) ||
                entry.summary.toLowerCase().includes(searchText) ||
                entry.tags.some((tag: string) => tag.toLowerCase().includes(searchText))
            )
          }

          // Sort by date (most recent first)
          filteredEntries.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )

          // Apply pagination
          const total = filteredEntries.length
          const offset = (page - 1) * pageSize
          const entries = filteredEntries.slice(offset, offset + pageSize)
          const hasMore = offset + pageSize < total

          resolve({ entries, total, hasMore })
        }

        request.onerror = () => reject(request.error)
      })
    }, 'Search Entries')
  }

  async searchEntriesOptimized(
    query: string,
    filters?: {
      tags?: string[]
      category?: string
      type?: 'text' | 'image' | 'page'
      dateFrom?: string
      dateTo?: string
    }
  ): Promise<ContentEntry[]> {
    // Legacy method for backward compatibility
    const result = await this.searchEntries(query, filters, 1, 1000)
    return result.entries
  }

  async getConfig(key: string): Promise<unknown> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONFIG_STORE], 'readonly')
      const store = transaction.objectStore(CONFIG_STORE)
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result?.value || null)
      request.onerror = () => reject(request.error)
    })
  }

  async setConfig(key: string, value: unknown): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONFIG_STORE], 'readwrite')
      const store = transaction.objectStore(CONFIG_STORE)
      const request = store.put({ key, value })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async exportData(): Promise<ContentEntry[]> {
    return this.getAllEntries()
  }

  async importData(entries: ContentEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.saveEntry(entry)
    }
  }

  async clearAllData(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getUserAgreement(): Promise<UserAgreement | null> {
    const result = await this.getConfig('userAgreement')
    return result as UserAgreement | null
  }

  async setUserAgreement(agreement: UserAgreement): Promise<void> {
    return this.setConfig('userAgreement', agreement)
  }
}

export const storageService = new StorageService()
