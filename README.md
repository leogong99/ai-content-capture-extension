# AI Content Capture Chrome Extension

An intelligent Chrome extension that captures, categorizes, and searches web content using AI. Store content locally with automatic tagging, summarization, and powerful search capabilities.

## ✨ Features

### 🎯 Content Capture

- **Text Selection**: Right-click to capture selected text
- **Image Capture**: Right-click on images to save them
- **Full Page**: Capture entire web pages
- **Keyboard Shortcuts**: Quick capture with Ctrl+Shift+C/P
- **Context Menu**: Easy access from right-click menu

### 🤖 AI-Powered Processing

- **Automatic Categorization**: AI categorizes content into relevant categories
- **Smart Tagging**: Generate relevant tags automatically
- **Content Summarization**: Get concise summaries of captured content
- **Multiple AI Providers**: OpenAI API or local processing
- **Customizable**: Override AI suggestions with your own tags/categories

### 🔍 Advanced Search

- **Full-Text Search**: Search through all captured content
- **Filter by Category**: Filter by AI-generated categories
- **Tag-Based Search**: Find content by tags
- **Date Range Filtering**: Search by creation date
- **Type Filtering**: Filter by text, image, or page content

### 💾 Local Storage

- **IndexedDB**: Fast, local storage using modern web standards
- **Privacy-First**: All data stays on your device
- **Export/Import**: Backup and restore your data
- **Configurable Limits**: Set maximum storage capacity
- **Auto-Cleanup**: Automatic cleanup of old entries

### 🎨 Modern UI

- **Popup Interface**: Quick access and recent entries
- **Side Panel**: Full dashboard with advanced features
- **Settings Page**: Comprehensive configuration options
- **Responsive Design**: Works on all screen sizes
- **Dark/Light Theme**: Follows system preferences

## 🚀 Installation

### Development Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ai-content-capture-extension
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the extension**

   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

### Production Build

```bash
npm run build
```

The built extension will be in the `dist` folder, ready for packaging or distribution.

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests
- `npm run test:e2e` - Run end-to-end tests

### Project Structure

```
src/
├── components/          # Reusable React components
│   ├── ContentCard.tsx
│   ├── SearchBar.tsx
│   └── CaptureButton.tsx
├── services/           # Core services
│   ├── storage.ts      # IndexedDB storage service
│   └── ai.ts          # AI processing service
├── types/             # TypeScript type definitions
│   └── index.ts
├── background/        # Background script
│   └── background.ts
├── content/          # Content script
│   └── content.ts
├── popup/            # Extension popup
│   ├── index.html
│   ├── popup.tsx
│   └── popup.css
├── sidepanel/        # Side panel interface
│   ├── index.html
│   ├── sidepanel.tsx
│   └── sidepanel.css
└── options/          # Settings page
    ├── index.html
    ├── options.tsx
    └── options.css
```

## ⚙️ Configuration

### AI Settings

1. **Local Processing** (Default)
   - Uses built-in heuristics for categorization
   - No API keys required
   - Works offline

2. **OpenAI Integration**
   - Go to Settings → AI Configuration
   - Enter your OpenAI API key
   - Choose model (GPT-3.5 Turbo, GPT-4, etc.)
   - More accurate but requires internet connection

### Storage Settings

- **Maximum Entries**: Set storage limit (100-10,000 entries)
- **Auto Cleanup**: Automatically remove old entries
- **Export Format**: Choose JSON or CSV for exports

### Privacy & Security

- All data is stored locally on your device
- No data is sent to external servers (except OpenAI if configured)
- API keys are stored locally and never shared
- Full control over your data with export/import options

## 🎯 Usage

### Basic Capture

1. **Text Selection**: Select text on any webpage and right-click → "Capture Selection"
2. **Images**: Right-click on any image → "Capture Image"
3. **Full Page**: Right-click anywhere → "Capture Page"
4. **Keyboard Shortcuts**:
   - `Ctrl+Shift+C` (Cmd+Shift+C on Mac) - Capture selection
   - `Ctrl+Shift+P` (Cmd+Shift+P on Mac) - Capture page

### Search & Browse

1. **Quick Search**: Use the popup to search recent entries
2. **Advanced Search**: Open the side panel for full search capabilities
3. **Filters**: Filter by category, type, date range, or tags
4. **Sorting**: Sort by date, title, or category

### Data Management

1. **Export**: Settings → Data Management → Export Data
2. **Import**: Settings → Data Management → Import Data
3. **Clear All**: Settings → Data Management → Clear All Data

## 🔧 Technical Details

### Architecture

- **Manifest V3**: Latest Chrome extension standard
- **React + TypeScript**: Modern frontend framework
- **IndexedDB**: Local storage with schema versioning
- **Vite**: Fast build tool and development server
- **ESLint + Prettier**: Code quality and formatting

### Browser Compatibility

- Chrome 115+ (Manifest V3 support)
- Chromium-based browsers (Edge, Brave, etc.)
- Requires modern JavaScript features

### Performance

- Content capture: < 2 seconds
- Search queries: < 500ms for ≤1000 entries
- Local storage with efficient indexing
- Lazy loading for large datasets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use Prettier for code formatting
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Report bugs or request features on GitHub Issues
- **Documentation**: Check this README and inline code comments
- **Discussions**: Use GitHub Discussions for questions and ideas

## 🗺️ Roadmap

### Planned Features

- [ ] Sync across devices via cloud storage
- [ ] OCR for image text extraction
- [ ] Folder-based organization
- [ ] Chrome omnibox search integration
- [ ] Team collaboration features
- [ ] Advanced AI model training
- [ ] Browser history integration
- [ ] Content sharing and collaboration

### Future Enhancements

- [ ] Mobile app companion
- [ ] API for third-party integrations
- [ ] Advanced analytics and insights
- [ ] Custom AI model training
- [ ] Plugin system for extensions

## 📋 User Agreement & Privacy Notice

### Data Collection & Storage

- **No Data Collection:** This extension does not collect, store, or transmit any personal data from your browsing activity.
- **Local Storage Only:** All captured content is stored locally on your device using your browser's storage system.
- **No Tracking:** We do not track your browsing habits, visited websites, or any personal information.
- **No Analytics:** No usage analytics or telemetry data is collected.

### OpenAI API Usage (Optional)

- **Optional Feature:** AI processing is completely optional and only works if you provide your own OpenAI API key.
- **Your API Key:** Your OpenAI API key is stored locally and never shared with us or any third parties.
- **Direct Communication:** When using AI features, your captured content is sent directly to OpenAI's servers using your API key.
- **OpenAI's Privacy:** Any data sent to OpenAI is subject to their privacy policy and terms of service.
- **No AI by Default:** If you don't provide an API key, no data leaves your device.

### Important Disclaimers

- **No Responsibility:** We are not responsible for any data loss, privacy breaches, or security issues.
- **Use at Your Own Risk:** This extension is provided "as is" without any warranties.
- **Sensitive Information:** Do not use this extension to capture sensitive, confidential, or personal information.
- **Local Responsibility:** You are responsible for the security and privacy of your local data.
- **API Costs:** If you use OpenAI features, you are responsible for any API costs incurred.

### Your Consent

By using this extension, you acknowledge that you have read and understood this agreement, and you agree to use this extension in accordance with these terms.

---

**Made with ❤️ for content creators, researchers, and knowledge workers**
