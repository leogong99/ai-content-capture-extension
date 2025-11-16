# How to Use Chrome Omnibox Search Feature

## Quick Start

The Chrome Omnibox integration allows you to search and access your captured content directly from Chrome's address bar.

## Basic Usage

### 1. Access the Omnibox

1. **Click on the address bar** (or press `Ctrl+L` / `Cmd+L` on Mac)
2. **Type the keyword**: `@capture`
3. **Press Space or Tab** to activate the extension search

### 2. View Recent Captures

- **Without typing anything**: Just type `@capture` and you'll see your 8 most recent captures
- **Navigate**: Use arrow keys (↑↓) to browse through suggestions
- **Select**: Press Enter to open the selected entry in the side panel

### 3. Search Your Captures

- **Type a query**: After `@capture`, type your search term
  - Example: `@capture react`
  - Example: `@capture tutorial`
  - Example: `@capture github`
- **See results**: Matching entries appear as suggestions
- **Select**: Use arrow keys to choose, then press Enter

## Step-by-Step Examples

### Example 1: Find a Recent Capture

```
1. Click address bar (or Ctrl+L)
2. Type: @capture
3. See list of recent captures
4. Use ↓ arrow key to select one
5. Press Enter
6. Side panel opens and highlights the entry
```

### Example 2: Search for Specific Content

```
1. Click address bar (or Ctrl+L)
2. Type: @capture python
3. See matching entries with "python" in title/content/tags
4. Use arrow keys to navigate
5. Press Enter on desired entry
6. Side panel opens with that entry highlighted
```

### Example 3: Quick Search Without Selection

```
1. Click address bar (or Ctrl+L)
2. Type: @capture javascript tutorial
3. Press Enter directly (without selecting)
4. Side panel opens with search results
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open address bar | `Ctrl+L` (Windows/Linux) or `Cmd+L` (Mac) |
| Navigate suggestions | `↑` or `↓` arrow keys |
| Select suggestion | `Enter` |
| Search without selection | Type query + `Enter` |
| Cancel | `Esc` |

## What You'll See

### Suggestion Format

Each suggestion shows:
- **Title**: The captured content title (truncated if long)
- **Category & Tags**: e.g., "Technology • react, tutorial"
- **Domain**: The website domain (e.g., "github.com")
- **Time**: Relative time (e.g., "2h ago", "3d ago")
- **Preview**: Content preview for search results

Example:
```
React Hooks Tutorial • Technology • react, tutorial • github.com • 2d ago
```

### Empty States

- **No captures yet**: Shows "No captures yet. Right-click content to capture!"
- **No search results**: Shows "No matches found for 'xyz'. Press Enter to search in side panel."

## Tips & Tricks

### 1. Quick Access
- The keyword `@capture` is short and easy to type
- You can change it in Chrome's extension settings if needed

### 2. Recent Entries
- When you type `@capture` with no query, you see the 8 most recent captures
- These are cached for 5 minutes for fast access

### 3. Search Anywhere
- Search works across:
  - Entry titles
  - Content text
  - Tags
  - Summaries
  - Categories

### 4. Navigation
- After selecting an entry, the side panel automatically:
  - Opens (if not already open)
  - Scrolls to the entry
  - Highlights it with a blue border and pulse animation

### 5. Direct Search
- If you press Enter without selecting a suggestion, it opens the side panel with search results
- Useful when you want to see all matches, not just the top suggestions

## Troubleshooting

### Omnibox doesn't appear
- **Check**: Make sure the extension is installed and enabled
- **Reload**: Try reloading the extension in `chrome://extensions/`
- **Restart**: Restart Chrome if needed

### No suggestions showing
- **Check**: Make sure you have captured some content
- **Keyword**: Make sure you're typing `@capture` correctly
- **Space**: Press Space or Tab after the keyword

### Side panel doesn't open
- **Check**: Make sure side panel is enabled in Chrome
- **Permissions**: Verify extension has necessary permissions
- **Reload**: Try reloading the extension

### Entry not found
- **Check**: The entry might have been deleted
- **Refresh**: Try refreshing the side panel
- **Search**: Use the side panel search instead

## Advanced Usage

### Custom Keyword (Future Feature)
Currently, the keyword is fixed as `@capture`. In the future, you may be able to customize this in the extension settings.

### Performance
- Recent entries are cached for 5 minutes
- Search is optimized for up to 10,000 entries
- Suggestions appear within 100-300ms

## Example Workflows

### Workflow 1: Daily Content Review
```
Morning routine:
1. Type @capture
2. Browse recent captures from yesterday
3. Select interesting ones to review
4. Use side panel to read full content
```

### Workflow 2: Research Project
```
While researching:
1. Capture relevant content throughout the day
2. Later, type @capture [topic]
3. Find all related captures quickly
4. Review and organize in side panel
```

### Workflow 3: Quick Reference
```
Need to find something:
1. Type @capture [keyword]
2. See matching entries instantly
3. Select the right one
4. Get taken directly to it
```

## Integration with Other Features

The Omnibox feature works seamlessly with:
- **Side Panel**: Opens and navigates to entries
- **Search**: Uses the same search engine as the side panel
- **Storage**: Accesses the same IndexedDB storage
- **AI Categorization**: Shows AI-generated categories and tags

## Best Practices

1. **Use descriptive titles**: Better titles = easier to find
2. **Add relevant tags**: Tags make searching more effective
3. **Regular captures**: More content = better search results
4. **Use keywords**: Think about what you'll search for later
5. **Combine with side panel**: Use omnibox for quick access, side panel for detailed review

---

**Enjoy quick access to your captured content!** 🚀

