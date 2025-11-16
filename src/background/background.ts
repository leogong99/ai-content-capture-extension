import { storageService } from '@/services/storage'
import { aiService } from '@/services/ai'
import { ContentEntry, CaptureRequest, ExtensionSettings } from '@/types'
import { isRestrictedPage, getRestrictedPageErrorMessage } from '@/utils/url'

// Initialize storage and AI services
chrome.runtime.onInstalled.addListener(async () => {
  await storageService.init()

  // Set up context menu
  chrome.contextMenus.create({
    id: 'capture-selection',
    title: 'Capture Selection',
    contexts: ['selection'],
  })

  chrome.contextMenus.create({
    id: 'capture-image',
    title: 'Capture Image',
    contexts: ['image'],
  })

  chrome.contextMenus.create({
    id: 'capture-page',
    title: 'Capture Page',
    contexts: ['page'],
  })

  // Set up side panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return

  try {
    // Check if page is restricted before attempting capture
    if (tab.url && isRestrictedPage(tab.url)) {
      const errorMessage = getRestrictedPageErrorMessage(tab.url)
      console.warn('Cannot capture from restricted page:', tab.url)
      
      // Show notification to user
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Cannot Capture Content',
        message: errorMessage,
      })
      return
    }

    switch (info.menuItemId) {
      case 'capture-selection':
        await captureSelection(tab.id)
        break
      case 'capture-image':
        await captureImage(tab.id, info.srcUrl!)
        break
      case 'capture-page':
        await capturePage(tab.id)
        break
    }
  } catch (error) {
    console.error('Capture failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it's the specific restricted page error
    if (errorMessage.includes('extensions gallery') || errorMessage.includes('cannot be scripted')) {
      const message = tab?.url 
        ? getRestrictedPageErrorMessage(tab.url)
        : 'This page cannot be captured due to browser security restrictions.'
      
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Cannot Capture Content',
        message: message,
      })
    }
  }
})

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) return

  try {
    // Check if page is restricted before attempting capture
    if (tab.url && isRestrictedPage(tab.url)) {
      const errorMessage = getRestrictedPageErrorMessage(tab.url)
      console.warn('Cannot capture from restricted page:', tab.url)
      
      // Show notification to user
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Cannot Capture Content',
        message: errorMessage,
      })
      return
    }

    switch (command) {
      case 'capture-selection':
        await captureSelection(tab.id)
        break
      case 'capture-page':
        await capturePage(tab.id)
        break
    }
  } catch (error) {
    console.error('Command failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it's the specific restricted page error
    if (errorMessage.includes('extensions gallery') || errorMessage.includes('cannot be scripted')) {
      const message = tab?.url 
        ? getRestrictedPageErrorMessage(tab.url)
        : 'This page cannot be captured due to browser security restrictions.'
      
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Cannot Capture Content',
        message: message,
      })
    }
  }
})

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('Background script received message:', request)

  // Handle async operations properly
  ;(async () => {
    try {
      switch (request.action) {
        case 'captureContent': {
          const result = await processCaptureRequest(request.data)
          sendResponse({ success: true, data: result })
          break
        }

        case 'getEntries': {
          console.log('Getting entries from storage...')
          const entries = await storageService.getAllEntries()
          console.log('Retrieved entries:', entries)
          sendResponse({ success: true, data: entries })
          break
        }

        case 'getEntriesPaginated': {
          console.log('Getting paginated entries from storage...')
          const {
            page = 1,
            pageSize = 50,
            sortBy = 'date',
            sortOrder = 'desc',
          } = request
          const paginatedResult = await storageService.getEntriesPaginated(
            page,
            pageSize,
            sortBy,
            sortOrder
          )
          console.log('Retrieved paginated entries:', paginatedResult)
          sendResponse({ success: true, data: paginatedResult })
          break
        }

        case 'getRecentEntries': {
          console.log('Getting recent entries from storage...')
          const { limit = 10 } = request
          const recentEntries = await storageService.getRecentEntries(limit)
          console.log('Retrieved recent entries:', recentEntries)
          sendResponse({ success: true, data: recentEntries })
          break
        }

        case 'searchEntries': {
          const { query, filters, page = 1, pageSize = 50 } = request
          const searchResults = await storageService.searchEntries(
            query,
            filters,
            page,
            pageSize
          )
          sendResponse({ success: true, data: searchResults })
          break
        }


        case 'saveEntry': {
          await storageService.saveEntry(request.entry)
          sendResponse({ success: true })
          break
        }

        case 'deleteEntry': {
          await storageService.deleteEntry(request.id)
          sendResponse({ success: true })
          break
        }

        case 'getSettings': {
          const settings = await getSettings()
          sendResponse({ success: true, data: settings })
          break
        }

        case 'updateSettings': {
          await updateSettings(request.settings)
          sendResponse({ success: true })
          break
        }

        case 'exportData': {
          const exportData = await storageService.exportData()
          sendResponse({ success: true, data: exportData })
          break
        }

        case 'importData': {
          await storageService.importData(request.data)
          sendResponse({ success: true })
          break
        }

        case 'captureSelection': {
          try {
            if (request.tabId) {
              // Check if page is restricted before attempting capture
              const tab = await chrome.tabs.get(request.tabId).catch(() => null)
              if (tab?.url && isRestrictedPage(tab.url)) {
                const errorMessage = getRestrictedPageErrorMessage(tab.url)
                sendResponse({
                  success: false,
                  error: errorMessage,
                })
                return
              }
              
              await captureSelection(request.tabId)
              sendResponse({ success: true })
            } else {
              sendResponse({ success: false, error: 'No tab ID provided' })
            }
          } catch (error) {
            console.error('Text capture failed:', error)
            const errorMessage = error instanceof Error ? error.message : 'Text capture failed'
            
            // Check if it's the specific restricted page error
            if (errorMessage.includes('extensions gallery') || errorMessage.includes('cannot be scripted')) {
              const tab = await chrome.tabs.get(request.tabId).catch(() => null)
              const message = tab?.url 
                ? getRestrictedPageErrorMessage(tab.url)
                : 'This page cannot be captured due to browser security restrictions.'
              sendResponse({
                success: false,
                error: message,
              })
            } else {
              sendResponse({
                success: false,
                error: errorMessage,
              })
            }
          }
          break
        }

        case 'captureImage': {
          try {
            if (request.tabId) {
              // For image capture, we need the image URL from the context menu
              // This will be handled by the context menu click handler
              sendResponse({
                success: false,
                error: 'Image capture must be initiated from context menu',
              })
            } else {
              sendResponse({ success: false, error: 'No tab ID provided' })
            }
          } catch (error) {
            console.error('Image capture failed:', error)
            sendResponse({
              success: false,
              error:
                error instanceof Error ? error.message : 'Image capture failed',
            })
          }
          break
        }

        case 'capturePage': {
          try {
            if (request.tabId) {
              // Check if page is restricted before attempting capture
              const tab = await chrome.tabs.get(request.tabId).catch(() => null)
              if (tab?.url && isRestrictedPage(tab.url)) {
                const errorMessage = getRestrictedPageErrorMessage(tab.url)
                sendResponse({
                  success: false,
                  error: errorMessage,
                })
                return
              }
              
              await capturePage(request.tabId)
              sendResponse({ success: true })
            } else {
              sendResponse({ success: false, error: 'No tab ID provided' })
            }
          } catch (error) {
            console.error('Page capture failed:', error)
            const errorMessage = error instanceof Error ? error.message : 'Page capture failed'
            
            // Check if it's the specific restricted page error
            if (errorMessage.includes('extensions gallery') || errorMessage.includes('cannot be scripted')) {
              const tab = await chrome.tabs.get(request.tabId).catch(() => null)
              const message = tab?.url 
                ? getRestrictedPageErrorMessage(tab.url)
                : 'This page cannot be captured due to browser security restrictions.'
              sendResponse({
                success: false,
                error: message,
              })
            } else {
              sendResponse({
                success: false,
                error: errorMessage,
              })
            }
          }
          break
        }

        case 'clearAllData': {
          try {
            await storageService.clearAllData()
            sendResponse({ success: true })
          } catch (error) {
            console.error('Clear all data failed:', error)
            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Clear all data failed',
            })
          }
          break
        }

        case 'getEntry': {
          try {
            const { id } = request
            const entry = await storageService.getEntry(id)
            if (entry) {
              sendResponse({ success: true, data: entry })
            } else {
              sendResponse({ success: false, error: 'Entry not found' })
            }
          } catch (error) {
            console.error('Get entry failed:', error)
            sendResponse({
              success: false,
              error:
                error instanceof Error ? error.message : 'Get entry failed',
            })
          }
          break
        }

        case 'getUserAgreement': {
          try {
            const agreement = await storageService.getUserAgreement()
            sendResponse({ success: true, data: agreement })
          } catch (error) {
            console.error('Get user agreement failed:', error)
            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Get user agreement failed',
            })
          }
          break
        }

        case 'setUserAgreement': {
          try {
            await storageService.setUserAgreement(request.agreement)
            sendResponse({ success: true })
          } catch (error) {
            console.error('Set user agreement failed:', error)
            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Set user agreement failed',
            })
          }
          break
        }

        default:
          sendResponse({ success: false, error: 'Unknown action' })
      }
    } catch (error) {
      console.error('Message handler error:', error)
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })()

  return true // Keep message channel open for async response
})

async function captureSelection(tabId: number): Promise<void> {
  try {
    // Check if the page is restricted
    const tab = await chrome.tabs.get(tabId)
    if (tab.url && isRestrictedPage(tab.url)) {
      const errorMessage = getRestrictedPageErrorMessage(tab.url)
      console.warn('Cannot capture from restricted page:', tab.url)
      
      // Show notification to user
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Cannot Capture Content',
        message: errorMessage,
      })
      return
    }

    // First, ensure content script is injected
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js'],
    })

    // Then send message to content script
    await chrome.tabs.sendMessage(tabId, {
      action: 'captureSelection',
      data: {
        text: '', // Will be filled by content script
        title: '', // Will be filled by content script
        url: '', // Will be filled by content script
      },
    })
  } catch (error) {
    console.error('Failed to capture selection:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it's the specific restricted page error
    if (errorMessage.includes('extensions gallery') || errorMessage.includes('cannot be scripted')) {
      const tab = await chrome.tabs.get(tabId).catch(() => null)
      const message = tab?.url 
        ? getRestrictedPageErrorMessage(tab.url)
        : 'This page cannot be captured due to browser security restrictions.'
      
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Cannot Capture Content',
        message: message,
      })
    }
  }
}

async function captureImage(tabId: number, imageUrl: string): Promise<void> {
  try {
    // Check if the page is restricted
    const tab = await chrome.tabs.get(tabId)
    if (tab.url && isRestrictedPage(tab.url)) {
      const errorMessage = getRestrictedPageErrorMessage(tab.url)
      console.warn('Cannot capture from restricted page:', tab.url)
      
      // Show notification to user
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Cannot Capture Content',
        message: errorMessage,
      })
      return
    }

    // First, ensure content script is injected
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js'],
    })

    // Then send message to content script
    await chrome.tabs.sendMessage(tabId, {
      action: 'captureImage',
      data: {
        imageUrl: imageUrl,
        altText: '', // Will be filled by content script
        title: '', // Will be filled by content script
        url: '', // Will be filled by content script
      },
    })
  } catch (error) {
    console.error('Failed to capture image:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it's the specific restricted page error
    if (errorMessage.includes('extensions gallery') || errorMessage.includes('cannot be scripted')) {
      const tab = await chrome.tabs.get(tabId).catch(() => null)
      const message = tab?.url 
        ? getRestrictedPageErrorMessage(tab.url)
        : 'This page cannot be captured due to browser security restrictions.'
      
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Cannot Capture Content',
        message: message,
      })
    }
  }
}

async function capturePage(tabId: number): Promise<void> {
  try {
    // Check if the page is restricted
    const tab = await chrome.tabs.get(tabId)
    if (tab.url && isRestrictedPage(tab.url)) {
      const errorMessage = getRestrictedPageErrorMessage(tab.url)
      console.warn('Cannot capture from restricted page:', tab.url)
      
      // Show notification to user
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Cannot Capture Content',
        message: errorMessage,
      })
      return
    }

    // First, ensure content script is injected
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js'],
    })

    // Then send message to content script
    await chrome.tabs.sendMessage(tabId, {
      action: 'capturePage',
      data: {
        content: '', // Will be filled by content script
        title: '', // Will be filled by content script
        url: '', // Will be filled by content script
      },
    })
  } catch (error) {
    console.error('Failed to capture page:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it's the specific restricted page error
    if (errorMessage.includes('extensions gallery') || errorMessage.includes('cannot be scripted')) {
      const tab = await chrome.tabs.get(tabId).catch(() => null)
      const message = tab?.url 
        ? getRestrictedPageErrorMessage(tab.url)
        : 'This page cannot be captured due to browser security restrictions.'
      
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Cannot Capture Content',
        message: message,
      })
    }
  }
}

async function processCaptureRequest(
  request: CaptureRequest
): Promise<ContentEntry> {
  // For page captures, use page title as summary and headers as content
  let summary = request.content.substring(0, 100) + (request.content.length > 100 ? '...' : '')
  let content = request.content

  if (request.type === 'page') {
    // Use page title as summary
    summary = request.title
    // Use headers from metadata if available, otherwise use the content (which should be headers)
    const headersText = (request.metadata?.headersText as string) || request.content
    content = headersText || request.title
  }

  // Create content entry with basic processing (no AI in service worker)
  const entry: ContentEntry = {
    id: crypto.randomUUID(),
    title: request.title,
    url: request.url,
    content: content,
    tags: ['general'], // Basic tag, will be enhanced by UI
    summary: summary,
    category: 'General', // Basic category, will be enhanced by UI
    createdAt: new Date().toISOString(),
    type: request.type,
    metadata: request.metadata,
  }

  // Debug logging for image entries
  if (request.type === 'image') {
    console.log('Saving image entry:', {
      id: entry.id,
      title: entry.title,
      contentLength: entry.content.length,
      metadataImageUrl: entry.metadata?.imageUrl?.length,
      type: entry.type,
    })
  }

  // Save to storage
  await storageService.saveEntry(entry)

  // Invalidate omnibox cache
  recentEntriesCache = []
  cacheTimestamp = 0

  // Notify sidepanel about new content capture
  // Use a promise-based approach to handle the case where no listener exists
  chrome.runtime
    .sendMessage({ action: 'contentCaptured', data: entry })
    .then(() => {
      // Message was received by a listener
      console.log('Content capture notification sent successfully')
    })
    .catch(() => {
      // No listener available, this is normal if sidepanel/popup is not open
      console.log(
        'No listener for contentCaptured message (this is normal if UI is not open)'
      )
    })

  return entry
}

async function getSettings(): Promise<ExtensionSettings> {
  const defaultSettings: ExtensionSettings = {
    ai: {
      provider: 'local',
      enabled: true,
    },
    storage: {
      maxEntries: 10000, // Increased default limit
      autoCleanup: false, // Disabled by default to keep all records
      exportFormat: 'json',
    },
    theme: 'auto',
    userAgreement: {
      hasAgreed: false,
      version: '1.0',
    },
    omnibox: {
      keyword: '@capture',
      enabled: true,
      maxSuggestions: 8,
    },
  }

  const stored = await storageService.getConfig('settings')
  if (stored) {
    // Merge with defaults to ensure new fields are added
    const storedSettings = stored as ExtensionSettings
    const defaultOmnibox = defaultSettings.omnibox!
    return {
      ...defaultSettings,
      ...storedSettings,
      omnibox: {
        keyword: storedSettings.omnibox?.keyword || defaultOmnibox.keyword,
        enabled: storedSettings.omnibox?.enabled ?? defaultOmnibox.enabled,
        maxSuggestions: storedSettings.omnibox?.maxSuggestions || defaultOmnibox.maxSuggestions,
      },
    }
  }
  return defaultSettings
}

async function updateSettings(settings: ExtensionSettings): Promise<void> {
  await storageService.setConfig('settings', settings)
  await aiService.init(settings.ai)
}

// ============================================================================
// Omnibox Integration
// ============================================================================

// Cache for recent entries (performance optimization)
let recentEntriesCache: ContentEntry[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Set default suggestion
chrome.omnibox.setDefaultSuggestion({
  description: 'Search your captured content - Type to search or press Enter for recent'
})

// Handle input changes (as user types)
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  try {
    const suggestions = await getOmniboxSuggestions(text)
    suggest(suggestions)
  } catch (error) {
    console.error('Omnibox search error:', error)
    suggest([{
      content: text,
      description: 'Error: Could not search captures. Try opening the side panel.'
    }])
  }
})

// Handle when user selects a suggestion or presses Enter
chrome.omnibox.onInputEntered.addListener((text, _disposition) => {
  // Use callback form (not async/await) to preserve user gesture context
  // Get active tab's window ID - this is faster than getAll
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0 || !tabs[0].windowId) {
      console.error('Could not get active tab or window ID')
      // Fallback: try getCurrent
      chrome.windows.getCurrent((window) => {
        if (window?.id) {
          openSidePanelAndNavigate(window.id, text)
        }
      })
      return
    }

    const windowId = tabs[0].windowId
    openSidePanelAndNavigate(windowId, text)
  })
})

// Helper function to open side panel and navigate
function openSidePanelAndNavigate(windowId: number, text: string): void {
  // Open side panel immediately - must be called synchronously
  chrome.sidePanel.open({ windowId }).then(() => {
    console.log('Side panel opened')
    
    // After opening panel, handle navigation/search
    // Check if text is an entry ID (format: "entry:{id}")
    if (text.startsWith('entry:')) {
      const entryId = text.replace('entry:', '')
      console.log('Navigating to entry:', entryId)
      // Send navigation message after opening panel
      sendNavigationMessage(entryId)
    } else {
      // Open side panel with search query
      console.log('Searching for:', text)
      sendSearchMessage(text)
    }
  }).catch(err => {
    console.error('Failed to open side panel:', err)
  })
}

// Helper: Get suggestions based on query
async function getOmniboxSuggestions(
  query: string
): Promise<chrome.omnibox.SuggestResult[]> {
  const settings = await getSettings()
  const maxSuggestions = settings.omnibox?.maxSuggestions || 8

  // If no query, show recent entries
  if (!query.trim()) {
    const recent = await getRecentEntriesCached(maxSuggestions)
    
    if (recent.length === 0) {
      return [{
        content: '',
        description: 'No captures yet. Right-click content to capture!'
      }]
    }
    
    return recent.map(entry => ({
      content: `entry:${entry.id}`,
      description: formatSuggestionDescription(entry, true)
    }))
  }

  // Search entries
  const searchResults = await storageService.searchEntries(
    query,
    undefined,
    1,
    maxSuggestions
  )

  if (searchResults.entries.length === 0) {
    return [{
      content: query,
      description: `No matches found for "${query}". Press Enter to search in side panel.`
    }]
  }

  return searchResults.entries.map(entry => ({
    content: `entry:${entry.id}`,
    description: formatSuggestionDescription(entry, false, query)
  }))
}

// Helper: Get recent entries with caching
async function getRecentEntriesCached(limit: number): Promise<ContentEntry[]> {
  const now = Date.now()
  
  // Return cache if still valid
  if (recentEntriesCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
    return recentEntriesCache.slice(0, limit)
  }

  // Fetch fresh data
  recentEntriesCache = await storageService.getRecentEntries(limit)
  cacheTimestamp = now
  return recentEntriesCache
}

// Helper: Format suggestion description
function formatSuggestionDescription(
  entry: ContentEntry,
  isRecent: boolean = false,
  highlightQuery?: string
): string {
  const parts: string[] = []
  
  // Title (truncated to 50 chars)
  const title = entry.title.length > 50 
    ? entry.title.substring(0, 47) + '...'
    : entry.title
  parts.push(title)

  // Category and tags
  const meta = [
    entry.category,
    ...entry.tags.slice(0, 2)
  ].filter(Boolean).join(' • ')
  if (meta) parts.push(meta)

  // Domain from URL
  try {
    const domain = new URL(entry.url).hostname.replace('www.', '')
    parts.push(domain)
  } catch {
    // Invalid URL, skip
  }

  // Relative time
  const timeAgo = getRelativeTime(entry.createdAt)
  parts.push(timeAgo)

  // Content preview (if not recent or has query)
  if (!isRecent || highlightQuery) {
    const preview = entry.summary || entry.content.substring(0, 50)
    if (preview) {
      parts.push(preview + (preview.length >= 50 ? '...' : ''))
    }
  }

  return parts.join(' • ')
}

// Helper: Get relative time string
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  // Format date for older entries
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Helper: Send navigation message to side panel (called after panel is opened)
function sendNavigationMessage(entryId: string): void {
  // Retry sending message with exponential backoff
  let retries = 0
  const maxRetries = 5
  const sendMessage = async (): Promise<void> => {
    try {
      await chrome.runtime.sendMessage({
        action: 'navigateToEntry',
        entryId: entryId
      })
      console.log('Navigation message sent successfully')
    } catch (error) {
      retries++
      if (retries < maxRetries) {
        console.log(`Side panel not ready, retrying... (${retries}/${maxRetries})`)
        setTimeout(sendMessage, 200 * retries) // Exponential backoff: 200ms, 400ms, 600ms, etc.
      } else {
        console.error('Failed to send navigation message after retries:', error)
      }
    }
  }

  // Start sending after initial delay to allow side panel to load
  setTimeout(sendMessage, 300)
}

// Helper: Send search message to side panel (called after panel is opened)
function sendSearchMessage(query: string): void {
  // Retry sending message with exponential backoff
  let retries = 0
  const maxRetries = 5
  const sendMessage = async (): Promise<void> => {
    try {
      await chrome.runtime.sendMessage({
        action: 'searchInSidePanel',
        query: query
      })
      console.log('Search message sent successfully')
    } catch (error) {
      retries++
      if (retries < maxRetries) {
        console.log(`Side panel not ready, retrying... (${retries}/${maxRetries})`)
        setTimeout(sendMessage, 200 * retries)
      } else {
        console.error('Failed to send search message after retries:', error)
      }
    }
  }

  // Start sending after initial delay to allow side panel to load
  setTimeout(sendMessage, 300)
}
