import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ContentEntry, SearchFilters } from '@/types'
import { ContentCard } from '@/components/ContentCard'
import { CaptureButton } from '@/components/CaptureButton'
import { SearchBar } from '@/components/SearchBar'
import { aiService } from '@/services/ai'
import { History, Plus, Settings } from 'lucide-react'

export const Popup: React.FC = () => {
  const [entries, setEntries] = useState<ContentEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<ContentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'capture' | 'history'>('capture')

  useEffect(() => {
    loadEntries()

    // Listen for new captures to update the popup live
    const handleMessage = async (message: { action: string; data?: ContentEntry }) => {
      if (message.action === 'contentCaptured') {
        console.log('Popup: New content captured, refreshing...')
        const newEntry = message.data
        
        // Reload entries to get the latest data
        await loadEntries()
        
        // Automatically enhance with AI if configured
        if (newEntry) {
          await autoEnhanceNewEntry(newEntry)
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    // Cleanup listener on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  const loadEntries = async () => {
    try {
      console.log('Popup: Sending getRecentEntries message...')
      const response = await chrome.runtime.sendMessage({
        action: 'getRecentEntries',
        limit: 5,
      })
      console.log('Popup: Received response:', response)
      if (response && response.success) {
        setEntries(response.data)
        setFilteredEntries(response.data) // Show recent entries in popup
      } else {
        console.error('Popup: Invalid response format:', response)
      }
    } catch (error) {
      console.error('Failed to load entries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCapture = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      if (!tab.id) return

      // Use background script's capture functions for page capture
      const response = await chrome.runtime.sendMessage({
        action: 'capturePage',
        tabId: tab.id,
      })
      
      if (response && !response.success && response.error) {
        // Show error message to user
        alert(response.error)
      }
    } catch (error) {
      console.error('Capture failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture page'
      alert(errorMessage)
    }
  }

  const handleSearch = async (query: string, filters: SearchFilters) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'searchEntries',
        query,
        filters,
        page: 1,
        pageSize: 5,
      })

      if (response.success) {
        setFilteredEntries(response.data.entries)
      }
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  const handleClearSearch = () => {
    setFilteredEntries(entries)
  }

  const handleDelete = async (id: string) => {
    try {
      await chrome.runtime.sendMessage({ action: 'deleteEntry', id })
      await loadEntries()
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handleView = () => {
    // Open side panel to view full details
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
  }

  const autoEnhanceNewEntry = async (entry: ContentEntry) => {
    try {
      console.log('🤖 Popup: Auto-enhancing new entry with AI:', entry.id)
      
      // Get AI settings
      const settingsResponse = await chrome.runtime.sendMessage({
        action: 'getSettings'
      })
      
      if (settingsResponse?.success) {
        const settings = settingsResponse.data
        
        // Only auto-enhance if OpenAI is configured
        if (settings.ai.provider === 'openai' && settings.ai.apiKey && settings.ai.enabled) {
          console.log('🚀 Popup: OpenAI configured, auto-enhancing entry...')
          await aiService.init(settings.ai)
          
          // Process content with AI (this runs in UI context, not service worker!)
          const aiResult = await aiService.processContent(entry.content, entry.type)
          
          // Update entry with AI results
          const enhancedEntry: ContentEntry = {
            ...entry,
            tags: aiResult.tags,
            summary: aiResult.summary,
            category: aiResult.category,
          }
          
          // Save enhanced entry
          await chrome.runtime.sendMessage({
            action: 'saveEntry',
            entry: enhancedEntry
          })
          
          // Update local state
          setEntries(prev => prev.map(e => e.id === entry.id ? enhancedEntry : e))
          setFilteredEntries(prev => prev.map(e => e.id === entry.id ? enhancedEntry : e))
          
          console.log('✅ Popup: Entry auto-enhanced successfully:', enhancedEntry)
        } else {
          console.log('ℹ️ Popup: OpenAI not configured, skipping auto-enhancement')
        }
      }
    } catch (error) {
      console.error('❌ Popup: Failed to auto-enhance entry with AI:', error)
    }
  }

  const openSidePanel = () => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
  }

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1>AI Content Capture</h1>
        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={openSidePanel}
            title="Open side panel"
          >
            <History size={16} />
          </button>
          <button className="btn-icon" onClick={openOptions} title="Settings">
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="popup-tabs">
        <button
          className={`tab ${activeTab === 'capture' ? 'active' : ''}`}
          onClick={() => setActiveTab('capture')}
        >
          <Plus size={16} />
          Capture
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} />
          Recent
        </button>
      </div>

      <div className="popup-content">
        {activeTab === 'capture' ? (
          <div className="capture-section">
            <CaptureButton onCapture={handleCapture} />
            <div className="capture-help">
              <p>Capture the entire page content or use keyboard shortcuts:</p>
              <ul>
                <li>
                  <kbd>Ctrl+Shift+P</kbd> - Capture page
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="history-section">
            <SearchBar onSearch={handleSearch} onClear={handleClearSearch} />
            <div className="entries-list">
              {filteredEntries.length === 0 ? (
                <div className="empty-state">
                  <p>No captured content yet.</p>
                  <p>Start by using the capture page button.</p>
                </div>
              ) : (
                filteredEntries.map(entry => (
                  <ContentCard
                    key={entry.id}
                    entry={entry}
                    onDelete={handleDelete}
                    onView={handleView}
                  />
                ))
              )}
            </div>
            {entries.length > 5 && (
              <button className="btn-secondary" onClick={openSidePanel}>
                View All ({entries.length})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Initialize the popup
const container = document.getElementById('popup-root')
if (container) {
  const root = createRoot(container)
  root.render(<Popup />)
}
