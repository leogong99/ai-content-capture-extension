# Chrome Omnibox Implementation Guide

## Step-by-Step Implementation

### Step 1: Update Manifest.json

Add omnibox configuration:

```json
{
  "manifest_version": 3,
  "name": "AI Content Capture",
  "version": "1.4.0",
  "permissions": [
    "activeTab",
    "contextMenus",
    "sidePanel",
    "scripting",
    "notifications",
    "omnibox"  // ADD THIS
  ],
  "omnibox": {
    "keyword": "@capture"  // ADD THIS - default keyword
  },
  // ... rest of manifest
}
```

### Step 2: Update Types

Add omnibox settings to `src/types/index.ts`:

```typescript
export interface ExtensionSettings {
  ai: AIConfig
  storage: StorageConfig
  theme: 'light' | 'dark' | 'auto'
  userAgreement: UserAgreement
  omnibox?: {  // ADD THIS
    keyword: string
    enabled: boolean
    maxSuggestions: number
  }
}
```

### Step 3: Implement Omnibox Handlers in Background Script

Add to `src/background/background.ts`:

```typescript
// Add after other chrome API listeners

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
chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  try {
    // Check if text is an entry ID (format: "entry:{id}")
    if (text.startsWith('entry:')) {
      const entryId = text.replace('entry:', '')
      await openEntryInSidePanel(entryId)
    } else {
      // Open side panel with search query
      await openSidePanelWithSearch(text)
    }
  } catch (error) {
    console.error('Omnibox navigation error:', error)
    // Fallback: just open side panel
    chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id })
  }
})

// Helper: Get suggestions based on query
async function getOmniboxSuggestions(
  query: string
): Promise<chrome.omnibox.SuggestResult[]> {
  const settings = await getSettings()
  const maxSuggestions = settings.omnibox?.maxSuggestions || 8

  // If no query, show recent entries
  if (!query.trim()) {
    const recent = await getRecentEntriesCached(maxSuggestions)
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

// Helper: Open entry in side panel
async function openEntryInSidePanel(entryId: string): Promise<void> {
  // Get current window
  const windows = await chrome.windows.getAll()
  const currentWindow = windows.find(w => w.focused) || windows[0]
  
  if (!currentWindow?.id) {
    throw new Error('Could not find current window')
  }

  // Open side panel
  await chrome.sidePanel.open({ windowId: currentWindow.id })

  // Wait a bit for side panel to load, then send navigation message
  setTimeout(() => {
    chrome.runtime.sendMessage({
      action: 'navigateToEntry',
      entryId: entryId
    }).catch(() => {
      // Side panel might not be ready, that's okay
      console.log('Side panel not ready for navigation')
    })
  }, 500)
}

// Helper: Open side panel with search
async function openSidePanelWithSearch(query: string): Promise<void> {
  const windows = await chrome.windows.getAll()
  const currentWindow = windows.find(w => w.focused) || windows[0]
  
  if (!currentWindow?.id) {
    throw new Error('Could not find current window')
  }

  await chrome.sidePanel.open({ windowId: currentWindow.id })

  // Send search message to side panel
  setTimeout(() => {
    chrome.runtime.sendMessage({
      action: 'searchInSidePanel',
      query: query
    }).catch(() => {
      console.log('Side panel not ready for search')
    })
  }, 500)
}

// Invalidate cache when new entry is captured
// Add this to processCaptureRequest function:
// recentEntriesCache = [] // Clear cache on new capture
```

### Step 4: Update Settings Defaults

Update `getSettings()` function in `background.ts`:

```typescript
async function getSettings(): Promise<ExtensionSettings> {
  const defaultSettings: ExtensionSettings = {
    ai: {
      provider: 'local',
      enabled: true,
    },
    storage: {
      maxEntries: 10000,
      autoCleanup: false,
      exportFormat: 'json',
    },
    theme: 'auto',
    userAgreement: {
      hasAgreed: false,
      version: '1.0',
    },
    omnibox: {  // ADD THIS
      keyword: '@capture',
      enabled: true,
      maxSuggestions: 8,
    },
  }

  const stored = await storageService.getConfig('settings')
  if (stored) {
    // Merge with defaults to ensure new fields are added
    return {
      ...defaultSettings,
      ...(stored as ExtensionSettings),
      omnibox: {
        ...defaultSettings.omnibox,
        ...((stored as ExtensionSettings).omnibox || {}),
      },
    }
  }
  return defaultSettings
}
```

### Step 5: Update processCaptureRequest to Invalidate Cache

In `background.ts`, update `processCaptureRequest`:

```typescript
async function processCaptureRequest(
  request: CaptureRequest
): Promise<ContentEntry> {
  // ... existing code ...

  // Save to storage
  await storageService.saveEntry(entry)

  // Invalidate omnibox cache
  recentEntriesCache = []
  cacheTimestamp = 0

  // ... rest of existing code ...
}
```

### Step 6: Add Side Panel Navigation Handler

Update `src/sidepanel/sidepanel.tsx` to handle navigation messages:

```typescript
// Add to useEffect or componentDidMount
useEffect(() => {
  const handleMessage = (message: any) => {
    if (message.action === 'navigateToEntry') {
      const entryId = message.entryId
      // Scroll to entry and highlight it
      navigateToEntry(entryId)
    } else if (message.action === 'searchInSidePanel') {
      const query = message.query
      // Perform search
      handleSearch(query, {})
    }
  }

  chrome.runtime.onMessage.addListener(handleMessage)
  return () => {
    chrome.runtime.onMessage.removeListener(handleMessage)
  }
}, [])

// Add navigation function
const navigateToEntry = async (entryId: string) => {
  // Load all entries if needed
  if (entries.length === 0) {
    await loadEntries(1, false)
  }

  // Find entry
  const entry = entries.find(e => e.id === entryId)
  if (!entry) {
    // Try loading from storage
    const response = await chrome.runtime.sendMessage({
      action: 'getEntry',
      id: entryId,
    })
    if (response.success && response.data) {
      // Add to entries and scroll to it
      setEntries([response.data, ...entries])
      // Scroll to entry (implement scroll logic)
      scrollToEntry(entryId)
    }
    return
  }

  // Scroll to entry
  scrollToEntry(entryId)
}

// Add scroll function
const scrollToEntry = (entryId: string) => {
  // Use refs or DOM query to find element
  const element = document.getElementById(`entry-${entryId}`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Add highlight class temporarily
    element.classList.add('highlighted')
    setTimeout(() => {
      element.classList.remove('highlighted')
    }, 2000)
  }
}
```

### Step 7: Add Settings UI (Optional)

Add omnibox settings to `src/options/options.tsx`:

```typescript
// In the settings form
<div className="setting-group">
  <h3>Omnibox Search</h3>
  <label>
    <input
      type="checkbox"
      checked={settings.omnibox?.enabled !== false}
      onChange={(e) => {
        updateSettings({
          ...settings,
          omnibox: {
            ...settings.omnibox,
            enabled: e.target.checked,
            keyword: settings.omnibox?.keyword || '@capture',
            maxSuggestions: settings.omnibox?.maxSuggestions || 8,
          },
        })
      }}
    />
    Enable address bar search
  </label>
  <p className="setting-description">
    Type "{settings.omnibox?.keyword || '@capture'}" in the address bar to search your captures
  </p>
  <label>
    Max suggestions:
    <input
      type="number"
      min="3"
      max="15"
      value={settings.omnibox?.maxSuggestions || 8}
      onChange={(e) => {
        updateSettings({
          ...settings,
          omnibox: {
            ...settings.omnibox,
            maxSuggestions: parseInt(e.target.value) || 8,
          },
        })
      }}
    />
  </label>
</div>
```

### Step 8: Add CSS for Highlighting (Optional)

Add to `src/sidepanel/sidepanel.css`:

```css
.entry-card.highlighted {
  border: 2px solid #4285f4;
  box-shadow: 0 0 10px rgba(66, 133, 244, 0.3);
  animation: highlightPulse 2s ease-out;
}

@keyframes highlightPulse {
  0% {
    box-shadow: 0 0 20px rgba(66, 133, 244, 0.5);
  }
  100% {
    box-shadow: 0 0 10px rgba(66, 133, 244, 0.3);
  }
}
```

## Testing Checklist

1. **Basic Functionality**
   - [ ] Type `@capture` in address bar - suggestions appear
   - [ ] Recent entries show when no query
   - [ ] Search works with query
   - [ ] Selecting suggestion opens side panel
   - [ ] Entry is highlighted in side panel

2. **Edge Cases**
   - [ ] Works with empty database
   - [ ] Works with 1000+ entries
   - [ ] Handles very long titles/content
   - [ ] Handles special characters in query
   - [ ] Handles deleted entries gracefully

3. **Performance**
   - [ ] Suggestions appear quickly (< 200ms)
   - [ ] Cache works correctly
   - [ ] No lag when typing

4. **UI/UX**
   - [ ] Descriptions are readable
   - [ ] Time formatting is correct
   - [ ] Domain extraction works
   - [ ] Highlight animation works

## Notes

- The keyword `@capture` can be changed by users in Chrome's extension settings
- Cache is invalidated on new captures for freshness
- Side panel must be loaded before navigation messages work
- Consider adding debouncing if performance becomes an issue

