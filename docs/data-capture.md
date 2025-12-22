# Data Capture Documentation

## Overview

The extension supports two capture modes:
1. **ChatLLM Mode**: Captures conversations from AI chat platforms
2. **General Mode**: Captures main content from any webpage

## ChatLLM Platform Capture

### Supported Platforms

| Platform | Domain | Capture Method | Features |
|----------|--------|----------------|----------|
| ChatGPT | `chatgpt.com`, `chat.openai.com` | API Interception | Full conversation history, tool calls, Unicode decoding |
| Claude | `claude.ai` | API Interception | Complete message threads, attachments |
| Gemini | `gemini.google.com` | DOM Extraction | Real-time message capture, title extraction |
| NoteBookLM | `notebooklm.google.com` | DOM Extraction | Conversation threads, source tracking |
| AI Studio | `aistudio.google.com` | DOM Extraction | Multi-turn conversations, context preservation |
| Grok | `grok.com`, `x.com/i/grok` | API Interception | Citation handling, `<grok:render>` tag processing |

### Capture Mechanism

#### Platform Detection

Platforms are detected by hostname using `PlatformDetector.detectPlatform()`:

```typescript
const platform = PlatformDetector.detectPlatform();
// Returns: 'chatgpt' | 'claude' | 'gemini' | 'notebooklm' | 'aistudio' | 'grok' | null
```

#### Session ID Extraction

Session/conversation IDs are extracted from URLs:

- **ChatGPT**: `/c/{session_id}` or `/g/{gizmo_id}/c/{session_id}`
- **Claude**: `/chat/{conversation_id}`
- **Gemini**: `/app/{id}` (optional, generated if not found)
- **Grok**: `/c/{conversation_id}` or `/project/{project_id}?chat={chat_id}`
- **NoteBookLM**: `/notebook/{id}` (optional, generated if not found)
- **AI Studio**: `/app/{id}` (optional, generated if not found)

#### Capture Methods

##### API-Based Capture (ChatGPT, Claude, Grok)

**File**: `src/content/capture/api-helpers.ts`

- **ChatGPT**:
  - Intercepts `fetch` calls to `/backend-api/conversation/{id}`
  - Captures access token from localStorage
  - Fetches conversation data via API
  - Processes `content.parts` array, filters tool calls
  - Decodes Unicode escape sequences in tool call strings

- **Claude**:
  - Intercepts `fetch` calls to `/api/organizations/{orgId}/chat_conversations/{id}`
  - Captures user ID from localStorage
  - Fetches conversation data via API
  - Processes message threads and attachments

- **Grok**:
  - Intercepts `fetch` calls to `/api/grok/conversations/{id}`
  - Fetches conversation data via API
  - Processes `<grok:render>` tags:
    - Replaces with Markdown links if citations found
    - Removes tags if no citations
  - Handles citation data

##### DOM-Based Capture (Gemini, NoteBookLM, AI Studio)

**File**: `src/content/capture/chatllm.ts`

- **Gemini**:
  - Selectors: `[data-message-type]`, `.model-response-text`
  - Role detection: `data-message-type` attribute
  - Extracts messages from DOM
  - Generates timestamps

- **NoteBookLM**:
  - Selectors: `.message`, `[role="article"]`
  - Role detection: `data-role` attribute
  - Extracts conversation threads
  - Handles source tracking

- **AI Studio**:
  - Similar to Gemini
  - Selectors: `[data-message-type]`, `.model-response-text`
  - Role detection: `data-message-type` attribute
  - Extracts multi-turn conversations

#### Title Extraction

**File**: `src/content/capture/chatllm.ts` → `extractTitleFromFirstMessage()`

- Extracts title from the first non-empty message
- **Rules**:
  - **Pure Chinese**: First 12 Chinese characters + "..."
  - **Pure English**: First 5 words + "..."
  - **Mixed Languages**: 12 units total (1 Chinese char = 1 unit, 1 English word = 2 units) + "..."
  - **Other Languages**: First 12 characters + "..."
- **Suffix**: Adds "..." if title is truncated (not "Untitled Conversation")

#### Data Format

```typescript
interface ChatLLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;                // Message content (may include Markdown)
  timestamp: number;              // Message timestamp
}

interface ChatLLMConversation {
  id: string;                     // Versioned ID: {baseId}-{timestamp}
  platform: ChatLLMPlatform;     // Platform identifier
  title: string;                  // Extracted title (with "..." if truncated)
  messages: ChatLLMMessage[];     // Array of messages
  capturedAt: number;             // Capture timestamp
  url: string;                    // Page URL
}
```

#### Special Processing

- **ChatGPT Tool Calls**: 
  - Filters out `function_call` and `tool_calls` parts
  - Decodes Unicode escape sequences (e.g., `\u5e74` → `年`)
  - Preserves text content only

- **Grok Citations**:
  - Processes `<grok:render>` tags
  - Converts to Markdown links: `[citation](citation_id)`
  - Removes tags if no citation data available

- **NotebookLM "undefined" Issue**:
  - Fixed by ensuring `textContent` is not `undefined` before concatenation
  - Uses `(value || '') + ' '` pattern

## General Page Capture

### Capture Mechanism

**File**: `src/content/capture/general.ts`

1. **Main Content Detection**: Tries multiple selectors to find main content:
   - `main`, `article`, `[role="main"]`
   - `.main-content`, `.content`, `#content`, `#main`
   - `.post-content`, `.entry-content`

2. **Content Cleaning**:
   - Removes script, style, noscript, iframe, embed, object elements
   - Removes navigation, header, footer, sidebar, ads
   - Extracts text content (automatically strips HTML tags)

3. **Text Processing**:
   - Normalizes whitespace
   - Removes empty lines
   - Trims content

### Data Format

```typescript
interface GeneralPageContent {
  id: string;                     // Versioned ID: {baseId}-{timestamp}
  url: string;                    // Page URL
  title: string;                  // Page title (from document.title)
  content: string;               // Plain text with HTML stripped
  capturedAt: number;            // Capture timestamp
}
```

## Storage

### Chrome Storage API

Data is stored in `chrome.storage.local`:

- **Key**: `sys2path_conversations` (array of `ChatLLMConversation`)
- **Key**: `sys2path_page_contents` (array of `GeneralPageContent`)
- **Key**: `sys2path_version_tags` (object mapping version ID to tag string)

### Storage Service

**File**: `src/services/storage.ts`

The `StorageService` provides typed interfaces:

```typescript
// Save conversation (creates new version)
await StorageService.saveConversation(conversation);

// Get all conversations
const conversations = await StorageService.getAllConversations();

// Save page content (creates new version)
await StorageService.savePageContent(pageContent);

// Get all page contents
const contents = await StorageService.getAllPageContents();

// Delete single version
await StorageService.deleteConversationVersion(versionId);
await StorageService.deletePageContentVersion(versionId);

// Delete all versions
await StorageService.deleteConversationsByBaseId(baseId);
await StorageService.deletePageContentsByBaseId(baseId);

// Batch delete
await StorageService.deleteDataSources([baseId1, baseId2]);

// Version tagging
await StorageService.updateVersionTag(versionId, tag);
const tag = await StorageService.getVersionTag(versionId);
```

### Version Control

- **ID Format**: `{baseId}-{timestamp}`
  - `baseId`: Original session/conversation ID or URL hash
  - `timestamp`: Capture timestamp (milliseconds)
- **New Version**: Each save creates a new entry with timestamped ID
- **Grouping**: Versions are grouped by `baseId` in UI
- **Tagging**: Each version can have a custom tag

### Message Passing

**Important**: Content scripts cannot directly access `chrome.storage.local` in some contexts. Therefore, all storage operations go through message passing:

```typescript
// In content script
chrome.runtime.sendMessage({
  type: 'SAVE_CONVERSATION',
  data: conversation
}, (response) => {
  if (response?.success) {
    console.log('Saved successfully');
  }
});

// In background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_CONVERSATION') {
    StorageService.saveConversation(message.data)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
});
```

## Reference Implementation

The ChatLLM capture implementation is based on `examples/lyra_exporter_fetch.js`, which provides:
- Platform-specific extraction logic
- Message role detection
- Timestamp handling
- Conversation structure
- Title extraction methods
- Citation handling (for Grok)

## Limitations

1. **DOM Selectors**: Platform-specific selectors may break if platforms update their HTML structure
2. **API Changes**: API endpoints may change, requiring updates to interception logic
3. **Storage Quota**: Chrome storage has limits (typically 10MB)
4. **CSP**: Some pages may have Content Security Policy restrictions
5. **Real-time Capture**: DOM-based capture may miss rapid updates
6. **Title Extraction**: Title extraction may not work perfectly for all languages

## Future Enhancements

1. Network interception for more reliable capture
2. Enhanced message extraction with fallback selectors
3. Support for additional platforms
4. Incremental capture for large conversations
5. Export functionality for captured data
6. Better title extraction for mixed languages
7. Support for attachments and media files
