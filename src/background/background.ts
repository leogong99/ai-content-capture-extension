import { storageService } from '@/services/storage';
import { aiService } from '@/services/ai';
import { ContentEntry, CaptureRequest, ExtensionSettings } from '@/types';

// Initialize storage and AI services
chrome.runtime.onInstalled.addListener(async () => {
  await storageService.init();
  
  // Set up context menu
  chrome.contextMenus.create({
    id: 'capture-selection',
    title: 'Capture Selection',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'capture-image',
    title: 'Capture Image',
    contexts: ['image']
  });


  chrome.contextMenus.create({
    id: 'capture-page',
    title: 'Capture Page',
    contexts: ['page']
  });

  // Set up side panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  try {
    switch (info.menuItemId) {
      case 'capture-selection':
        await captureSelection(tab.id);
        break;
      case 'capture-image':
        await captureImage(tab.id, info.srcUrl!);
        break;
      case 'capture-page':
        await capturePage(tab.id);
        break;
    }
  } catch (error) {
    console.error('Capture failed:', error);
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) return;

  try {
    switch (command) {
      case 'capture-selection':
        await captureSelection(tab.id);
        break;
      case 'capture-page':
        await capturePage(tab.id);
        break;
    }
  } catch (error) {
    console.error('Command failed:', error);
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  // Handle async operations properly
  (async () => {
    try {
      switch (request.action) {
        case 'captureContent':
          const result = await processCaptureRequest(request.data);
          sendResponse({ success: true, data: result });
          break;
        
        case 'getEntries':
          console.log('Getting entries from storage...');
          const entries = await storageService.getAllEntries();
          console.log('Retrieved entries:', entries);
          sendResponse({ success: true, data: entries });
          break;
        
        case 'searchEntries':
          const searchResults = await storageService.searchEntries(
            request.query,
            request.filters
          );
          sendResponse({ success: true, data: searchResults });
          break;
        
        case 'deleteEntry':
          await storageService.deleteEntry(request.id);
          sendResponse({ success: true });
          break;
        
        case 'getSettings':
          const settings = await getSettings();
          sendResponse({ success: true, data: settings });
          break;
        
        case 'updateSettings':
          await updateSettings(request.settings);
          sendResponse({ success: true });
          break;
        
        case 'exportData':
          const exportData = await storageService.exportData();
          sendResponse({ success: true, data: exportData });
          break;
        
        case 'importData':
          await storageService.importData(request.data);
          sendResponse({ success: true });
          break;
        
        case 'captureSelection':
          try {
            if (request.tabId) {
              await captureSelection(request.tabId);
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'No tab ID provided' });
            }
          } catch (error) {
            console.error('Text capture failed:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : 'Text capture failed' });
          }
          break;
        
        case 'clearAllData':
          try {
            await storageService.clearAllData();
            sendResponse({ success: true });
          } catch (error) {
            console.error('Clear all data failed:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : 'Clear all data failed' });
          }
          break;
        
        case 'getUserAgreement':
          try {
            const agreement = await storageService.getUserAgreement();
            sendResponse({ success: true, data: agreement });
          } catch (error) {
            console.error('Get user agreement failed:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : 'Get user agreement failed' });
          }
          break;
        
        case 'setUserAgreement':
          try {
            await storageService.setUserAgreement(request.agreement);
            sendResponse({ success: true });
          } catch (error) {
            console.error('Set user agreement failed:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : 'Set user agreement failed' });
          }
          break;
        
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  })();
  
  return true; // Keep message channel open for async response
});

async function captureSelection(tabId: number): Promise<void> {
  try {
    // First, ensure content script is injected
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    // Then send message to content script
    await chrome.tabs.sendMessage(tabId, {
      action: 'captureSelection',
      data: {
        text: '', // Will be filled by content script
        title: '', // Will be filled by content script
        url: '' // Will be filled by content script
      }
    });
  } catch (error) {
    console.error('Failed to capture selection:', error);
  }
}

async function captureImage(tabId: number, imageUrl: string): Promise<void> {
  try {
    // First, ensure content script is injected
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    // Then send message to content script
    await chrome.tabs.sendMessage(tabId, {
      action: 'captureImage',
      data: {
        imageUrl: imageUrl,
        altText: '', // Will be filled by content script
        title: '', // Will be filled by content script
        url: '' // Will be filled by content script
      }
    });
  } catch (error) {
    console.error('Failed to capture image:', error);
  }
}


async function capturePage(tabId: number): Promise<void> {
  try {
    // First, ensure content script is injected
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    // Then send message to content script
    await chrome.tabs.sendMessage(tabId, {
      action: 'capturePage',
      data: {
        content: '', // Will be filled by content script
        title: '', // Will be filled by content script
        url: '' // Will be filled by content script
      }
    });
  } catch (error) {
    console.error('Failed to capture page:', error);
  }
}

async function processCaptureRequest(request: CaptureRequest): Promise<ContentEntry> {
  // Get AI settings
  const settings = await getSettings();
  await aiService.init(settings.ai);

  // Process content with AI
  const aiResult = await aiService.processContent(request.content, request.type);

  // Create content entry
  const entry: ContentEntry = {
    id: crypto.randomUUID(),
    title: request.title,
    url: request.url,
    content: request.content,
    tags: aiResult.tags,
    summary: aiResult.summary,
    category: aiResult.category,
    createdAt: new Date().toISOString(),
    type: request.type,
    metadata: request.metadata
  };

  // Debug logging for image entries
  if (request.type === 'image') {
    console.log('Saving image entry:', {
      id: entry.id,
      title: entry.title,
      contentLength: entry.content.length,
      metadataImageUrl: entry.metadata?.imageUrl?.length,
      type: entry.type
    });
  }

  // Save to storage
  await storageService.saveEntry(entry);

  // Notify sidepanel about new content capture
  try {
    chrome.runtime.sendMessage({ action: 'contentCaptured', data: entry });
  } catch (error) {
    // Sidepanel might not be open, ignore error
    console.log('Could not notify sidepanel:', error);
  }

  return entry;
}

async function getSettings(): Promise<ExtensionSettings> {
  const defaultSettings: ExtensionSettings = {
    ai: {
      provider: 'local',
      enabled: true
    },
    storage: {
      maxEntries: 1000,
      autoCleanup: true,
      exportFormat: 'json'
    },
    theme: 'auto',
    userAgreement: {
      hasAgreed: false,
      version: '1.0'
    }
  };

  const stored = await storageService.getConfig('settings');
  return stored || defaultSettings;
}

async function updateSettings(settings: ExtensionSettings): Promise<void> {
  await storageService.setConfig('settings', settings);
  await aiService.init(settings.ai);
}
