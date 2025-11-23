import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ContentEntry, SearchFilters, DuplicateMatch } from '@/types'
import { ContentCard } from '@/components/ContentCard'
import { CaptureButton } from '@/components/CaptureButton'
import { SearchBar } from '@/components/SearchBar'
import { DuplicateWarning } from '@/components/DuplicateWarning'
import { aiService } from '@/services/ai'
import { History, Plus, Settings } from 'lucide-react'

export const Popup: React.FC = () => {
  const [entries, setEntries] = useState<ContentEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<ContentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'capture' | 'history'>('capture')
  const [duplicateWarning, setDuplicateWarning] = useState<{
    entry: ContentEntry
    duplicates: DuplicateMatch[]
  } | null>(null)
  const [generatingNotesFor, setGeneratingNotesFor] = useState<string | null>(null)
  const [isOpenAIConfigured, setIsOpenAIConfigured] = useState(false)

  useEffect(() => {
    loadEntries()
    checkOpenAIConfiguration()

    // Listen for new captures to update the popup live
    const handleMessage = async (message: { 
      action: string
      data?: ContentEntry | { entry: ContentEntry; duplicates: DuplicateMatch[] }
      hasDuplicates?: boolean
    }) => {
      if (message.action === 'contentCaptured') {
        console.log('Popup: New content captured, refreshing...')
        
        // Check if there are duplicates
        if (message.hasDuplicates && message.data && 'duplicates' in message.data) {
          const { entry, duplicates } = message.data as { entry: ContentEntry; duplicates: DuplicateMatch[] }
          setDuplicateWarning({ entry, duplicates })
          return
        }
        
        const newEntry = message.data as ContentEntry
        
        // Reload entries to get the latest data
        await loadEntries()
        
        // Automatically enhance with AI if configured
        if (newEntry) {
          await autoEnhanceNewEntry(newEntry)
        }
      } else if (message.action === 'entriesMerged') {
        // Reload entries after merge
        await loadEntries()
        setDuplicateWarning(null)
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

  const checkOpenAIConfiguration = async () => {
    try {
      const settingsResponse = await chrome.runtime.sendMessage({
        action: 'getSettings'
      })
      
      if (settingsResponse?.success) {
        const settings = settingsResponse.data
        // Hide button if provider is 'local', show only if OpenAI is properly configured
        const isConfigured = settings.ai.provider === 'local'
          ? false
          : (settings.ai.provider === 'openai' && 
             settings.ai.apiKey && 
             settings.ai.enabled)
        setIsOpenAIConfigured(isConfigured)
      }
    } catch (error) {
      console.error('Failed to check OpenAI configuration:', error)
      setIsOpenAIConfigured(false)
    }
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

  const handleMerge = async (targetId: string) => {
    if (!duplicateWarning) return

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'mergeEntries',
        sourceId: duplicateWarning.entry.id,
        targetId: targetId,
      })

      if (response.success) {
        await loadEntries()
        setDuplicateWarning(null)
      } else {
        alert(response.error || 'Failed to merge entries')
      }
    } catch (error) {
      console.error('Merge failed:', error)
      alert('Failed to merge entries')
    }
  }

  const handleSaveAnyway = async () => {
    if (!duplicateWarning) return

    try {
      // Save the entry anyway
      await chrome.runtime.sendMessage({
        action: 'saveEntry',
        entry: duplicateWarning.entry,
      })

      await loadEntries()
      setDuplicateWarning(null)
    } catch (error) {
      console.error('Save anyway failed:', error)
      alert('Failed to save entry')
    }
  }

  const handleCancelDuplicate = () => {
    setDuplicateWarning(null)
  }

  const handleGenerateNotes = async (
    entryId: string,
    detailLevel: 'brief' | 'detailed' | 'bullets'
  ) => {
    try {
      setGeneratingNotesFor(entryId)
      
      // Get AI settings
      const settingsResponse = await chrome.runtime.sendMessage({
        action: 'getSettings'
      })
      
      if (settingsResponse?.success) {
        const settings = settingsResponse.data
        
        // Try to use OpenAI directly in UI context if available
        if (settings.ai.provider === 'openai' && settings.ai.apiKey && settings.ai.enabled) {
          // Get the entry
          const entryResponse = await chrome.runtime.sendMessage({
            action: 'getEntry',
            id: entryId
          })
          
          if (entryResponse.success && entryResponse.data) {
            const entry = entryResponse.data as ContentEntry
            
            // Initialize AI service in UI context
            await aiService.init(settings.ai)
            
            // Generate notes using OpenAI (runs in UI context)
            const studyNotes = await aiService.generateStudyNotes(
              entry.content,
              entry.type,
              detailLevel
            )
            
            // Update entry with study notes
            const updatedEntry: ContentEntry = {
              ...entry,
              metadata: {
                ...entry.metadata,
                studyNotes,
              },
            }
            
            // Save updated entry
            await chrome.runtime.sendMessage({
              action: 'saveEntry',
              entry: updatedEntry
            })
            
            // Update local state
            setEntries(prev => prev.map(e => e.id === entryId ? updatedEntry : e))
            setFilteredEntries(prev => prev.map(e => e.id === entryId ? updatedEntry : e))
          }
        } else {
          // Use background script for local processing
          const response = await chrome.runtime.sendMessage({
            action: 'generateStudyNotes',
            entryId,
            detailLevel,
          })
          
          if (response.success) {
            // Reload entries to get updated data
            await loadEntries()
          } else {
            console.error('Failed to generate study notes:', response.error)
            alert(response.error || 'Failed to generate study notes')
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate study notes:', error)
      alert('Failed to generate study notes')
    } finally {
      setGeneratingNotesFor(null)
    }
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
      {duplicateWarning && (
        <div className="duplicate-warning-overlay">
          <DuplicateWarning
            newEntry={duplicateWarning.entry}
            duplicates={duplicateWarning.duplicates}
            onMerge={handleMerge}
            onSaveAnyway={handleSaveAnyway}
            onCancel={handleCancelDuplicate}
          />
        </div>
      )}

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
                    onGenerateNotes={isOpenAIConfigured ? handleGenerateNotes : undefined}
                    notesLoading={generatingNotesFor === entry.id}
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
