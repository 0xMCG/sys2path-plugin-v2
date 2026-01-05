/**
 * Background Service Worker
 * Handles extension lifecycle and message passing
 */

import { StorageService } from '../services/storage';

console.log('[BACKGROUND] Service worker initialized');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[BACKGROUND] Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Initialize storage with correct keys
    chrome.storage.local.set({
      sys2path_conversations: [],
      sys2path_page_contents: []
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  
  console.log('[BACKGROUND] Extension icon clicked');
  
  // Send message to content script to toggle sidebar
  chrome.tabs.sendMessage(tab.id, {
    type: 'EXTENSION_ICON_CLICKED'
  }).catch((error) => {
    console.error('[BACKGROUND] Failed to send message to content script:', error);
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[BACKGROUND] Message received:', message.type);

  switch (message.type) {
    case 'CAPTURE_CONVERSATION':
      handleCaptureConversation(message.data)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    case 'CAPTURE_PAGE':
      handleCapturePage(message.data)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_CONVERSATIONS':
      handleGetConversations()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_PAGE_CONTENTS':
      handleGetPageContents()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_ALL_DATA':
      handleGetAllData()
        .then(data => sendResponse({ success: true, ...data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'SAVE_CONVERSATION':
      StorageService.saveConversation(message.data)
        .then(result => sendResponse({ success: result.saved, message: result.message }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    case 'SAVE_PAGE_CONTENT':
      StorageService.savePageContent(message.data)
        .then(result => sendResponse({ success: result.saved, message: result.message }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    default:
      console.warn('[BACKGROUND] Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

/**
 * Handle conversation capture
 */
async function handleCaptureConversation(data: any): Promise<void> {
  try {
    const result = await chrome.storage.local.get('sys2path_conversations');
    const conversations: any[] = Array.isArray(result.sys2path_conversations) ? result.sys2path_conversations : [];
    
    // Check if conversation already exists
    const existingIndex = conversations.findIndex((c: any) => c.id === data.id);
    if (existingIndex >= 0) {
      conversations[existingIndex] = data;
    } else {
      conversations.push(data);
    }
    
    await chrome.storage.local.set({ sys2path_conversations: conversations });
    console.log('[BACKGROUND] Saved conversation:', data.id);
  } catch (error) {
    console.error('[BACKGROUND] Failed to save conversation:', error);
    throw error;
  }
}

/**
 * Handle page content capture
 */
async function handleCapturePage(data: any): Promise<void> {
  try {
    const result = await chrome.storage.local.get('sys2path_page_contents');
    const pageContents: any[] = Array.isArray(result.sys2path_page_contents) ? result.sys2path_page_contents : [];
    
    const existingIndex = pageContents.findIndex((p: any) => p.id === data.id);
    if (existingIndex >= 0) {
      pageContents[existingIndex] = data;
    } else {
      pageContents.push(data);
    }
    
    await chrome.storage.local.set({ sys2path_page_contents: pageContents });
    console.log('[BACKGROUND] Saved page content:', data.id);
  } catch (error) {
    console.error('[BACKGROUND] Failed to save page content:', error);
    throw error;
  }
}

/**
 * Get all conversations
 */
async function handleGetConversations(): Promise<any[]> {
  try {
    const result = await chrome.storage.local.get('sys2path_conversations');
    return Array.isArray(result.sys2path_conversations) ? result.sys2path_conversations : [];
  } catch (error) {
    console.error('[BACKGROUND] Failed to get conversations:', error);
    return [];
  }
}

/**
 * Get all page contents
 */
async function handleGetPageContents(): Promise<any[]> {
  try {
    const result = await chrome.storage.local.get('sys2path_page_contents');
    return Array.isArray(result.sys2path_page_contents) ? result.sys2path_page_contents : [];
  } catch (error) {
    console.error('[BACKGROUND] Failed to get page contents:', error);
    return [];
  }
}

/**
 * Get all data (conversations + page contents)
 */
async function handleGetAllData(): Promise<{ conversations: any[], pageContents: any[] }> {
  try {
    const [conversations, pageContents] = await Promise.all([
      handleGetConversations(),
      handleGetPageContents()
    ]);
    return { conversations, pageContents };
  } catch (error) {
    console.error('[BACKGROUND] Failed to get all data:', error);
    return { conversations: [], pageContents: [] };
  }
}

