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
  }

  const stored = await storageService.getConfig('settings')
  return (stored as ExtensionSettings) || defaultSettings
}

async function updateSettings(settings: ExtensionSettings): Promise<void> {
  await storageService.setConfig('settings', settings)
  await aiService.init(settings.ai)
}
