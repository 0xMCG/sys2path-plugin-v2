# Architecture Documentation

## Overview

Sys2Path Plugin Demo is a browser extension built with React, TypeScript, and Vite. It provides dual-mode data capture capabilities for ChatLLM platforms and general web pages, with version control and cross-page synchronization.

## System Architecture

### Component Structure

```
sys2path-plugin-demo/
├── src/
│   ├── background/          # Service worker (background script)
│   │   └── background.ts   # Handles extension lifecycle and message passing
│   ├── content/             # Content scripts
│   │   ├── content.ts       # Main content script for sidebar injection
│   │   ├── ui-injector.ts   # UI injection utilities
│   │   └── capture/        # Data capture modules
│   │       ├── chatllm.ts  # ChatLLM platform capture
│   │       ├── general.ts  # General page capture
│   │       └── api-helpers.ts # API interception helpers
│   ├── sidebar/             # React sidebar UI
│   │   ├── components/      # UI components
│   │   │   ├── Workbench.tsx # Main workbench component
│   │   │   ├── GraphView.tsx # Knowledge graph visualization (D3.js)
│   │   │   └── OverlayWidget.tsx # Floating save button
│   │   ├── main.tsx         # Sidebar entry point
│   │   └── index.html       # Sidebar HTML
│   ├── services/            # Business logic services
│   │   ├── storage.ts       # Chrome storage wrapper with version control
│   │   ├── data-loader.ts   # Data loading and conversion to DataSource format
│   │   ├── platform-detector.ts  # Platform detection
│   │   └── mockData.ts      # Mock data for development
│   └── types/               # TypeScript type definitions
│       ├── index.ts         # Main types (DataSource, Entity, GraphData, etc.)
│       └── capture.ts       # Capture-specific types
```

## Data Flow

### ChatLLM Capture Flow

1. **Detection**: Content script detects ChatLLM platform using `PlatformDetector`
2. **Initialization**: `ChatLLMCapture` initializes platform-specific capture mechanisms
   - **API-based platforms** (ChatGPT, Claude, Grok): Intercepts API calls
   - **DOM-based platforms** (Gemini, NoteBookLM, AI Studio): Sets up DOM observers
3. **User Trigger**: User clicks floating save button
4. **Extraction**: 
   - API-based: Fetches conversation data via intercepted API calls
   - DOM-based: Extracts messages from DOM using platform-specific selectors
5. **Conversion**: Converts platform-specific data to `ChatLLMConversation` format
6. **Title Extraction**: Extracts title from first message (with "..." suffix if truncated)
7. **Message Passing**: Sends `SAVE_CONVERSATION` message to background script
8. **Storage**: Background script saves to `chrome.storage.local` via `StorageService`
9. **Version Control**: Creates new version with timestamped ID (`{baseId}-{timestamp}`)
10. **Synchronization**: `chrome.storage.onChanged` event triggers UI refresh across all pages

### General Page Capture Flow

1. **Detection**: Content script detects non-ChatLLM page
2. **User Trigger**: User clicks floating save button
3. **Extraction**: `GeneralPageCapture` extracts main content
   - Tries multiple selectors to find main content
   - Removes script, style, navigation, ads, etc.
   - Strips HTML tags, extracts plain text
4. **Message Passing**: Sends `SAVE_PAGE_CONTENT` message to background script
5. **Storage**: Background script saves to `chrome.storage.local`
6. **Version Control**: Creates new version with timestamped ID
7. **Synchronization**: UI updates across all pages

## Key Components

### Background Service Worker

**File**: `src/background/background.ts`

- Handles extension lifecycle events
- Processes messages from content scripts:
  - `SAVE_CONVERSATION`: Saves ChatLLM conversation
  - `SAVE_PAGE_CONTENT`: Saves general page content
  - `GET_ALL_DATA`: Retrieves all stored data
- Manages data storage operations via `StorageService`
- Coordinates between content scripts and sidebar
- **Module Type**: ES module (`"type": "module"` in manifest)

### Content Script

**File**: `src/content/content.ts`

- Injects sidebar UI into pages (iframe-based)
- Injects floating save button (overlay widget)
- Initializes appropriate capture module based on platform
- Handles sidebar toggle and capture requests
- Bridges page context with extension context
- **Build Format**: IIFE (Immediately Invoked Function Expression)

### Storage Service

**File**: `src/services/storage.ts`

- Wraps `chrome.storage.local` API
- Provides typed interfaces for conversations and page contents
- **Version Control**:
  - Generates timestamped IDs: `{baseId}-{timestamp}`
  - Each save creates a new version
  - Supports version tagging
- **Methods**:
  - `saveConversation()`: Save ChatLLM conversation (creates new version)
  - `savePageContent()`: Save general page content (creates new version)
  - `getAllConversations()`: Get all conversation versions
  - `getAllPageContents()`: Get all page content versions
  - `deleteConversationVersion()`: Delete single version
  - `deletePageContentVersion()`: Delete single version
  - `deleteConversationsByBaseId()`: Delete all versions of a conversation
  - `deletePageContentsByBaseId()`: Delete all versions of a page content
  - `deleteDataSources()`: Batch delete multiple data sources
  - `updateVersionTag()`: Add/update version tag
  - `getVersionTag()`: Get version tag

### Data Loader Service

**File**: `src/services/data-loader.ts`

- Loads data from `chrome.storage.local`
- Converts stored data to `DataSource` format for UI display
- Groups versions by base ID (URL-based)
- Merges conversations and page contents into unified list
- Loads version tags from storage
- **Key Functions**:
  - `loadDataSources()`: Load and convert all data sources
  - `convertConversationsToDataSource()`: Convert conversation versions to DataSource
  - `convertPageContentsToDataSource()`: Convert page content versions to DataSource

### Platform Detector

**File**: `src/services/platform-detector.ts`

- Detects ChatLLM platforms by hostname
- Extracts session/conversation IDs from URLs
- Identifies platform-specific API endpoints
- **Supported Platforms**:
  - ChatGPT: `chatgpt.com`, `chat.openai.com`
  - Claude: `claude.ai`
  - Gemini: `gemini.google.com`
  - NoteBookLM: `notebooklm.google.com`
  - AI Studio: `aistudio.google.com`
  - Grok: `grok.com`, `x.com/i/grok`

### ChatLLM Capture Module

**File**: `src/content/capture/chatllm.ts`

- Platform-specific capture logic
- **API-based platforms** (ChatGPT, Claude, Grok):
  - Uses `api-helpers.ts` to intercept API calls
  - Fetches conversation data via API
  - Converts API responses to `ChatLLMConversation` format
- **DOM-based platforms** (Gemini, NoteBookLM, AI Studio):
  - Extracts messages from DOM using platform-specific selectors
  - Parses message roles and content
  - Generates timestamps
- **Title Extraction**:
  - Extracts from first message
  - Chinese: first 12 characters
  - English: first 5 words
  - Mixed: 12 units (1 Chinese char = 1 unit, 1 English word = 2 units)
  - Adds "..." suffix if truncated

### General Page Capture Module

**File**: `src/content/capture/general.ts`

- Extracts main content from general web pages
- Tries multiple selectors: `main`, `article`, `.main-content`, etc.
- Removes non-content elements (scripts, styles, navigation, ads)
- Strips HTML tags, extracts plain text
- Normalizes whitespace

### Workbench Component

**File**: `src/sidebar/components/Workbench.tsx`

- Main UI component for sidebar
- **Features**:
  - Three tabs: Chat, Data, Graph
  - Data sources list with filtering, sorting, search
  - Version selection and preview
  - Batch operations (selection, deletion)
  - Version tagging
  - Cross-page synchronization via `chrome.storage.onChanged`
- **State Management**:
  - React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`)
  - Filters: platform, type, search query
  - Sort order: ascending/descending by last saved time
  - Selected versions per data source
  - Preview content state

## Data Models

### ChatLLMConversation

```typescript
interface ChatLLMConversation {
  id: string;                    // Versioned ID: {baseId}-{timestamp}
  platform: ChatLLMPlatform;      // 'chatgpt' | 'claude' | 'gemini' | 'notebooklm' | 'aistudio' | 'grok'
  title: string;                 // Extracted from first message (with "..." if truncated)
  messages: ChatLLMMessage[];    // Array of messages
  capturedAt: number;            // Timestamp when captured
  url: string;                    // Page URL
}

interface ChatLLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;                // Message content (may include Markdown)
  timestamp: number;              // Message timestamp
}
```

### GeneralPageContent

```typescript
interface GeneralPageContent {
  id: string;                     // Versioned ID: {baseId}-{timestamp}
  url: string;                    // Page URL
  title: string;                  // Page title
  content: string;               // Plain text with HTML stripped
  capturedAt: number;            // Timestamp when captured
}
```

### DataSource

```typescript
interface DataSource {
  id: string;                     // Base ID (without timestamp)
  title: string;                  // Display title
  url: string;                    // Page URL
  type: 'web' | 'upload';         // Data source type
  platform?: ChatLLMPlatform | 'general' | 'demo'; // Platform identifier
  isUploaded: boolean;            // Upload status
  lastSaved: string;              // Human-readable last saved time
  ckgStatus: 'pending' | 'generated'; // Knowledge graph status
  relevanceScore?: number;       // Relevance score (0-1)
  currentVersionId: string;       // Currently selected version ID
  versions: SourceVersion[];     // Array of versions
}

interface SourceVersion {
  id: string;                     // Version ID (with timestamp)
  timestamp: string;              // Human-readable timestamp
  changeSummary: string;          // Change summary
  status?: 'local' | 'generated' | 'none'; // Version status
  tag?: string;                   // Custom tag
}
```

## Build Configuration

### Vite Configuration

**File**: `vite.config.ts`

- Multiple entry points:
  - `background.ts`: Background service worker (ES module)
  - `sidebar/index.html`: Sidebar React app (ES module)
- Output configuration for browser extension structure
- Post-build plugin to copy and fix manifest and sidebar files
- **Note**: `content.ts` is built separately (see `build-content.js`)

### Content Script Build

**File**: `build-content.js`

- Custom build script for `content.ts`
- Builds as IIFE (Immediately Invoked Function Expression)
- Required format for Chrome Extension content scripts
- Uses `inlineDynamicImports: true` for single-file output
- **Build Command**: `node build-content.js`

### Build Process

1. **TypeScript Compilation**: `tsc -b` (type checking)
2. **Vite Build**: Builds background script and sidebar
3. **Content Script Build**: `node build-content.js` (builds content.js as IIFE)

### Manifest V3

**File**: `public/manifest.json`

- Service worker for background script (`"type": "module"`)
- Content scripts for all URLs (`content.js`)
- Web accessible resources for sidebar (`sidebar.html`, `sidebar.js`, `sidebar.css`)
- Host permissions for ChatLLM platforms
- Storage permission for data persistence

## Communication Flow

1. **Content Script ↔ Background**: 
   - Messages for data storage (`SAVE_CONVERSATION`, `SAVE_PAGE_CONTENT`)
   - Messages for data retrieval (`GET_ALL_DATA`)
   - Uses `chrome.runtime.sendMessage()` and `chrome.runtime.onMessage.addListener()`

2. **Sidebar ↔ Background**: 
   - Messages for data queries (`GET_ALL_DATA`)
   - Uses `chrome.runtime.sendMessage()`

3. **Page ↔ Content Script**: 
   - Direct function calls for sidebar toggle
   - Window message events for data capture notifications

4. **Cross-Page Synchronization**:
   - `chrome.storage.onChanged` listener in sidebar
   - Automatically refreshes data when storage changes

## Security Considerations

- **Content Security Policy**: Compliance with CSP restrictions
- **Isolated Contexts**: Content script vs page context separation
- **Secure Message Passing**: All storage operations go through background script
- **Storage Quota Management**: Chrome storage limits (typically 10MB)
- **No Direct Storage Access**: Content scripts use message passing instead of direct `chrome.storage` access

## Performance Considerations

- **Lazy Loading**: Sidebar components loaded on demand
- **Memoization**: React `useMemo` for filtered/sorted data
- **Debouncing**: Potential for debouncing DOM observers
- **Code Splitting**: Vite code splitting for sidebar chunks
- **IIFE Build**: Single-file content script for faster injection
