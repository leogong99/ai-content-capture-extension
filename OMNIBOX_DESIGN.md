# Chrome Omnibox Integration Design

## Overview
Enable users to search and access captured content directly from Chrome's address bar using a custom keyword (e.g., `@capture` or `ac`).

## User Experience Flow

### 1. Activation
- User types `@capture` (or custom keyword) in the address bar
- Extension suggestions appear below the address bar
- Shows recent captures and search results as user types

### 2. Search Behavior
- **Empty query**: Shows 5-10 most recent captures
- **With query**: Shows matching entries (title, content, tags, summary)
- **Real-time filtering**: Updates suggestions as user types

### 3. Selection Actions
- **Enter on suggestion**: Opens the captured entry in side panel
- **Tab to navigate**: Move between suggestions
- **Enter without selection**: Opens side panel with search results

## Technical Implementation

### 1. Manifest Changes

#### Add Omnibox Permission
```json
{
  "permissions": [
    "omnibox"  // Add this
  ],
  "omnibox": {
    "keyword": "@capture"  // Default keyword, user can customize
  }
}
```

#### Optional: Settings for Custom Keyword
- Allow users to customize the keyword in settings
- Default: `@capture` or `ac` (shorter alternative)

### 2. Background Script Implementation

#### Event Handlers Required

1. **`chrome.omnibox.onInputChanged`**
   - Triggered as user types
   - Receives: `(text, suggest)`
   - Searches entries and provides suggestions
   - Format suggestions with rich descriptions

2. **`chrome.omnibox.onInputEntered`**
   - Triggered when user selects a suggestion or presses Enter
   - Receives: `(text, disposition)`
   - Opens side panel with selected entry or search results

3. **`chrome.omnibox.setDefaultSuggestion`** (Optional)
   - Sets default suggestion text
   - Shown when user first types the keyword

### 3. Suggestion Format

Each suggestion should include:
- **Title**: Entry title (truncated if long)
- **Description**: 
  - Category and tags
  - URL domain
  - Date captured
  - Content preview (first 50 chars)

Example format:
```
Title: "React Hooks Tutorial"
Description: "Technology • react, tutorial • github.com • 2 days ago • Learn how to use React Hooks..."
```

### 4. Search Strategy

#### Recent Entries (No Query)
- Return 5-10 most recent entries
- Sort by `createdAt` descending
- Show: Title, category, tags, domain, relative time

#### With Query
- Search across: title, content, summary, tags
- Limit to top 5-8 results
- Sort by relevance (exact matches first, then partial)
- Highlight matching text in description

#### Performance Considerations
- Cache recent entries (update on new capture)
- Debounce search queries (wait 150-200ms)
- Limit search to first 1000 entries for speed
- Use existing `searchEntries` method from storage service

### 5. Navigation Behavior

#### When User Selects a Suggestion
1. Get entry ID from suggestion
2. Open side panel (if not already open)
3. Navigate to that specific entry
4. Highlight the entry in the list

#### When User Presses Enter (No Selection)
1. Open side panel
2. Perform search with entered query
3. Show search results in side panel

### 6. Side Panel Integration

#### New Message Action: `navigateToEntry`
- Background script sends message to side panel
- Side panel receives entry ID
- Side panel scrolls to and highlights the entry

#### URL-based Navigation (Alternative)
- Use side panel URL with hash: `sidepanel.html#entry/{id}`
- Side panel reads hash on load and navigates

## Implementation Steps

### Phase 1: Basic Omnibox Setup
1. ✅ Add `omnibox` permission to manifest
2. ✅ Add `omnibox.keyword` configuration
3. ✅ Register `onInputChanged` handler
4. ✅ Register `onInputEntered` handler
5. ✅ Implement basic recent entries display

### Phase 2: Search Integration
1. ✅ Integrate with existing `searchEntries` method
2. ✅ Format suggestions with rich descriptions
3. ✅ Handle entry selection and navigation
4. ✅ Implement side panel navigation

### Phase 3: Polish & Optimization
1. ✅ Add caching for recent entries
2. ✅ Implement debouncing for search
3. ✅ Add keyboard navigation hints
4. ✅ Custom keyword setting in options page
5. ✅ Error handling and edge cases

## Code Structure

### Background Script (`background.ts`)

```typescript
// Omnibox handlers
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  // Handle search and suggestions
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  // Handle selection and navigation
});

// Helper functions
async function getOmniboxSuggestions(query: string): Promise<chrome.omnibox.SuggestResult[]>
async function openEntryInSidePanel(entryId: string): Promise<void>
function formatSuggestionDescription(entry: ContentEntry): string
```

### Storage Service Enhancement
- No changes needed - reuse existing `getRecentEntries()` and `searchEntries()`
- Consider adding `getRecentEntriesCached()` for performance

### Side Panel Enhancement
- Add listener for `navigateToEntry` message
- Implement scroll-to-entry functionality
- Add entry highlighting

## Settings Integration

### Options Page (`options.tsx`)
Add new setting:
```typescript
interface ExtensionSettings {
  // ... existing settings
  omnibox: {
    keyword: string;  // Default: "@capture"
    enabled: boolean; // Default: true
    maxSuggestions: number; // Default: 8
  }
}
```

### Update Omnibox Keyword Dynamically
```typescript
chrome.omnibox.setDefaultSuggestion({
  description: `Search captured content (keyword: ${settings.omnibox.keyword})`
});
```

## Edge Cases & Error Handling

1. **No entries**: Show "No captures yet" message
2. **Search returns no results**: Show "No matches found"
3. **Storage error**: Show error message, fallback to recent entries
4. **Side panel not available**: Open in new tab or show notification
5. **Entry deleted**: Handle gracefully, show next result

## Performance Targets

- **Suggestion response time**: < 100ms for recent entries
- **Search response time**: < 300ms for queries
- **Cache refresh**: On new capture, every 5 minutes
- **Max suggestions**: 8 (configurable)

## User Experience Enhancements

### Visual Indicators
- Icon in suggestion (use extension icon)
- Category badges in description
- Relative time ("2 hours ago", "yesterday")
- Content type indicator (text/image/page)

### Keyboard Shortcuts
- `Tab`: Navigate suggestions
- `Enter`: Select suggestion or search
- `Esc`: Cancel

### Smart Suggestions
- Show most relevant matches first
- Prioritize recent entries
- Group by category (optional)

## Testing Checklist

- [ ] Omnibox keyword appears in address bar
- [ ] Recent entries show when keyword typed
- [ ] Search works with various queries
- [ ] Selection opens side panel correctly
- [ ] Entry navigation works in side panel
- [ ] Custom keyword setting works
- [ ] Performance is acceptable with 1000+ entries
- [ ] Error handling works for edge cases
- [ ] Works with empty database
- [ ] Works with very long entry titles/content

## Future Enhancements

1. **Quick Actions**: Add actions like "Delete", "Edit" from omnibox
2. **Filters**: Support category/tag filters in query (`@capture category:tech`)
3. **Recent Searches**: Show recent search queries
4. **Favorites**: Prioritize favorited entries
5. **Voice Search**: Integration with Chrome voice input
6. **Multi-entry Selection**: Select multiple entries to batch operations

