# Operations Documentation

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Chrome/Chromium browser for testing

### Installation

```bash
cd sys2path-plugin-demo
npm install
```

### Development

```bash
npm run dev
```

**Note**: For browser extension development, you'll need to build and load the extension manually. The `dev` command is mainly for testing React components in isolation.

### Build

```bash
npm run build
```

This will:
1. **TypeScript Compilation**: `tsc -b` (type checking)
2. **Vite Build**: Builds background script and sidebar React app
   - Outputs: `background.js`, `sidebar.js`, `sidebar.css`, `sidebar.html`
   - Uses ES module format
3. **Content Script Build**: `node build-content.js` (builds content.js as IIFE)
   - Outputs: `content.js` (single file, IIFE format)
   - Required format for Chrome Extension content scripts

### Build Output

After building, `dist/` contains:

```
dist/
├── manifest.json              # Copied from public/
├── background.js              # Compiled background script (ES module)
├── content.js                 # Compiled content script (IIFE)
├── sidebar.html               # Processed sidebar HTML
├── sidebar.js                 # Compiled sidebar React app (ES module)
├── sidebar.css                # Compiled CSS
├── chunks/                    # Code splitting chunks
│   ├── storage-*.js          # Storage service chunk
│   └── ...
└── assets/                    # Static assets
    └── ...
```

## Loading Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/` directory from the project
5. The extension should now be loaded

## Project Structure

```
sys2path-plugin-demo/
├── public/
│   └── manifest.json          # Extension manifest (Manifest V3)
├── src/
│   ├── background/            # Background service worker
│   │   └── background.ts      # Handles extension lifecycle and message passing
│   ├── content/               # Content scripts
│   │   ├── content.ts         # Main content script for sidebar injection
│   │   ├── ui-injector.ts     # UI injection utilities
│   │   └── capture/           # Data capture modules
│   │       ├── chatllm.ts      # ChatLLM platform capture
│   │       ├── general.ts     # General page capture
│   │       └── api-helpers.ts # API interception helpers
│   ├── sidebar/               # React sidebar UI
│   │   ├── components/        # UI components
│   │   │   ├── Workbench.tsx  # Main workbench component
│   │   │   ├── GraphView.tsx  # Knowledge graph visualization
│   │   │   └── OverlayWidget.tsx # Floating save button
│   │   ├── main.tsx           # Sidebar entry point
│   │   └── index.html         # Sidebar HTML
│   ├── services/              # Business logic
│   │   ├── storage.ts         # Chrome storage wrapper
│   │   ├── data-loader.ts     # Data loading and conversion
│   │   ├── platform-detector.ts # Platform detection
│   │   └── mockData.ts        # Mock data for development
│   └── types/                 # TypeScript types
│       ├── index.ts           # Main types
│       └── capture.ts         # Capture-specific types
├── docs/                      # Documentation
├── build-content.js           # Custom build script for content.js
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
├── tsconfig.app.json          # TypeScript app configuration
├── tsconfig.node.json         # TypeScript node configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── postcss.config.js          # PostCSS configuration
└── package.json               # Dependencies and scripts
```

## Development Workflow

### Making Changes

1. **UI Components**: Edit files in `src/sidebar/components/`
2. **Capture Logic**: Edit files in `src/content/capture/`
3. **Background Logic**: Edit `src/background/background.ts`
4. **Types**: Edit files in `src/types/`
5. **Services**: Edit files in `src/services/`

### Testing Changes

1. Make your changes
2. Run `npm run build`
3. In Chrome extensions page, click the reload icon on your extension
4. Refresh the target page (or navigate to a new page)
5. Test the changes

### Debugging

#### Background Script

1. Open `chrome://extensions/`
2. Find your extension
3. Click "service worker" link (or "Inspect views: service worker")
4. Console logs will appear here
5. Look for `[BACKGROUND]` prefix in logs

#### Content Script

1. Open DevTools on the target page (F12)
2. Console logs from content script will appear here
3. Look for `[CONTENT]` prefix in logs
4. Check for `[CAPTURE]` logs for capture-related messages

#### Sidebar

1. Right-click on the sidebar iframe
2. Select "Inspect"
3. DevTools will open for the sidebar context
4. Look for `[WORKBENCH]` prefix in logs

#### Storage Inspection

1. Open DevTools on any page
2. Go to "Application" tab
3. Navigate to "Storage" → "Local Storage" → `chrome-extension://{extension-id}`
4. Or use Chrome Extensions page → "Storage" section

## Common Issues

### Extension Not Loading

- Check `manifest.json` for syntax errors
- Verify all entry points exist in `dist/`
- Check browser console for errors
- Ensure `background.js` has `"type": "module"` in manifest

### Sidebar Not Appearing

- Check content script is injected (look for `[CONTENT]` logs)
- Verify `sidebar.html` is accessible (check `web_accessible_resources` in manifest)
- Check for CSP errors in console
- Ensure sidebar iframe is injected into page DOM

### Capture Not Working

- Verify platform detection (check console logs for `[CAPTURE]`)
- Check DOM selectors match current page structure
- Verify storage permissions in manifest
- Check for API interception errors (for API-based platforms)
- Ensure message passing is working (check `[BACKGROUND]` logs)

### Build Errors

- **TypeScript Errors**: Run `npm run build` to see TypeScript errors
- **Vite Build Errors**: Check `vite.config.ts` configuration
- **Content Script Build Errors**: Check `build-content.js` for issues
- **Module Errors**: Ensure `"type": "module"` in `package.json` and manifest background section

### Content Script Module Error

**Error**: `Uncaught SyntaxError: Cannot use import statement outside a module`

**Solution**: 
- Content script must be built as IIFE (not ES module)
- Ensure `build-content.js` is run after `vite build`
- Check `build-content.js` has `format: 'iife'` and `inlineDynamicImports: true`

### Background Script Module Error

**Error**: `Service worker registration failed. Status code: 15` or `Cannot use import statement outside a module`

**Solution**:
- Ensure manifest.json has `"type": "module"` in background section:
  ```json
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
  ```
- Ensure `background.js` is built as ES module (default in vite.config.ts)

### Storage Access Error

**Error**: `Cannot read properties of undefined (reading 'local')`

**Solution**:
- Content scripts should use message passing instead of direct `chrome.storage` access
- Send `SAVE_CONVERSATION` or `SAVE_PAGE_CONTENT` messages to background script
- Background script handles storage operations

## Deployment

### Preparing for Release

1. Update version in `package.json` and `manifest.json`
2. Build: `npm run build`
3. Test thoroughly on all supported platforms
4. Create zip: `cd dist && zip -r ../sys2path-plugin-demo-v0.1.0.zip .`
5. Verify zip contains all necessary files

### Chrome Web Store Submission

1. Create developer account at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Prepare store assets:
   - Icons (16x16, 48x48, 128x128)
   - Screenshots (1280x800 or 640x400)
   - Description (detailed, highlighting features)
   - Privacy policy (if collecting user data)
3. Upload zip file
4. Fill out store listing:
   - Name, description, category
   - Permissions justification
   - Privacy practices
5. Submit for review

## Maintenance

### Updating Dependencies

```bash
npm update
npm audit fix
```

### Type Checking

```bash
npm run build
# TypeScript errors will be shown
```

### Linting

```bash
npm run lint
```

### Cleaning Build Artifacts

```bash
rm -rf dist
npm run build
```

## Troubleshooting

### Storage Quota Exceeded

- Implement data cleanup/archival
- Add storage usage monitoring
- Consider compression for large data
- Implement version pruning (keep only N latest versions)

### Performance Issues

- Optimize DOM queries (cache selectors)
- Debounce MutationObserver callbacks
- Implement lazy loading for sidebar
- Use React `useMemo` for expensive computations
- Consider pagination for large data lists

### Cross-Origin Issues

- Verify `host_permissions` in manifest
- Check `web_accessible_resources` configuration
- Use `chrome.runtime` messaging instead of direct access
- Ensure CORS headers are handled correctly

### Version Control Issues

- Check ID generation logic in `storage.ts`
- Verify timestamp format is correct
- Ensure base ID extraction works correctly
- Check for duplicate versions

### Cross-Page Synchronization Not Working

- Verify `chrome.storage.onChanged` listener is set up
- Check listener is not removed prematurely
- Ensure storage keys match between save and load
- Check for errors in storage change handler

## Build Scripts

### package.json Scripts

- `npm run dev`: Start Vite dev server (for component testing)
- `npm run build`: Full build (TypeScript + Vite + Content Script)
- `npm run build:content`: Build only content script
- `npm run lint`: Run ESLint
- `npm run preview`: Preview Vite build (not used for extension)

### Custom Build Script

**File**: `build-content.js`

- Builds `content.ts` as IIFE
- Required for Chrome Extension content scripts
- Uses Vite's build API
- Outputs single file: `content.js`
