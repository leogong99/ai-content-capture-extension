# Installation Guide

## Quick Start

1. **Build the extension:**
   ```bash
   npm install
   npm run build
   ```

2. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

3. **Start using:**
   - Click the extension icon in the toolbar
   - Right-click on any webpage to see capture options
   - Use keyboard shortcuts: `Ctrl+Shift+C` (selection) or `Ctrl+Shift+P` (page)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Features

### Content Capture
- **Text Selection**: Right-click → "Capture Selection"
- **Images**: Right-click on image → "Capture Image"  
- **Full Page**: Right-click → "Capture Page"
- **Keyboard Shortcuts**: 
  - `Ctrl+Shift+C` (Cmd+Shift+C on Mac) - Capture selection
  - `Ctrl+Shift+P` (Cmd+Shift+P on Mac) - Capture page

### AI Processing
- Automatic categorization and tagging
- Local processing (default) or OpenAI API
- Customizable AI settings in options

### Search & Organization
- Full-text search across all content
- Filter by category, type, date, tags
- Sort by date, title, or category
- Export/import data

### Privacy
- All data stored locally
- No external data transmission (except OpenAI if configured)
- Full control over your data

## Troubleshooting

### Extension not loading
- Make sure you selected the `dist` folder (not the root project folder)
- Check that "Developer mode" is enabled
- Try refreshing the extensions page

### Content not capturing
- Make sure the extension has permission to access the current site
- Try refreshing the page after installing
- Check the browser console for errors

### AI features not working
- Go to extension options to configure AI settings
- For OpenAI: Enter a valid API key
- For local processing: No configuration needed

## File Structure

```
dist/                    # Built extension (load this in Chrome)
├── manifest.json       # Extension manifest
├── background.js       # Background script
├── content.js         # Content script
├── src/
│   ├── popup/         # Popup interface
│   ├── sidepanel/     # Side panel dashboard
│   └── options/       # Settings page
└── icons/             # Extension icons

src/                    # Source code
├── components/        # React components
├── services/          # Core services (storage, AI)
├── types/            # TypeScript definitions
├── background/       # Background script source
├── content/          # Content script source
├── popup/            # Popup source
├── sidepanel/        # Side panel source
└── options/          # Options page source
```

## Next Steps

1. **Add Icons**: Create icon files in `public/icons/` (16x16, 32x32, 48x48, 128x128)
2. **Configure AI**: Set up OpenAI API key in extension options
3. **Customize**: Modify settings, themes, and features as needed
4. **Test**: Try capturing different types of content
5. **Share**: Package and distribute your extension

## Support

- Check the README.md for detailed documentation
- Report issues on GitHub
- Check browser console for error messages
