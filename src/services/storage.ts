import { ContentEntry, } from '@/types';

const DB_NAME = 'AIContentCapture';
const DB_VERSION = 1;
const STORE_NAME = 'entries';
const CONFIG_STORE = 'config';

class StorageService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create entries store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const entriesStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          entriesStore.createIndex('url', 'url', { unique: false });
          entriesStore.createIndex('createdAt', 'createdAt', { unique: false });
          entriesStore.createIndex('category', 'category', { unique: false });
          entriesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }

        // Create config store
        if (!db.objectStoreNames.contains(CONFIG_STORE)) {
          db.createObjectStore(CONFIG_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  async saveEntry(entry: ContentEntry): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getEntry(id: string): Promise<ContentEntry | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllEntries(): Promise<ContentEntry[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteEntry(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async searchEntries(query: string, filters?: {
    tags?: string[];
    category?: string;
    type?: 'text' | 'image' | 'page';
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ContentEntry[]> {
    const allEntries = await this.getAllEntries();
    
    return allEntries.filter(entry => {
      // Text search
      if (query) {
        const searchText = query.toLowerCase();
        const matchesText = 
          entry.title.toLowerCase().includes(searchText) ||
          entry.content.toLowerCase().includes(searchText) ||
          entry.summary.toLowerCase().includes(searchText) ||
          entry.tags.some(tag => tag.toLowerCase().includes(searchText));
        
        if (!matchesText) return false;
      }

      // Tag filter
      if (filters?.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(filterTag =>
          entry.tags.some(entryTag => 
            entryTag.toLowerCase().includes(filterTag.toLowerCase())
          )
        );
        if (!hasMatchingTag) return false;
      }

      // Category filter
      if (filters?.category && entry.category !== filters.category) {
        return false;
      }

      // Type filter
      if (filters?.type && entry.type !== filters.type) {
        return false;
      }

      // Date filters
      if (filters?.dateFrom) {
        const entryDate = new Date(entry.createdAt);
        const fromDate = new Date(filters.dateFrom);
        if (entryDate < fromDate) return false;
      }

      if (filters?.dateTo) {
        const entryDate = new Date(entry.createdAt);
        const toDate = new Date(filters.dateTo);
        if (entryDate > toDate) return false;
      }

      return true;
    });
  }

  async getConfig(key: string): Promise<any> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONFIG_STORE], 'readonly');
      const store = transaction.objectStore(CONFIG_STORE);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  }

  async setConfig(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONFIG_STORE], 'readwrite');
      const store = transaction.objectStore(CONFIG_STORE);
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async exportData(): Promise<ContentEntry[]> {
    return this.getAllEntries();
  }

  async importData(entries: ContentEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.saveEntry(entry);
    }
  }

  async clearAllData(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const storageService = new StorageService();
