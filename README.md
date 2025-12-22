# Sys2Path Plugin Demo

A modern browser extension for capturing ChatLLM conversations and general web page content, built with React, TypeScript, and Vite.

## Features

### Dual-Mode Data Capture

- **ChatLLM Platforms**: 
  - **API-based capture**: ChatGPT, Claude, Grok (via API interception)
  - **DOM-based capture**: Gemini, NoteBookLM, AI Studio (via DOM parsing)
  - Captures conversations with message-level granularity
  - Distinguishes user messages from platform responses
  - Preserves timestamps for each message
  - Extracts titles from first message (with "..." suffix for truncated titles)

- **General Pages**: 
  - Extracts main content with HTML tags stripped
  - Cleans navigation, ads, and other non-content elements
  - Preserves text structure and readability

### Data Management

- **Version Control**: Each save creates a new version, allowing you to track changes over time
- **Local Storage**: Data stored in Chrome Storage API (`chrome.storage.local`)
- **Cross-Page Synchronization**: Changes on one page automatically update other open pages
- **Data Organization**: Grouped by URL with version history
- **Version Tagging**: Add custom tags to each version for better organization

### Modern UI

- **React-based Sidebar**: Clean, responsive interface with three main tabs:
  - **Chat**: Interactive chat interface with knowledge graph visualization
  - **Data**: Data sources list with filtering, sorting, and search
  - **Graph**: D3.js-powered knowledge graph visualization

- **Data Sources Management**:
  - Platform filtering (ChatGPT, Claude, Gemini, NoteBookLM, AI Studio, Grok, General, Demo)
  - Text search across titles and content
  - Sort by last saved time (ascending/descending)
  - Version selection dropdown for each data source
  - Preview modal for viewing conversation/content details
  - Batch selection and deletion
  - Individual version deletion

- **Floating Save Button**: Fixed position button in bottom-right corner
  - Shows capture status (idle, fetching, success, failure)
  - Triggers data capture on click
  - Automatically opens sidebar if closed

### Platform Support

| Platform | Capture Method | Features |
|----------|---------------|----------|
| ChatGPT | API Interception | Full conversation history, tool calls, Unicode decoding |
| Claude | API Interception | Complete message threads, attachments |
| Grok | API Interception | Citation handling, `<grok:render>` tag processing |
| Gemini | DOM Extraction | Real-time message capture, title extraction |
| NoteBookLM | DOM Extraction | Conversation threads, source tracking |
| AI Studio | DOM Extraction | Multi-turn conversations, context preservation |
| General Pages | DOM Extraction | Content cleaning, text extraction |

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Chrome/Chromium browser for testing

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

This will:
1. Compile TypeScript (`tsc -b`)
2. Build background script and sidebar (`vite build`)
3. Build content script as IIFE (`node build-content.js`)

### Load Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/` directory

### Development Workflow

1. Make changes to source files
2. Run `npm run build`
3. In Chrome extensions page, click the reload icon on your extension
4. Refresh the target page
5. Test your changes

## Project Structure

```
sys2path-plugin-demo/
├── src/
│   ├── background/          # Service worker (background script)
│   │   └── background.ts     # Handles extension lifecycle and message passing
│   ├── content/              # Content scripts
│   │   ├── content.ts        # Main content script for sidebar injection
│   │   ├── ui-injector.ts    # UI injection utilities
│   │   └── capture/          # Data capture modules
│   │       ├── chatllm.ts    # ChatLLM platform capture
│   │       ├── general.ts    # General page capture
│   │       └── api-helpers.ts # API interception helpers
│   ├── sidebar/              # React sidebar UI
│   │   ├── components/       # UI components
│   │   │   ├── Workbench.tsx # Main workbench component
│   │   │   ├── GraphView.tsx # Knowledge graph visualization
│   │   │   └── OverlayWidget.tsx # Floating save button
│   │   ├── main.tsx          # Sidebar entry point
│   │   └── index.html        # Sidebar HTML
│   ├── services/             # Business logic services
│   │   ├── storage.ts        # Chrome storage wrapper
│   │   ├── data-loader.ts    # Data loading and conversion
│   │   ├── platform-detector.ts # Platform detection
│   │   └── mockData.ts       # Mock data for development
│   └── types/                # TypeScript type definitions
│       ├── index.ts          # Main types
│       └── capture.ts        # Capture-specific types
├── docs/                     # Documentation
│   ├── architecture.md       # System architecture
│   ├── data-capture.md       # Capture mechanisms
│   ├── data-capture-flow.md  # Data capture flow details
│   └── operations.md         # Build and deployment
├── public/                   # Static assets
│   └── manifest.json         # Extension manifest
├── build-content.js          # Custom build script for content.js
├── vite.config.ts            # Vite configuration
└── package.json              # Dependencies and scripts
```

## Documentation

See `docs/` folder for detailed documentation:
- `architecture.md` - System architecture and component structure
- `data-capture.md` - Capture mechanisms and platform-specific details
- `data-capture-flow.md` - Complete data capture flow documentation
- `operations.md` - Build, deployment, and troubleshooting

## Technical Details

### Build Configuration

- **Vite**: Multi-entry point build for background script and sidebar
- **Custom Build**: Separate IIFE build for content script (required by Chrome Extensions)
- **TypeScript**: Strict type checking enabled
- **Tailwind CSS**: Utility-first CSS framework for styling

### Data Storage

- **Storage Keys**:
  - `sys2path_conversations`: Array of `ChatLLMConversation`
  - `sys2path_page_contents`: Array of `GeneralPageContent`
  - `sys2path_version_tags`: Map of version ID to tag string

- **Version Control**: Each save creates a new entry with timestamped ID (`{baseId}-{timestamp}`)

### Message Passing

- **Content Script ↔ Background**: Messages for data storage/retrieval (`SAVE_CONVERSATION`, `SAVE_PAGE_CONTENT`)
- **Sidebar ↔ Background**: Messages for data queries (`GET_ALL_DATA`)
- **Page ↔ Content Script**: Direct function calls for sidebar toggle

## License

Private project
