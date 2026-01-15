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
    // Storage keys are now user-specific, so we don't need to initialize here
    // They will be created automatically when first used
    console.log('[BACKGROUND] Extension installed - storage will be initialized per user');
  }
});

// Note: Extension icon click now opens popup (configured in manifest.json)
// No need to handle chrome.action.onClicked when popup is set

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
    // Use StorageService to ensure user isolation
    await StorageService.saveConversation(data);
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
    // Use StorageService to ensure user isolation
    await StorageService.savePageContent(data);
    console.log('[BACKGROUND] Saved page content:', data.id);
  } catch (error) {
    console.error('[BACKGROUND] Failed to save page content:', error);
    throw error;
  }
}

/**
 * Get storage key with user ID suffix for data isolation
 */
async function getStorageKey(baseKey: string): Promise<string> {
  try {
    const result = await chrome.storage.local.get('sys2path_user_info');
    const userInfo = result.sys2path_user_info;
    if (userInfo && typeof userInfo === 'object' && 'id' in userInfo && userInfo.id) {
      return `${baseKey}_user_${userInfo.id}`;
    }
    return baseKey; // Fallback to original key if no user ID
  } catch (error) {
    console.warn('[BACKGROUND] Failed to get user ID, using base key:', error);
    return baseKey;
  }
}

/**
 * Get all conversations
 */
async function handleGetConversations(): Promise<any[]> {
  try {
    const storageKey = await getStorageKey('sys2path_conversations');
    const result = await chrome.storage.local.get(storageKey);
    return Array.isArray(result[storageKey]) ? result[storageKey] : [];
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
    const storageKey = await getStorageKey('sys2path_page_contents');
    const result = await chrome.storage.local.get(storageKey);
    return Array.isArray(result[storageKey]) ? result[storageKey] : [];
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

