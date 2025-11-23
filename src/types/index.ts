export interface StudyNotes {
  briefSummary: string
  detailedSummary: string
  bulletPoints: string[]
  keyPoints: string[]
  questions: string[]
  actionItems: string[]
  generatedAt: string
  detailLevel: 'brief' | 'detailed' | 'bullets'
}

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
    studyNotes?: StudyNotes
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

export interface OmniboxConfig {
  keyword: string
  enabled: boolean
  maxSuggestions: number
}

export interface ExtensionSettings {
  ai: AIConfig
  storage: StorageConfig
  theme: 'light' | 'dark' | 'auto'
  userAgreement: UserAgreement
  omnibox?: OmniboxConfig
  duplicateDetection?: DuplicateDetectionConfig
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

export interface DuplicateMatch {
  entry: ContentEntry
  similarity: number
  matchType: 'exact' | 'near-duplicate' | 'url' | 'content'
  reason: string
}

export interface DuplicateDetectionConfig {
  enabled: boolean
  autoBlockExact: boolean
  similarityThreshold: number
  checkOnSave: boolean
}
