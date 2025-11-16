# Chrome Omnibox Integration - User Flow Diagram

## Flow 1: User Types Keyword (Empty Query)

```
User types "@capture" in address bar
         ↓
Chrome triggers chrome.omnibox.onInputChanged("", suggest)
         ↓
Background script: getOmniboxSuggestions("")
         ↓
Check cache (recentEntriesCache)
    ├─ Cache valid? → Return cached entries
    └─ Cache invalid? → Fetch from storageService.getRecentEntries(8)
         ↓
Format suggestions with formatSuggestionDescription()
         ↓
Return to Chrome: suggest([...suggestions])
         ↓
Chrome displays suggestions in dropdown
         ↓
User sees:
  • "React Hooks Tutorial • Technology • react, tutorial • github.com • 2d ago"
  • "Python Best Practices • Tutorial • python, coding • stackoverflow.com • 1w ago"
  • ... (up to 8 recent entries)
```

## Flow 2: User Types Query

```
User types "@capture react" in address bar
         ↓
Chrome triggers chrome.omnibox.onInputChanged("react", suggest)
         ↓
Background script: getOmniboxSuggestions("react")
         ↓
Call storageService.searchEntries("react", undefined, 1, 8)
         ↓
Search across: title, content, summary, tags
         ↓
Filter and sort results
         ↓
Format suggestions (highlight query in description)
         ↓
Return to Chrome: suggest([...suggestions])
         ↓
Chrome displays matching entries
         ↓
User sees:
  • "React Hooks Tutorial • Technology • react, tutorial • github.com • 2d ago • Learn how to use React Hooks..."
  • "React vs Vue Comparison • Technology • react, vue • medium.com • 5d ago • A detailed comparison..."
```

## Flow 3: User Selects Suggestion

```
User presses ↓ key to select suggestion, then Enter
         ↓
Chrome triggers chrome.omnibox.onInputEntered("entry:abc123", "currentTab")
         ↓
Background script: openEntryInSidePanel("abc123")
         ↓
Get current window
         ↓
Open side panel: chrome.sidePanel.open({ windowId })
         ↓
Wait 500ms for side panel to load
         ↓
Send message: { action: 'navigateToEntry', entryId: 'abc123' }
         ↓
Side panel receives message
         ↓
Find entry in loaded entries or fetch from storage
         ↓
Scroll to entry element
         ↓
Add highlight class (temporary animation)
         ↓
User sees entry highlighted in side panel
```

## Flow 4: User Presses Enter Without Selection

```
User types "@capture react" and presses Enter directly
         ↓
Chrome triggers chrome.omnibox.onInputEntered("react", "currentTab")
         ↓
Background script: openSidePanelWithSearch("react")
         ↓
Get current window
         ↓
Open side panel: chrome.sidePanel.open({ windowId })
         ↓
Wait 500ms for side panel to load
         ↓
Send message: { action: 'searchInSidePanel', query: 'react' }
         ↓
Side panel receives message
         ↓
Call handleSearch("react", {})
         ↓
Perform search and display results
         ↓
User sees search results in side panel
```

## Flow 5: Cache Invalidation

```
User captures new content
         ↓
processCaptureRequest() saves entry
         ↓
Clear cache: recentEntriesCache = []
         ↓
Reset timestamp: cacheTimestamp = 0
         ↓
Next omnibox query will fetch fresh data
```

## Component Interaction Diagram

```
┌─────────────┐
│   Chrome    │
│  Address    │
│     Bar     │
└──────┬──────┘
       │
       │ User types "@capture"
       │
       ▼
┌─────────────────────┐
│  Background Script   │
│  (background.ts)     │
│                      │
│  • onInputChanged    │
│  • onInputEntered    │
│  • Cache management  │
└──────┬──────────────┘
       │
       │ Calls
       ▼
┌─────────────────────┐
│  Storage Service     │
│  (storage.ts)        │
│                      │
│  • getRecentEntries  │
│  • searchEntries     │
└──────┬──────────────┘
       │
       │ Returns entries
       ▼
┌─────────────────────┐
│  Background Script   │
│                      │
│  • Format suggestions│
│  • Return to Chrome  │
└──────┬──────────────┘
       │
       │ User selects
       ▼
┌─────────────────────┐
│  Side Panel          │
│  (sidepanel.tsx)     │
│                      │
│  • Receive message   │
│  • Navigate to entry │
│  • Highlight entry   │
└─────────────────────┘
```

## Data Structures

### Suggestion Format
```typescript
{
  content: "entry:abc123",  // Used for navigation
  description: "Title • Category • tags • domain.com • time ago • preview..."
}
```

### Cache Structure
```typescript
{
  recentEntriesCache: ContentEntry[],
  cacheTimestamp: number  // Unix timestamp
}
```

## Error Handling Flow

```
Error occurs in omnibox handler
         ↓
Catch error in try/catch
         ↓
Log error to console
         ↓
Show error suggestion:
  "Error: Could not search captures. Try opening the side panel."
         ↓
User can still press Enter to open side panel
```

## Performance Optimizations

1. **Caching**: Recent entries cached for 5 minutes
2. **Debouncing**: (Optional) Wait 150ms before searching
3. **Limiting**: Max 8 suggestions (configurable)
4. **Early Returns**: Return cached data when available
5. **Lazy Loading**: Only fetch when needed

## User Experience States

### State 1: No Captures
```
Suggestion: "No captures yet. Right-click content to capture!"
```

### State 2: Empty Query
```
Shows: 8 most recent captures
```

### State 3: Query with Results
```
Shows: Top 8 matching entries
```

### State 4: Query with No Results
```
Suggestion: "No matches found for 'xyz'. Press Enter to search in side panel."
```

### State 5: Loading
```
(Chrome shows default suggestion while loading)
```

