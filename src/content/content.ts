/**
 * Content Script
 * Injects sidebar and handles page capture
 */

import { PlatformDetector } from '../services/platform-detector';
import { ChatLLMCapture } from './capture/chatllm';
import { GeneralPageCapture } from './capture/general';
import { injectOverlayWidget, injectToggleButton, updateToggleButton, updateOverlayWidgetState, updateOverlayWidgetPosition } from './ui-injector';

let sidebarInjected = false;
let sidebarContainer: HTMLElement | null = null;
let isSidebarOpen = false;
let chatLLMCapture: ChatLLMCapture | null = null;
let generalCapture: GeneralPageCapture | null = null;

console.log('[CONTENT] Content script loaded');

// Initialize capture based on platform (but don't auto-capture)
function initCapture(): void {
  const platform = PlatformDetector.detectPlatform();
  
  if (platform) {
    // ChatLLM platform
    console.log('[CONTENT] Initializing ChatLLM capture for:', platform);
    chatLLMCapture = new ChatLLMCapture();
    chatLLMCapture.init();
    // Don't auto-capture - wait for user to click save button
  } else {
    // General page
    console.log('[CONTENT] Initializing general page capture');
    generalCapture = new GeneralPageCapture();
    // Don't auto-capture - wait for user to click save button
  }
}

// Inject sidebar
function injectSidebar(): void {
  if (sidebarInjected) return;

  // Create sidebar container
  sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'sys2path-sidebar-container';
  sidebarContainer.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 450px;
    height: 100vh;
    z-index: 999999;
    background: white;
    box-shadow: -2px 0 10px rgba(0,0,0,0.1);
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out;
  `;

  // Create iframe for sidebar
  const iframe = document.createElement('iframe');
  iframe.id = 'sys2path-sidebar-iframe';
  iframe.src = chrome.runtime.getURL('sidebar.html');
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;

  sidebarContainer.appendChild(iframe);
  document.body.appendChild(sidebarContainer);
  sidebarInjected = true;

  console.log('[CONTENT] Sidebar injected');
}

// Toggle sidebar
function toggleSidebar(): void {
  if (!sidebarContainer) {
    injectSidebar();
    // Wait for sidebar to be injected, then open it
    setTimeout(() => {
      if (sidebarContainer) {
        sidebarContainer.style.transform = 'translateX(0px)';
        isSidebarOpen = true;
        updateToggleButton(true);
        updateOverlayWidgetPosition(true);
      }
    }, 100);
    return;
  }

  isSidebarOpen = !isSidebarOpen;
  sidebarContainer.style.transform = isSidebarOpen ? 'translateX(0px)' : 'translateX(100%)';
  updateToggleButton(isSidebarOpen);
  updateOverlayWidgetPosition(isSidebarOpen);
  console.log('[CONTENT] Sidebar toggled:', isSidebarOpen ? 'open' : 'closed');
}

// Handle capture request - only when user clicks save button
async function handleCapture(): Promise<void> {
  console.log('[CONTENT] Capture triggered by user');
  
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

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Initialize UI and capture
function initializeUI(): void {
  // Inject overlay widget - only capture, don't toggle sidebar
  injectOverlayWidget(() => {
    console.log('[CONTENT] Overlay widget clicked - capturing data');
    handleCapture();
    // Don't automatically open sidebar - let user open it manually if needed
  }, false);

  // Inject toggle button
  injectToggleButton(() => {
    console.log('[CONTENT] Toggle button clicked');
    toggleSidebar();
  }, false);

  // Initialize capture
  initCapture();
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

