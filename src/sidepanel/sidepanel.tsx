import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ContentEntry, SearchFilters, UserAgreement } from '@/types';
import { ContentCard } from '@/components/ContentCard';
import { SearchBar } from '@/components/SearchBar';
import { CaptureButton } from '@/components/CaptureButton';
import UserAgreementComponent from '@/components/UserAgreement';
import { 
  Settings, 
  Download, 
  Upload, 
  Trash2, 
  BarChart3,
  Shield,
  Grid,
  List
} from 'lucide-react';

const SidePanel: React.FC = () => {
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAgreement, setShowAgreement] = useState(false);

  useEffect(() => {
    loadEntries();
    checkUserAgreement();
    
    // Listen for new captures to update the dashboard live
    const handleMessage = (message: any) => {
      if (message.action === 'contentCaptured') {
        console.log('Sidepanel: New content captured, refreshing...');
        loadEntries();
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Cleanup listener on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const loadEntries = async () => {
    try {
      console.log('Sidepanel: Sending getEntries message...');
      const response = await chrome.runtime.sendMessage({ action: 'getEntries' });
      console.log('Sidepanel: Received response:', response);
      if (response && response.success) {
        setEntries(response.data);
        setFilteredEntries(response.data);
      } else {
        console.error('Sidepanel: Invalid response format:', response);
      }
    } catch (error) {
      console.error('Failed to load entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkUserAgreement = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getUserAgreement' });
      if (response && response.success) {
        const agreement = response.data;
        if (!agreement || !agreement.hasAgreed) {
          setShowAgreement(true);
        }
      }
    } catch (error) {
      console.error('Failed to check user agreement:', error);
      // If we can't check, show the agreement to be safe
      setShowAgreement(true);
    }
  };

  const handleAgreementAgree = async () => {
    try {
      const agreement: UserAgreement = {
        hasAgreed: true,
        agreedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      await chrome.runtime.sendMessage({ 
        action: 'setUserAgreement', 
        agreement 
      });
      
      setShowAgreement(false);
    } catch (error) {
      console.error('Failed to save user agreement:', error);
    }
  };

  const handleShowAgreement = () => {
    setShowAgreement(true);
  };

  const handleSearch = async (query: string, filters: SearchFilters) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'searchEntries',
        query,
        filters
      });
      
      if (response.success) {
        setFilteredEntries(response.data);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleClearSearch = () => {
    setFilteredEntries(entries);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        await chrome.runtime.sendMessage({ action: 'deleteEntry', id });
        await loadEntries();
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  const handleView = (entry: ContentEntry) => {
    // Open entry details in a new tab or modal
    window.open(entry.url, '_blank');
  };

  const handleCapture = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return;

      // Use background script's capture functions for page capture
      await chrome.runtime.sendMessage({ 
        action: 'capturePage', 
        tabId: tab.id 
      });
    } catch (error) {
      console.error('Capture failed:', error);
    }
  };

  const handleExport = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'exportData' });
      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ai-content-capture-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await chrome.runtime.sendMessage({ action: 'importData', data });
          await loadEntries();
        } catch (error) {
          console.error('Import failed:', error);
          alert('Failed to import data. Please check the file format.');
        }
      }
    };
    input.click();
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete all entries? This action cannot be undone.')) {
      try {
        await chrome.runtime.sendMessage({ action: 'clearAllData' });
        await loadEntries();
      } catch (error) {
        console.error('Clear all failed:', error);
      }
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const stats = {
    total: entries.length,
    text: entries.filter(e => e.type === 'text').length,
    image: entries.filter(e => e.type === 'image').length,
    page: entries.filter(e => e.type === 'page').length,
    categories: [...new Set(entries.map(e => e.category))].length
  };

  if (loading) {
    return (
      <div className="sidepanel-container">
        <div className="loading">Loading...</div>
      </div>
    );
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
          <button
            className="btn-icon"
            onClick={openOptions}
            title="Settings"
          >
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
                onChange={(e) => setSortBy(e.target.value as any)}
                className="sort-select"
              >
                <option value="date">Date</option>
                <option value="title">Title</option>
                <option value="category">Category</option>
              </select>
              <button
                className="btn-icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
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
          {sortedEntries.length === 0 ? (
            <div className="empty-state">
              <p>No content found.</p>
              <p>Start capturing content or adjust your search filters.</p>
            </div>
          ) : (
            sortedEntries.map((entry) => (
              <ContentCard
                key={entry.id}
                entry={entry}
                onDelete={handleDelete}
                onView={handleView}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Initialize the side panel
const container = document.getElementById('sidepanel-root');
if (container) {
  const root = createRoot(container);
  root.render(<SidePanel />);
}
