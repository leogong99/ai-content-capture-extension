import React, { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { ContentEntry, SearchFilters, UserAgreement } from '@/types'
import { ContentCard } from '@/components/ContentCard'
import { SearchBar } from '@/components/SearchBar'
import { CaptureButton } from '@/components/CaptureButton'
import UserAgreementComponent from '@/components/UserAgreement'
import { aiService } from '@/services/ai'
import {
  Settings,
  Download,
  Upload,
  Trash2,
  BarChart3,
  Shield,
  Grid,
  List,
} from 'lucide-react'

export const SidePanel: React.FC = () => {
  const [entries, setEntries] = useState<ContentEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<ContentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'category'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showAgreement, setShowAgreement] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isSearching, setIsSearching] = useState(false)

  const loadEntries = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      if (page === 1) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      console.log('Sidepanel: Sending getEntriesPaginated message...')
      const response = await chrome.runtime.sendMessage({
        action: 'getEntriesPaginated',
        page,
        pageSize: 20,
        sortBy,
        sortOrder,
      })

      console.log('Sidepanel: Received response:', response)
      if (response && response.success) {
        const {
          entries: newEntries,
          total,
          hasMore: moreAvailable,
        } = response.data

        if (append) {
          setEntries(prev => [...prev, ...newEntries])
          setFilteredEntries(prev => [...prev, ...newEntries])
        } else {
          setEntries(newEntries)
          setFilteredEntries(newEntries)
        }

        setTotalCount(total)
        setHasMore(moreAvailable)
        setCurrentPage(page)
      } else {
        console.error('Sidepanel: Invalid response format:', response)
      }
    } catch (error) {
      console.error('Failed to load entries:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sortBy, sortOrder])

  useEffect(() => {
    loadEntries()
    checkUserAgreement()

    // Listen for new captures to update the dashboard live
    const handleMessage = async (message: { action: string; data?: ContentEntry }) => {
      if (message.action === 'contentCaptured') {
        console.log('Sidepanel: New content captured, refreshing...')
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
  }, [loadEntries])

  const checkUserAgreement = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getUserAgreement',
      })
      if (response && response.success) {
        const agreement = response.data
        if (!agreement || !agreement.hasAgreed) {
          setShowAgreement(true)
        }
      }
    } catch (error) {
      console.error('Failed to check user agreement:', error)
      // If we can't check, show the agreement to be safe
      setShowAgreement(true)
    }
  }

  const handleAgreementAgree = async () => {
    try {
      const agreement: UserAgreement = {
        hasAgreed: true,
        agreedAt: new Date().toISOString(),
        version: '1.0',
      }

      await chrome.runtime.sendMessage({
        action: 'setUserAgreement',
        agreement,
      })

      setShowAgreement(false)
    } catch (error) {
      console.error('Failed to save user agreement:', error)
    }
  }

  const handleShowAgreement = () => {
    setShowAgreement(true)
  }

  const handleSearch = async (query: string, filters: SearchFilters) => {
    try {
      setIsSearching(true)
      const response = await chrome.runtime.sendMessage({
        action: 'searchEntries',
        query,
        filters,
        page: 1,
        pageSize: 50,
      })

      if (response.success) {
        const {
          entries: searchResults,
          total,
          hasMore: moreAvailable,
        } = response.data
        setFilteredEntries(searchResults)
        setTotalCount(total)
        setHasMore(moreAvailable)
        setCurrentPage(1)
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const loadMoreEntries = async () => {
    if (!loadingMore && hasMore) {
      await loadEntries(currentPage + 1, true)
    }
  }

  const autoEnhanceNewEntry = async (entry: ContentEntry) => {
    try {
      console.log('🤖 Auto-enhancing new entry with AI:', entry.id)
      
      // Get AI settings
      const settingsResponse = await chrome.runtime.sendMessage({
        action: 'getSettings'
      })
      
      if (settingsResponse?.success) {
        const settings = settingsResponse.data
        
        // Only auto-enhance if OpenAI is configured
        if (settings.ai.provider === 'openai' && settings.ai.apiKey && settings.ai.enabled) {
          console.log('🚀 OpenAI configured, auto-enhancing entry...')
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
          
          console.log('✅ Entry auto-enhanced successfully:', enhancedEntry)
        } else {
          console.log('ℹ️ OpenAI not configured, skipping auto-enhancement')
        }
      }
    } catch (error) {
      console.error('❌ Failed to auto-enhance entry with AI:', error)
    }
  }

  const handleClearSearch = () => {
    setFilteredEntries(entries)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        await chrome.runtime.sendMessage({ action: 'deleteEntry', id })
        await loadEntries()
      } catch (error) {
        console.error('Delete failed:', error)
      }
    }
  }

  const handleView = (entry: ContentEntry) => {
    // Open entry details in a new tab or modal
    window.open(entry.url, '_blank')
  }

  const handleCapture = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      if (!tab.id) return

      // Use background script's capture functions for page capture
      await chrome.runtime.sendMessage({
        action: 'capturePage',
        tabId: tab.id,
      })
    } catch (error) {
      console.error('Capture failed:', error)
    }
  }

  const handleExport = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'exportData',
      })
      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `ai-content-capture-${new Date().toISOString().split('T')[0]}.json`
        link.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          const text = await file.text()
          const data = JSON.parse(text)
          await chrome.runtime.sendMessage({ action: 'importData', data })
          await loadEntries()
        } catch (error) {
          console.error('Import failed:', error)
          alert('Failed to import data. Please check the file format.')
        }
      }
    }
    input.click()
  }

  const handleClearAll = async () => {
    if (
      confirm(
        'Are you sure you want to delete all entries? This action cannot be undone.'
      )
    ) {
      try {
        await chrome.runtime.sendMessage({ action: 'clearAllData' })
        await loadEntries()
      } catch (error) {
        console.error('Clear all failed:', error)
      }
    }
  }

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  // Use filteredEntries directly since sorting is now handled by the database
  const displayEntries = filteredEntries

  const stats = {
    total: entries.length,
    text: entries.filter(e => e.type === 'text').length,
    image: entries.filter(e => e.type === 'image').length,
    page: entries.filter(e => e.type === 'page').length,
    categories: [...new Set(entries.map(e => e.category))].length,
  }

  if (loading) {
    return (
      <div className="sidepanel-container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="sidepanel-container">
      <UserAgreementComponent
        isOpen={showAgreement}
        onClose={() => setShowAgreement(false)}
        onAgree={handleAgreementAgree}
        showAsModal={true}
      />

      <div className="sidepanel-header">
        <h1>Content Dashboard</h1>
        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={handleShowAgreement}
            title="View User Agreement"
          >
            <Shield size={16} />
          </button>
          <button
            className="btn-icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
          >
            {viewMode === 'grid' ? <List size={16} /> : <Grid size={16} />}
          </button>
          <button className="btn-icon" onClick={openOptions} title="Settings">
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat">
          <span className="stat-number">{stats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat">
          <span className="stat-number">{stats.text}</span>
          <span className="stat-label">Text</span>
        </div>
        <div className="stat">
          <span className="stat-number">{stats.image}</span>
          <span className="stat-label">Images</span>
        </div>
        <div className="stat">
          <span className="stat-number">{stats.page}</span>
          <span className="stat-label">Pages</span>
        </div>
        <div className="stat">
          <span className="stat-number">{stats.categories}</span>
          <span className="stat-label">Categories</span>
        </div>
      </div>

      <div className="sidepanel-content">
        <div className="toolbar">
          <div className="toolbar-left">
            <CaptureButton onCapture={handleCapture} />
          </div>
          <div className="toolbar-right">
            <div className="sort-controls">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'date' | 'title' | 'category')}
                className="sort-select"
              >
                <option value="date">Date</option>
                <option value="title">Title</option>
                <option value="category">Category</option>
              </select>
              <button
                className="btn-icon"
                onClick={() =>
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                }
                title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                <BarChart3 size={16} />
              </button>
            </div>
            <div className="action-buttons">
              <button
                className="btn-icon"
                onClick={handleExport}
                title="Export data"
              >
                <Download size={16} />
              </button>
              <button
                className="btn-icon"
                onClick={handleImport}
                title="Import data"
              >
                <Upload size={16} />
              </button>
              <button
                className="btn-icon btn-danger"
                onClick={handleClearAll}
                title="Clear all data"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>

        <SearchBar
          onSearch={handleSearch}
          onClear={handleClearSearch}
          placeholder="Search all captured content..."
        />

        <div className={`entries-container ${viewMode}`}>
          {loading ? (
            <div className="loading-state">
              <p>Loading entries...</p>
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="empty-state">
              <p>No content found.</p>
              <p>Start capturing content or adjust your search filters.</p>
            </div>
          ) : (
            <>
              {displayEntries.map(entry => (
                <ContentCard
                  key={entry.id}
                  entry={entry}
                  onDelete={handleDelete}
                  onView={handleView}
                />
              ))}

              {hasMore && !isSearching && (
                <div className="load-more-container">
                  <button
                    className="btn-secondary load-more-btn"
                    onClick={loadMoreEntries}
                    disabled={loadingMore}
                  >
                    {loadingMore
                      ? 'Loading...'
                      : `Load More (${totalCount - displayEntries.length} remaining)`}
                  </button>
                </div>
              )}

              {totalCount > 0 && (
                <div className="pagination-info">
                  Showing {displayEntries.length} of {totalCount} entries
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Initialize the side panel
const container = document.getElementById('sidepanel-root')
if (container) {
  const root = createRoot(container)
  root.render(<SidePanel />)
}
