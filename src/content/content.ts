/**
 * Content Script
 * Injects sidebar and handles page capture
 */

import { PlatformDetector } from '../services/platform-detector';
import { ChatLLMCapture } from './capture/chatllm';
import { GeneralPageCapture } from './capture/general';
import { injectOverlayWidget, injectToggleButton, updateToggleButton, updateOverlayWidgetState, updateOverlayWidgetPosition, resetOverlayWidgetInjected } from './ui-injector';
import { configService } from '../services/config-service';

let sidebarInjected = false;
let sidebarContainer: HTMLElement | null = null;
let isSidebarOpen = false;
let chatLLMCapture: ChatLLMCapture | null = null;
let generalCapture: GeneralPageCapture | null = null;
let sidebarWidth = 450; // Default width in pixels
let isResizing = false;

console.log('[CONTENT] Content script loaded');

// Initialize capture based on platform (but don't auto-capture)
// This function can be safely called multiple times to re-initialize capture
// for the current page (e.g., when user navigates to a different chat session)
function initCapture(): void {
  const platform = PlatformDetector.detectPlatform();
  
  if (platform) {
    // ChatLLM platform - re-initialize to ensure we use current page info
    console.log('[CONTENT] Initializing ChatLLM capture for:', platform);
    chatLLMCapture = new ChatLLMCapture();
    chatLLMCapture.init();
    // Clear general capture if it was set before
    generalCapture = null;
    // Don't auto-capture - wait for user to click save button
  } else {
    // General page - re-initialize to ensure we use current page info
    console.log('[CONTENT] Initializing general page capture');
    generalCapture = new GeneralPageCapture();
    // Clear chatLLM capture if it was set before
    chatLLMCapture = null;
    // Don't auto-capture - wait for user to click save button
  }
}

// Load sidebar width from storage
async function loadSidebarWidth(): Promise<number> {
  try {
    const result = await chrome.storage.local.get('sidebarWidth');
    return (typeof result.sidebarWidth === 'number' ? result.sidebarWidth : 450);
  } catch (error) {
    console.error('[CONTENT] Failed to load sidebar width:', error);
    return 450;
  }
}

// Save sidebar width to storage
async function saveSidebarWidth(width: number): Promise<void> {
  try {
    await chrome.storage.local.set({ sidebarWidth: width });
  } catch (error) {
    console.error('[CONTENT] Failed to save sidebar width:', error);
  }
}

// Inject sidebar
async function injectSidebar(): Promise<void> {
  if (sidebarInjected) return;

  // Load saved width
  sidebarWidth = await loadSidebarWidth();

  // Create sidebar container
  sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'sys2path-sidebar-container';
  sidebarContainer.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: ${sidebarWidth}px;
    height: 100vh;
    z-index: 999999;
    background: white;
    box-shadow: -2px 0 10px rgba(0,0,0,0.1);
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out;
  `;

  // Create resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.id = 'sys2path-sidebar-resize-handle';
  resizeHandle.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 4px;
    height: 100%;
    cursor: col-resize;
    background: transparent;
    z-index: 1000000;
    transition: background 0.2s ease;
  `;

  resizeHandle.addEventListener('mouseenter', () => {
    if (!isResizing) {
      resizeHandle.style.background = 'rgba(59, 130, 246, 0.5)';
    }
  });

  resizeHandle.addEventListener('mouseleave', () => {
    if (!isResizing) {
      resizeHandle.style.background = 'transparent';
    }
  });

  // Resize handlers
  const handleResizeStart = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    resizeHandle.style.background = 'rgba(59, 130, 246, 0.8)';
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing || !sidebarContainer) return;
    
    const newWidth = window.innerWidth - e.clientX;
    const minWidth = 300;
    const maxWidth = 800;
    const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
    
    sidebarWidth = clampedWidth;
    sidebarContainer.style.width = `${sidebarWidth}px`;
    sidebarContainer.style.transition = 'none'; // Disable transition during resize
    
    // Update toggle button and overlay widget positions
    updateToggleButton(isSidebarOpen, sidebarWidth);
    updateOverlayWidgetPosition(isSidebarOpen, sidebarWidth);
  };

  const handleResizeEnd = () => {
    if (!isResizing) return;
    
    isResizing = false;
    resizeHandle.style.background = 'transparent';
    if (sidebarContainer) {
      sidebarContainer.style.transition = 'transform 0.3s ease-in-out';
    }
    
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    
    // Save width to storage
    saveSidebarWidth(sidebarWidth);
  };

  resizeHandle.addEventListener('mousedown', handleResizeStart);

  // Create iframe for sidebar
  const iframe = document.createElement('iframe');
  iframe.id = 'sys2path-sidebar-iframe';
  iframe.src = chrome.runtime.getURL('sidebar.html');
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;

  sidebarContainer.appendChild(resizeHandle);
  sidebarContainer.appendChild(iframe);
  document.body.appendChild(sidebarContainer);
  sidebarInjected = true;

  console.log('[CONTENT] Sidebar injected with width:', sidebarWidth);
}

// Toggle sidebar
function toggleSidebar(): void {
  if (!sidebarContainer) {
    injectSidebar().then(() => {
      // Wait for sidebar to be injected, then open it
      setTimeout(() => {
        if (sidebarContainer) {
          sidebarContainer.style.transform = 'translateX(0px)';
          isSidebarOpen = true;
          updateToggleButton(true, sidebarWidth);
          updateOverlayWidgetPosition(true, sidebarWidth);
        }
      }, 100);
    });
    return;
  }

  isSidebarOpen = !isSidebarOpen;
  sidebarContainer.style.transform = isSidebarOpen ? 'translateX(0px)' : 'translateX(100%)';
  updateToggleButton(isSidebarOpen, sidebarWidth);
  updateOverlayWidgetPosition(isSidebarOpen, sidebarWidth);
  console.log('[CONTENT] Sidebar toggled:', isSidebarOpen ? 'open' : 'closed');
}

// Handle capture request - only when user clicks save button
async function handleCapture(): Promise<void> {
  console.log('[CONTENT] Capture triggered by user');
  
  // Re-initialize capture module to ensure we use current page information
  // This is important when user navigates to a different chat session or switches tabs
  initCapture();
  
  // Set loading state
  updateOverlayWidgetState('loading');
  
  try {
    let capturedData: any = null;
    
    if (chatLLMCapture) {
      capturedData = await chatLLMCapture.capture();
    } else if (generalCapture) {
      capturedData = await generalCapture.capture();
    } else {
      throw new Error('No capture module initialized');
    }
    
    if (!capturedData) {
      throw new Error('Failed to capture data');
    }
    
    // Check for duplicate message
    const duplicateMessage = (capturedData as any).__duplicateMessage;
    if (duplicateMessage) {
      // Show duplicate message to user (non-interrupting)
      console.log('[CONTENT] Duplicate content detected:', duplicateMessage);
      // Set success state (duplicate is still a successful operation, just no new data)
      updateOverlayWidgetState('success');
      // Still notify sidebar, but with duplicate flag
      const iframe = document.getElementById('sys2path-sidebar-iframe') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'DATA_CAPTURED',
          data: capturedData,
          duplicateMessage: duplicateMessage
        }, '*');
      }
      // Reset to idle state after a delay
      setTimeout(() => {
        updateOverlayWidgetState('idle');
      }, 2000);
    } else {
      // Set success state
      updateOverlayWidgetState('success');
      
      // Notify sidebar to refresh data
      const iframe = document.getElementById('sys2path-sidebar-iframe') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'DATA_CAPTURED',
          data: capturedData
        }, '*');
      }
    }
    
    // Also notify background to refresh
    chrome.runtime.sendMessage({
      type: 'DATA_REFRESHED'
    }).catch(err => console.error('[CONTENT] Failed to notify background:', err));
    
    console.log('[CONTENT] Data captured successfully');
  } catch (error) {
    console.error('[CONTENT] Capture failed:', error);
    
    // Set error state
    updateOverlayWidgetState('error');
    
    // Show error message to user
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[CONTENT] Capture error:', errorMessage);
  }
}

// Helper function to copy text to clipboard with fallback
async function copyToClipboard(text: string): Promise<boolean> {
  // Method 1: Try Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('[CONTENT] Clipboard API failed, trying fallback:', e);
      // Fall through to fallback method
    }
  }
  
  // Method 2: Try document.execCommand fallback
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-999999px';
  textarea.style.top = '-999999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  
  try {
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (e) {
    document.body.removeChild(textarea);
    console.error('[CONTENT] execCommand copy failed:', e);
    return false;
  }
}

// Listen for messages from background or sidebar
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[CONTENT] Message received:', message.type);

  switch (message.type) {
    case 'EXTENSION_ICON_CLICKED':
    case 'TOGGLE_SIDEBAR':
      toggleSidebar();
      sendResponse({ success: true });
      break;

    case 'CAPTURE_PAGE':
      handleCapture()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'TOGGLE_OVERLAY_WIDGET':
      handleOverlayWidgetToggle(message.enabled);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Listen for messages from sidebar iframe (for copy operation)
window.addEventListener('message', async (event: MessageEvent) => {
  // Verify message is from our sidebar iframe
  const iframe = document.getElementById('sys2path-sidebar-iframe') as HTMLIFrameElement;
  if (!iframe || event.source !== iframe.contentWindow) {
    return;
  }
  
  if (event.data && event.data.type === 'COPY_TO_CLIPBOARD') {
    console.log('[CONTENT] Copy request received from sidebar');
    try {
      const success = await copyToClipboard(event.data.text);
      
      // Send result back to sidebar
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'COPY_TO_CLIPBOARD_RESULT',
          success,
          error: success ? undefined : 'All copy methods failed'
        }, '*');
      }
    } catch (error) {
      console.error('[CONTENT] Failed to copy:', error);
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'COPY_TO_CLIPBOARD_RESULT',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, '*');
      }
    }
  }
});

// Handle overlay widget toggle
async function handleOverlayWidgetToggle(enabled: boolean): Promise<void> {
  if (enabled) {
    // Check if widget already exists
    const existingWidget = document.getElementById('sys2path-overlay-widget');
    if (!existingWidget) {
      // Inject overlay widget if not already injected
      injectOverlayWidget(() => {
        console.log('[CONTENT] Overlay widget clicked - capturing data');
        handleCapture();
      }, isSidebarOpen, sidebarWidth);
    } else {
      // Widget exists, just make sure it's visible
      existingWidget.style.display = 'flex';
    }
  } else {
    // Remove overlay widget
    const widget = document.getElementById('sys2path-overlay-widget');
    if (widget) {
      widget.remove();
      // Reset the injected flag so it can be re-injected later
      resetOverlayWidgetInjected();
    }
  }
}

// Initialize UI and capture
async function initializeUI(): Promise<void> {
  // Load saved width
  sidebarWidth = await loadSidebarWidth();

  // Load overlay widget config
  const config = await configService.getConfig();
  if (config.overlayWidgetEnabled) {
    // Inject overlay widget - only capture, don't toggle sidebar
    injectOverlayWidget(() => {
      console.log('[CONTENT] Overlay widget clicked - capturing data');
      handleCapture();
      // Don't automatically open sidebar - let user open it manually if needed
    }, false, sidebarWidth);
  }

  // Inject toggle button
  injectToggleButton(() => {
    console.log('[CONTENT] Toggle button clicked');
    toggleSidebar();
  }, false, sidebarWidth);

  // Initialize capture
  initCapture();

  // Listen for config changes
  configService.addListener((config) => {
    handleOverlayWidgetToggle(config.overlayWidgetEnabled);
  });
}


// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
  });
} else {
  initializeUI();
}

// Export for use in other scripts
(window as any).sys2pathContent = {
  toggleSidebar,
  capture: handleCapture
};

