// Test utilities and helpers
import { ContentEntry, AIConfig, ExtensionSettings } from '@/types'

export const createMockContentEntry = (overrides: Partial<ContentEntry> = {}) => ({
  id: 'test-id-123',
  title: 'Test Content',
  url: 'https://example.com',
  content: 'This is test content for testing purposes.',
  tags: ['test', 'example'],
  summary: 'A test content entry for testing.',
  category: 'Test',
  createdAt: new Date().toISOString(),
  type: 'text' as const,
  metadata: {},
  ...overrides,
})

export const createMockAIConfig = (overrides: Partial<AIConfig> = {}) => ({
  provider: 'local' as const,
  enabled: true,
  ...overrides,
})

export const createMockSettings = (overrides: Partial<ExtensionSettings> = {}) => ({
  ai: createMockAIConfig(),
  storage: {
    maxEntries: 10000, // Increased default limit
    autoCleanup: false, // Disabled by default to keep all records
    exportFormat: 'json' as const,
  },
  theme: 'auto' as const,
  ...overrides,
})

// Mock Chrome APIs for testing
export const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  contextMenus: {
    create: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
  },
  sidePanel: {
    setPanelBehavior: jest.fn(),
    open: jest.fn(),
  },
  commands: {
    onCommand: {
      addListener: jest.fn(),
    },
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
}

// Test data generators
export const generateTestEntries = (count: number) => {
  return Array.from({ length: count }, (_, i) =>
    createMockContentEntry({
      id: `test-${i}`,
      title: `Test Entry ${i + 1}`,
      content: `This is test content number ${i + 1}.`,
      tags: [`tag${i}`, 'test'],
      category: i % 2 === 0 ? 'Technology' : 'News',
      type: (['text', 'image', 'page'] as const)[i % 3],
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    })
  )
}
