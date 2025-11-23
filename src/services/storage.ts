import { ContentEntry, UserAgreement, ExtensionSettings, DuplicateMatch } from '@/types'
import { performanceMonitor, measureAsyncOperation } from '@/utils/performance'
import { similarityService } from './similarity'

const DB_NAME = 'AIContentCapture'
const DB_VERSION = 1
const STORE_NAME = 'entries'
const CONFIG_STORE = 'config'

// Chrome storage sync constants
const SYNC_STORAGE_PREFIX = 'entry_'
const SYNC_STORAGE_INDEX_KEY = 'entries_index'
const SYNC_STORAGE_CONFIG_PREFIX = 'config_'
const MAX_CHUNK_SIZE = 7000 // Leave room under 8KB limit for JSON overhead
const SYNC_QUOTA_BYTES = 100 * 1024 // 100KB total limit

interface EntryChunk {
  id: string
  chunkIndex: number
  totalChunks: number
  data: string // JSON stringified portion of entry
}

interface EntryIndex {
  [entryId: string]: {
    chunkKeys: string[]
    metadata: {
      id: string
      title: string
      url: string
      createdAt: string
      category: string
      tags: string[]
      summary: string
      type: 'text' | 'image' | 'page'
    }
  }
}

class StorageService {
  private db: IDBDatabase | null = null
  private useSyncStorage: boolean = true

  async init(): Promise<void> {
    // Initialize IndexedDB (used as local cache)
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = async () => {
        this.db = request.result
        
        // Check if IndexedDB is empty - if so, sync from chrome.storage.sync
        const isEmpty = await this.isIndexedDBEmpty()
        if (isEmpty) {
          console.log('IndexedDB is empty, syncing from chrome.storage.sync...')
          try {
            await this.syncFromChromeStorage()
            console.log('Sync from chrome.storage.sync completed')
          } catch (err) {
            console.error('Failed to sync from chrome storage on init:', err)
            // Don't reject - allow extension to work with empty storage
          }
        } else {
          // IndexedDB has data, but still sync to ensure we have latest from cloud
          this.syncFromChromeStorage().catch(err => {
            console.warn('Background sync from chrome storage failed:', err)
          })
        }
        
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

  // Helper: Check if IndexedDB is empty
  private async isIndexedDBEmpty(): Promise<boolean> {
    if (!this.db) return true

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.count()

      request.onsuccess = () => resolve(request.result === 0)
      request.onerror = () => resolve(true) // Assume empty on error
    })
  }

  // Helper: Check if chrome.storage.sync is available
  private async checkSyncStorageAvailable(): Promise<boolean> {
    try {
      await chrome.storage.sync.getBytesInUse(null)
      return true
    } catch {
      return false
    }
  }

  // Helper: Split entry into chunks for sync storage
  private splitEntryIntoChunks(entry: ContentEntry): EntryChunk[] {
    const entryJson = JSON.stringify(entry)
    const chunks: EntryChunk[] = []
    const totalChunks = Math.ceil(entryJson.length / MAX_CHUNK_SIZE)

    for (let i = 0; i < totalChunks; i++) {
      const start = i * MAX_CHUNK_SIZE
      const end = Math.min(start + MAX_CHUNK_SIZE, entryJson.length)
      chunks.push({
        id: entry.id,
        chunkIndex: i,
        totalChunks,
        data: entryJson.substring(start, end),
      })
    }

    return chunks
  }

  // Helper: Reconstruct entry from chunks
  private reconstructEntryFromChunks(chunks: EntryChunk[]): ContentEntry | null {
    if (chunks.length === 0) return null

    // Sort chunks by index
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)

    // Verify all chunks are present
    if (chunks.length !== chunks[0].totalChunks) {
      console.warn(`Missing chunks for entry ${chunks[0].id}`)
      return null
    }

    // Reconstruct JSON string
    const entryJson = chunks.map(chunk => chunk.data).join('')
    return JSON.parse(entryJson) as ContentEntry
  }

  // Helper: Get entry index from sync storage
  private async getEntryIndex(): Promise<EntryIndex> {
    try {
      const result = await chrome.storage.sync.get(SYNC_STORAGE_INDEX_KEY)
      return (result[SYNC_STORAGE_INDEX_KEY] as EntryIndex) || {}
    } catch {
      return {}
    }
  }

  // Helper: Update entry index in sync storage
  private async updateEntryIndex(index: EntryIndex): Promise<void> {
    await chrome.storage.sync.set({ [SYNC_STORAGE_INDEX_KEY]: index })
  }

  // Helper: Sync entries from chrome.storage.sync to IndexedDB
  private async syncFromChromeStorage(): Promise<void> {
    if (!this.useSyncStorage || !(await this.checkSyncStorageAvailable())) {
      console.log('Sync storage not available')
      return
    }

    try {
      const index = await this.getEntryIndex()
      const entryIds = Object.keys(index)
      
      console.log(`Syncing ${entryIds.length} entries from chrome.storage.sync...`)
      
      if (entryIds.length === 0) {
        console.log('No entries in sync storage index')
        return
      }

      let syncedCount = 0
      for (const entryId of entryIds) {
        const entryInfo = index[entryId]
        const chunkKeys = entryInfo.chunkKeys

        // Get all chunks
        const chunksData = await chrome.storage.sync.get(chunkKeys)
        const chunks: EntryChunk[] = []

        for (const key of chunkKeys) {
          const chunk = chunksData[key] as EntryChunk | undefined
          if (chunk) {
            chunks.push(chunk)
          } else {
            console.warn(`Missing chunk ${key} for entry ${entryId}`)
          }
        }

        // Reconstruct entry
        const entry = this.reconstructEntryFromChunks(chunks)
        if (entry && this.db) {
          // Save to IndexedDB (local cache)
          await new Promise<void>((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.put(entry)
            request.onsuccess = () => {
              syncedCount++
              resolve()
            }
            request.onerror = () => reject(request.error)
          })
        } else {
          console.warn(`Failed to reconstruct entry ${entryId} from chunks`)
        }
      }
      
      console.log(`Successfully synced ${syncedCount} entries from chrome.storage.sync`)
    } catch (error) {
      console.error('Failed to sync from chrome storage:', error)
      throw error // Re-throw so caller knows sync failed
    }
  }

  async saveEntry(entry: ContentEntry): Promise<void> {
    if (!this.db) await this.init()

    // Save to IndexedDB (local cache) first for fast access
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(entry)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    // Also save to chrome.storage.sync for cross-device sync
    if (this.useSyncStorage) {
      const syncAvailable = await this.checkSyncStorageAvailable()
      if (syncAvailable) {
        try {
          await this.saveEntryToSyncStorage(entry)
        } catch (error) {
          console.error('Failed to save entry to sync storage:', error)
          // Log detailed error for debugging
          if (error instanceof Error) {
            console.error('Error details:', error.message, error.stack)
          }
          // Continue even if sync fails - local storage still works
          // But we should notify the user somehow
        }
      } else {
        console.warn('Chrome sync storage not available. User may not be signed into Chrome.')
      }
    }

    // Check storage limits after saving
    await this.enforceStorageLimits()
  }

  // Helper: Save entry to chrome.storage.sync with chunking
  private async saveEntryToSyncStorage(entry: ContentEntry): Promise<void> {
    console.log(`Saving entry ${entry.id} to chrome.storage.sync...`)
    
    // Check available space
    const bytesInUse = await chrome.storage.sync.getBytesInUse(null)
    const entrySize = JSON.stringify(entry).length

    console.log(`Sync storage usage: ${bytesInUse} bytes / ${SYNC_QUOTA_BYTES} bytes`)

    // Warn if approaching quota (but still try to save)
    if (bytesInUse + entrySize > SYNC_QUOTA_BYTES * 0.9) {
      console.warn('Sync storage quota approaching limit. Consider cleaning up old entries.')
    }

    // Split entry into chunks
    const chunks = this.splitEntryIntoChunks(entry)
    const chunkKeys = chunks.map(
      chunk => `${SYNC_STORAGE_PREFIX}${entry.id}_${chunk.chunkIndex}`
    )

    console.log(`Saving ${chunks.length} chunks for entry ${entry.id}`)

    // Prepare data to save
    const dataToSave: Record<string, EntryChunk> = {}
    chunks.forEach((chunk, index) => {
      dataToSave[chunkKeys[index]] = chunk
    })

    // Save chunks
    await chrome.storage.sync.set(dataToSave)
    
    // Verify chunks were saved
    const verifyData = await chrome.storage.sync.get(chunkKeys)
    const savedChunks = Object.keys(verifyData).filter(key => verifyData[key] !== undefined)
    if (savedChunks.length !== chunkKeys.length) {
      throw new Error(`Failed to save all chunks. Expected ${chunkKeys.length}, saved ${savedChunks.length}`)
    }
    console.log(`Verified ${savedChunks.length} chunks saved to sync storage`)

    // Update entry index
    const index = await this.getEntryIndex()
    index[entry.id] = {
      chunkKeys,
      metadata: {
        id: entry.id,
        title: entry.title,
        url: entry.url,
        createdAt: entry.createdAt,
        category: entry.category,
        tags: entry.tags,
        summary: entry.summary,
        type: entry.type,
      },
    }
    await this.updateEntryIndex(index)
    
    // Verify index was saved
    const verifyIndex = await this.getEntryIndex()
    if (!verifyIndex[entry.id]) {
      throw new Error('Failed to save entry to index')
    }
    console.log(`Entry ${entry.id} successfully saved to chrome.storage.sync`)
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

    // Delete from IndexedDB
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    // Also delete from chrome.storage.sync
    if (this.useSyncStorage && (await this.checkSyncStorageAvailable())) {
      try {
        await this.deleteEntryFromSyncStorage(id)
      } catch (error) {
        console.warn('Failed to delete entry from sync storage:', error)
      }
    }
  }

  // Helper: Delete entry from chrome.storage.sync
  private async deleteEntryFromSyncStorage(entryId: string): Promise<void> {
    const index = await this.getEntryIndex()
    const entryInfo = index[entryId]

    if (entryInfo) {
      // Delete all chunks
      await chrome.storage.sync.remove(entryInfo.chunkKeys)

      // Remove from index
      delete index[entryId]
      await this.updateEntryIndex(index)
    }
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
    // Try sync storage first (for cross-device sync)
    if (this.useSyncStorage && (await this.checkSyncStorageAvailable())) {
      try {
        const syncKey = `${SYNC_STORAGE_CONFIG_PREFIX}${key}`
        const result = await chrome.storage.sync.get(syncKey)
        if (result[syncKey] !== undefined) {
          // Also cache in IndexedDB for fast access
          if (!this.db) await this.init()
          await new Promise<void>((resolve) => {
            const transaction = this.db!.transaction([CONFIG_STORE], 'readwrite')
            const store = transaction.objectStore(CONFIG_STORE)
            store.put({ key, value: result[syncKey] })
            transaction.oncomplete = () => resolve()
          })
          return result[syncKey]
        }
      } catch (error) {
        console.warn('Failed to get config from sync storage:', error)
      }
    }

    // Fallback to IndexedDB
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
    // Save to IndexedDB (local cache)
    if (!this.db) await this.init()

    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([CONFIG_STORE], 'readwrite')
      const store = transaction.objectStore(CONFIG_STORE)
      const request = store.put({ key, value })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    // Also save to chrome.storage.sync for cross-device sync
    if (this.useSyncStorage && (await this.checkSyncStorageAvailable())) {
      try {
        const syncKey = `${SYNC_STORAGE_CONFIG_PREFIX}${key}`
        await chrome.storage.sync.set({ [syncKey]: value })
      } catch (error) {
        console.warn('Failed to save config to sync storage:', error)
      }
    }
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

    // Clear IndexedDB
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    // Also clear chrome.storage.sync
    if (this.useSyncStorage && (await this.checkSyncStorageAvailable())) {
      try {
        // Get all entry keys from index
        const index = await this.getEntryIndex()
        const allChunkKeys: string[] = []
        Object.values(index).forEach(entryInfo => {
          allChunkKeys.push(...entryInfo.chunkKeys)
        })

        // Remove all chunks and index
        await chrome.storage.sync.remove([...allChunkKeys, SYNC_STORAGE_INDEX_KEY])
      } catch (error) {
        console.warn('Failed to clear sync storage:', error)
      }
    }
  }

  async getUserAgreement(): Promise<UserAgreement | null> {
    const result = await this.getConfig('userAgreement')
    return result as UserAgreement | null
  }

  async setUserAgreement(agreement: UserAgreement): Promise<void> {
    return this.setConfig('userAgreement', agreement)
  }

  // Get sync storage status and usage
  async getSyncStatus(): Promise<{
    available: boolean
    bytesInUse: number
    quotaBytes: number
    usagePercent: number
  }> {
    const available = await this.checkSyncStorageAvailable()
    if (!available) {
      return {
        available: false,
        bytesInUse: 0,
        quotaBytes: SYNC_QUOTA_BYTES,
        usagePercent: 0,
      }
    }

    try {
      const bytesInUse = await chrome.storage.sync.getBytesInUse(null)
      const usagePercent = (bytesInUse / SYNC_QUOTA_BYTES) * 100
      return {
        available: true,
        bytesInUse,
        quotaBytes: SYNC_QUOTA_BYTES,
        usagePercent: Math.round(usagePercent * 100) / 100,
      }
    } catch (error) {
      console.error('Failed to get sync status:', error)
      return {
        available: false,
        bytesInUse: 0,
        quotaBytes: SYNC_QUOTA_BYTES,
        usagePercent: 0,
      }
    }
  }

  // Initialize sync listener for cross-device updates
  initSyncListener(): void {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && this.useSyncStorage) {
          // Handle entry index changes
          if (changes[SYNC_STORAGE_INDEX_KEY]) {
            console.log('Entry index changed in sync storage, syncing...')
            this.syncFromChromeStorage().catch(err => {
              console.error('Failed to sync after index change:', err)
            })
          }

          // Handle entry chunk changes
          const entryChunkKeys = Object.keys(changes).filter(key =>
            key.startsWith(SYNC_STORAGE_PREFIX)
          )
          if (entryChunkKeys.length > 0) {
            console.log('Entry chunks changed in sync storage, syncing...')
            this.syncFromChromeStorage().catch(err => {
              console.error('Failed to sync after chunk change:', err)
            })
          }

          // Handle config changes
          const configKeys = Object.keys(changes).filter(key =>
            key.startsWith(SYNC_STORAGE_CONFIG_PREFIX)
          )
          if (configKeys.length > 0) {
            console.log('Config changed in sync storage, updating local cache...')
            configKeys.forEach(async key => {
              const configKey = key.replace(SYNC_STORAGE_CONFIG_PREFIX, '')
              const newValue = changes[key].newValue
              if (newValue !== undefined && this.db) {
                await new Promise<void>((resolve) => {
                  const transaction = this.db!.transaction([CONFIG_STORE], 'readwrite')
                  const store = transaction.objectStore(CONFIG_STORE)
                  store.put({ key: configKey, value: newValue })
                  transaction.oncomplete = () => resolve()
                })
              }
            })
          }
        }
      })
    }
  }

  /**
   * Find potential duplicates for a new entry
   */
  async findPotentialDuplicates(
    entry: ContentEntry,
    threshold?: number
  ): Promise<DuplicateMatch[]> {
    if (!this.db) await this.init()

    // Get settings to determine threshold
    const settings = await this.getConfig('settings') as ExtensionSettings | null
    const duplicateConfig = settings?.duplicateDetection
    const similarityThreshold = threshold ?? duplicateConfig?.similarityThreshold ?? 0.8

    // Get all existing entries
    const allEntries = await this.getAllEntries()

    // Use similarity service to find duplicates
    return similarityService.findDuplicates(entry, allEntries, similarityThreshold)
  }

  /**
   * Merge two entries intelligently
   * @param sourceId - ID of entry to merge from (will be deleted)
   * @param targetId - ID of entry to merge into (will be kept)
   */
  async mergeEntries(sourceId: string, targetId: string): Promise<ContentEntry> {
    if (!this.db) await this.init()

    // Get both entries
    const source = await this.getEntry(sourceId)
    const target = await this.getEntry(targetId)

    if (!source) {
      throw new Error(`Source entry ${sourceId} not found`)
    }
    if (!target) {
      throw new Error(`Target entry ${targetId} not found`)
    }

    // Merge strategy:
    // - Keep target's ID, URL, type
    // - Use earliest createdAt
    // - Combine tags (unique)
    // - Combine summaries (if different, append)
    // - Merge metadata intelligently
    // - Keep longer content if different

    const mergedEntry: ContentEntry = {
      id: target.id, // Keep target ID
      title: target.title || source.title, // Prefer target title
      url: target.url, // Keep target URL
      type: target.type, // Keep target type
      createdAt: new Date(source.createdAt) < new Date(target.createdAt)
        ? source.createdAt
        : target.createdAt, // Earliest date
      // Combine tags (unique)
      tags: [
        ...new Set([...target.tags, ...source.tags])
      ],
      // Combine summaries if different
      summary: target.summary === source.summary
        ? target.summary
        : `${target.summary}\n\n${source.summary}`,
      // Keep category from target, or source if target doesn't have one
      category: target.category || source.category,
      // Keep longer content
      content: target.content.length >= source.content.length
        ? target.content
        : source.content,
      // Merge metadata
      metadata: {
        ...source.metadata,
        ...target.metadata,
        // Preserve both page titles if different
        pageTitle: target.metadata?.pageTitle || source.metadata?.pageTitle,
        // Preserve both selection texts if different
        selectionText: target.metadata?.selectionText || source.metadata?.selectionText,
        // Preserve both headers
        headers: [
          ...(target.metadata?.headers || []),
          ...(source.metadata?.headers || [])
        ].filter((v, i, a) => a.indexOf(v) === i), // Unique headers
        headersText: [
          target.metadata?.headersText,
          source.metadata?.headersText
        ].filter(Boolean).join('\n\n'),
        // Preserve study notes from target, or source if target doesn't have any
        studyNotes: target.metadata?.studyNotes || source.metadata?.studyNotes,
      },
    }

    // Save merged entry
    await this.saveEntry(mergedEntry)

    // Delete source entry
    await this.deleteEntry(sourceId)

    return mergedEntry
  }
}

export const storageService = new StorageService()

// Initialize sync listener when module loads (for background script)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  storageService.initSyncListener()
}
