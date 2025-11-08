export interface ContentEntry {
  id: string
  title: string
  url: string
  content: string
  tags: string[]
  summary: string
  category: string
  createdAt: string
  type: 'text' | 'image' | 'page'
  metadata?: {
    imageUrl?: string
    altText?: string
    pageTitle?: string
    selectionText?: string
    headers?: string[]
    headersText?: string
    htmlContent?: string
    wordCount?: number
  }
}

export interface SearchFilters {
  query?: string
  tags?: string[]
  category?: string
  dateFrom?: string
  dateTo?: string
  type?: 'text' | 'image' | 'page'
}

export interface AIConfig {
  provider: 'openai' | 'local'
  apiKey?: string
  model?: string
  enabled: boolean
}

export interface StorageConfig {
  maxEntries: number
  autoCleanup: boolean
  exportFormat: 'json' | 'csv'
}

export interface UserAgreement {
  hasAgreed: boolean
  agreedAt?: string
  version: string
}

export interface ExtensionSettings {
  ai: AIConfig
  storage: StorageConfig
  theme: 'light' | 'dark' | 'auto'
  userAgreement: UserAgreement
}

export interface CaptureRequest {
  type: 'text' | 'image' | 'page'
  content: string
  url: string
  title: string
  metadata?: Record<string, unknown>
}

export interface AITaggingResult {
  summary: string
  tags: string[]
  category: string
  confidence: number
}
