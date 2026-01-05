import type { ChatLLMConversation, GeneralPageContent } from '../types/capture';

const STORAGE_KEYS = {
  CONVERSATIONS: 'sys2path_conversations',
  PAGE_CONTENTS: 'sys2path_page_contents',
  SERVER_UPDATE_TIMES: 'sys2path_server_update_times',
} as const;

/**
 * Result of save operation
 */
export interface SaveResult {
  saved: boolean;
  message?: string; // Message to show to user (e.g., "最新内容已保存、无需更新")
}

/**
 * Extract base ID from versioned ID (removes timestamp suffix)
 * Format: {baseId}-{timestamp}
 */
function getBaseId(versionedId: string): string {
  const parts = versionedId.split('-');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    // Check if last part is a timestamp (all digits and long enough to be a timestamp)
    if (/^\d+$/.test(lastPart) && lastPart.length >= 10) {
      return parts.slice(0, -1).join('-');
    }
  }
  return versionedId;
}

export class StorageService {
  /**
   * Save a ChatLLM conversation
   * Implements version management:
   * - If not uploaded: keep only the latest version (delete old versions)
   * - If uploaded: keep uploaded versions and add new version
   * Also checks for duplicate content by comparing message IDs
   */
  static async saveConversation(conversation: ChatLLMConversation): Promise<SaveResult> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.CONVERSATIONS);
      const conversations: ChatLLMConversation[] = Array.isArray(result[STORAGE_KEYS.CONVERSATIONS]) 
        ? (result[STORAGE_KEYS.CONVERSATIONS] as ChatLLMConversation[])
        : [];
      
      // Generate a unique ID for this capture using timestamp
      // Format: {baseId}-{timestamp}
      const baseId = conversation.id.split('-').slice(0, -1).join('-') || conversation.id;
      const timestamp = conversation.capturedAt;
      const versionedId = `${baseId}-${timestamp}`;
      
      // Get all versions with the same baseId
      const existingVersions = conversations.filter(c => {
        const cBaseId = c.id.split('-').slice(0, -1).join('-') || c.id;
        return cBaseId === baseId;
      });
      
      // Check if there are any uploaded versions
      const hasUploadedVersions = existingVersions.some(v => v.isUploaded === true);
      
      // Get the latest version (by capturedAt)
      const latestVersion = existingVersions.length > 0
        ? existingVersions.reduce((latest, current) => 
            current.capturedAt > latest.capturedAt ? current : latest
          )
        : null;
      
      // Check for duplicate: compare message IDs
      if (latestVersion && latestVersion.messages.length === conversation.messages.length) {
        const newMessageIds = conversation.messages.map(m => m.messageId || '').filter(id => id);
        const latestMessageIds = latestVersion.messages.map(m => m.messageId || '').filter(id => id);
        
        if (newMessageIds.length > 0 && latestMessageIds.length > 0 &&
            newMessageIds.length === latestMessageIds.length &&
            newMessageIds.every((id, idx) => id === latestMessageIds[idx])) {
          // All message IDs match - content is the same
          return {
            saved: false,
            message: '最新内容已保存、无需更新'
          };
        }
      }
      
      // Create a new conversation entry with versioned ID
      const versionedConversation: ChatLLMConversation = {
        ...conversation,
        id: versionedId
      };
      
      if (!hasUploadedVersions) {
        // No uploaded versions: delete all old versions, keep only the new one
        const otherConversations = conversations.filter(c => {
          const cBaseId = c.id.split('-').slice(0, -1).join('-') || c.id;
          return cBaseId !== baseId;
        });
        otherConversations.push(versionedConversation);
        await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: otherConversations });
        console.log('[STORAGE] Saved conversation version (replaced old versions):', versionedId);
      } else {
        // Has uploaded versions: keep only the newest uploaded version and the new local version
        // Find the newest uploaded version
        const uploadedVersions = existingVersions.filter(v => v.isUploaded === true);
        const newestUploaded = uploadedVersions.length > 0
          ? uploadedVersions.reduce((newest, current) => 
              current.capturedAt > newest.capturedAt ? current : newest
            )
          : null;
        
        // Keep only: newest uploaded version + new local version
        const otherConversations = conversations.filter(c => {
          const cBaseId = c.id.split('-').slice(0, -1).join('-') || c.id;
          if (cBaseId !== baseId) return true; // Keep conversations with different baseId
          // For same baseId, keep only newest uploaded version
          if (newestUploaded && c.id === newestUploaded.id) return true;
          return false; // Remove all other old versions
        });
        
        otherConversations.push(versionedConversation);
        await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: otherConversations });
        console.log('[STORAGE] Saved conversation version (kept newest uploaded + new local):', versionedId);
      }
      
      return { saved: true };
    } catch (error) {
      console.error('[STORAGE] Failed to save conversation:', error);
      throw error;
    }
  }

  /**
   * Get all conversations
   */
  static async getAllConversations(): Promise<ChatLLMConversation[]> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.CONVERSATIONS);
      return Array.isArray(result[STORAGE_KEYS.CONVERSATIONS]) 
        ? (result[STORAGE_KEYS.CONVERSATIONS] as ChatLLMConversation[])
        : [];
    } catch (error) {
      console.error('[STORAGE] Failed to get conversations:', error);
      return [];
    }
  }

  /**
   * Get conversation by ID
   */
  static async getConversation(id: string): Promise<ChatLLMConversation | null> {
    try {
      const conversations = await this.getAllConversations();
      return conversations.find(c => c.id === id) || null;
    } catch (error) {
      console.error('[STORAGE] Failed to get conversation:', error);
      return null;
    }
  }

  /**
   * Delete a conversation
   */
  static async deleteConversation(id: string): Promise<void> {
    try {
      const conversations = await this.getAllConversations();
      const filtered = conversations.filter(c => c.id !== id);
      await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: filtered });
      console.log('[STORAGE] Deleted conversation:', id);
    } catch (error) {
      console.error('[STORAGE] Failed to delete conversation:', error);
      throw error;
    }
  }

  /**
   * Delete a conversation version by version ID
   */
  static async deleteConversationVersion(versionId: string): Promise<void> {
    try {
      const conversations = await this.getAllConversations();
      const filtered = conversations.filter(c => c.id !== versionId);
      await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: filtered });
      console.log('[STORAGE] Deleted conversation version:', versionId);
    } catch (error) {
      console.error('[STORAGE] Failed to delete conversation version:', error);
      throw error;
    }
  }

  /**
   * Save general page content
   * Implements version management:
   * - If not uploaded: keep only the latest version (delete old versions)
   * - If uploaded: keep uploaded versions and add new version
   * Also checks for duplicate content by comparing message ID
   */
  static async savePageContent(content: GeneralPageContent): Promise<SaveResult> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.PAGE_CONTENTS);
      const contents: GeneralPageContent[] = Array.isArray(result[STORAGE_KEYS.PAGE_CONTENTS]) 
        ? (result[STORAGE_KEYS.PAGE_CONTENTS] as GeneralPageContent[])
        : [];
      
      // Generate a unique ID for this capture using timestamp
      // Format: {baseId}-{timestamp}
      const baseId = content.id.split('-').slice(0, -1).join('-') || content.id;
      const timestamp = content.capturedAt;
      const versionedId = `${baseId}-${timestamp}`;
      
      // Get all versions with the same baseId
      const existingVersions = contents.filter(c => {
        const cBaseId = c.id.split('-').slice(0, -1).join('-') || c.id;
        return cBaseId === baseId;
      });
      
      // Check if there are any uploaded versions
      const hasUploadedVersions = existingVersions.some(v => v.isUploaded === true);
      
      // Get the latest version (by capturedAt)
      const latestVersion = existingVersions.length > 0
        ? existingVersions.reduce((latest, current) => 
            current.capturedAt > latest.capturedAt ? current : latest
          )
        : null;
      
      // Check for duplicate: compare message ID
      if (latestVersion && latestVersion.messageId && content.messageId) {
        if (latestVersion.messageId === content.messageId) {
          // Message IDs match - content is the same
          return {
            saved: false,
            message: '最新内容已保存、无需更新'
          };
        }
      }
      
      // Create a new content entry with versioned ID
      const versionedContent: GeneralPageContent = {
        ...content,
        id: versionedId
      };
      
      if (!hasUploadedVersions) {
        // No uploaded versions: delete all old versions, keep only the new one
        const otherContents = contents.filter(c => {
          const cBaseId = c.id.split('-').slice(0, -1).join('-') || c.id;
          return cBaseId !== baseId;
        });
        otherContents.push(versionedContent);
        await chrome.storage.local.set({ [STORAGE_KEYS.PAGE_CONTENTS]: otherContents });
        console.log('[STORAGE] Saved page content version (replaced old versions):', versionedId);
      } else {
        // Has uploaded versions: keep only the newest uploaded version and the new local version
        // Find the newest uploaded version
        const uploadedVersions = existingVersions.filter(v => v.isUploaded === true);
        const newestUploaded = uploadedVersions.length > 0
          ? uploadedVersions.reduce((newest, current) => 
              current.capturedAt > newest.capturedAt ? current : newest
            )
          : null;
        
        // Keep only: newest uploaded version + new local version
        const otherContents = contents.filter(c => {
          const cBaseId = c.id.split('-').slice(0, -1).join('-') || c.id;
          if (cBaseId !== baseId) return true; // Keep contents with different baseId
          // For same baseId, keep only newest uploaded version
          if (newestUploaded && c.id === newestUploaded.id) return true;
          return false; // Remove all other old versions
        });
        
        otherContents.push(versionedContent);
        await chrome.storage.local.set({ [STORAGE_KEYS.PAGE_CONTENTS]: otherContents });
        console.log('[STORAGE] Saved page content version (kept newest uploaded + new local):', versionedId);
      }
      
      return { saved: true };
    } catch (error) {
      console.error('[STORAGE] Failed to save page content:', error);
      throw error;
    }
  }

  /**
   * Get all page contents
   */
  static async getAllPageContents(): Promise<GeneralPageContent[]> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.PAGE_CONTENTS);
      return Array.isArray(result[STORAGE_KEYS.PAGE_CONTENTS]) 
        ? (result[STORAGE_KEYS.PAGE_CONTENTS] as GeneralPageContent[])
        : [];
    } catch (error) {
      console.error('[STORAGE] Failed to get page contents:', error);
      return [];
    }
  }

  /**
   * Get page content by ID
   */
  static async getPageContent(id: string): Promise<GeneralPageContent | null> {
    try {
      const contents = await this.getAllPageContents();
      return contents.find(c => c.id === id) || null;
    } catch (error) {
      console.error('[STORAGE] Failed to get page content:', error);
      return null;
    }
  }

  /**
   * Delete page content
   */
  static async deletePageContent(id: string): Promise<void> {
    try {
      const contents = await this.getAllPageContents();
      const filtered = contents.filter(c => c.id !== id);
      await chrome.storage.local.set({ [STORAGE_KEYS.PAGE_CONTENTS]: filtered });
      console.log('[STORAGE] Deleted page content:', id);
    } catch (error) {
      console.error('[STORAGE] Failed to delete page content:', error);
      throw error;
    }
  }

  /**
   * Delete a page content version by version ID
   */
  static async deletePageContentVersion(versionId: string): Promise<void> {
    try {
      const contents = await this.getAllPageContents();
      const filtered = contents.filter(c => c.id !== versionId);
      await chrome.storage.local.set({ [STORAGE_KEYS.PAGE_CONTENTS]: filtered });
      console.log('[STORAGE] Deleted page content version:', versionId);
    } catch (error) {
      console.error('[STORAGE] Failed to delete page content version:', error);
      throw error;
    }
  }

  /**
   * Delete conversations by base ID (deletes all versions)
   */
  static async deleteConversationsByBaseId(baseId: string): Promise<void> {
    try {
      const conversations = await this.getAllConversations();
      const filtered = conversations.filter(c => {
        const convBaseId = getBaseId(c.id);
        return convBaseId !== baseId;
      });
      await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: filtered });
      console.log('[STORAGE] Deleted conversations with base ID:', baseId);
    } catch (error) {
      console.error('[STORAGE] Failed to delete conversations by base ID:', error);
      throw error;
    }
  }

  /**
   * Delete page contents by base ID (deletes all versions)
   */
  static async deletePageContentsByBaseId(baseId: string): Promise<void> {
    try {
      const contents = await this.getAllPageContents();
      const filtered = contents.filter(c => {
        const contentBaseId = getBaseId(c.id);
        return contentBaseId !== baseId;
      });
      await chrome.storage.local.set({ [STORAGE_KEYS.PAGE_CONTENTS]: filtered });
      console.log('[STORAGE] Deleted page contents with base ID:', baseId);
    } catch (error) {
      console.error('[STORAGE] Failed to delete page contents by base ID:', error);
      throw error;
    }
  }

  /**
   * Delete multiple data sources by base IDs (deletes all versions of each)
   */
  static async deleteDataSources(baseIds: string[]): Promise<void> {
    try {
      // Delete conversations and page contents in parallel
      await Promise.all([
        ...baseIds.map(id => this.deleteConversationsByBaseId(id)),
        ...baseIds.map(id => this.deletePageContentsByBaseId(id))
      ]);
      console.log('[STORAGE] Deleted data sources:', baseIds);
    } catch (error) {
      console.error('[STORAGE] Failed to delete data sources:', error);
      throw error;
    }
  }


  /**
   * Clear all data
   */
  static async clearAll(): Promise<void> {
    try {
      await chrome.storage.local.remove([
        STORAGE_KEYS.CONVERSATIONS,
        STORAGE_KEYS.PAGE_CONTENTS,
        STORAGE_KEYS.SERVER_UPDATE_TIMES,
        'sys2path_version_tags'
      ]);
      console.log('[STORAGE] Cleared all data');
    } catch (error) {
      console.error('[STORAGE] Failed to clear data:', error);
      throw error;
    }
  }

  /**
   * Mark conversation as uploaded (updates all versions with same base ID)
   * Also updates version status to 'uploaded' via version tags metadata
   * After marking as uploaded, if there are two versions (uploaded + local), and local is now uploaded,
   * delete the old uploaded version, keeping only the newest one
   * @param baseId - Base ID of the conversation
   * @param serverUpdateTime - Server update time in local timezone (optional)
   */
  static async markConversationAsUploaded(baseId: string, serverUpdateTime?: string): Promise<void> {
    try {
      const conversations = await this.getAllConversations();
      const versionsForBaseId = conversations.filter(c => {
        const convBaseId = getBaseId(c.id);
        return convBaseId === baseId;
      });
      
      // Mark all versions as uploaded
      const updated = conversations.map(c => {
        const convBaseId = getBaseId(c.id);
        if (convBaseId === baseId) {
          return { ...c, isUploaded: true };
        }
        return c;
      });
      
      // After marking as uploaded, check if we need to clean up old versions
      // If there are multiple uploaded versions, keep only the newest one
      const uploadedVersions = versionsForBaseId.map(c => ({ ...c, isUploaded: true }));
      if (uploadedVersions.length > 1) {
        // Find the newest uploaded version
        const newestUploaded = uploadedVersions.reduce((newest, current) => 
          current.capturedAt > newest.capturedAt ? current : newest
        );
        
        // Remove all old uploaded versions, keep only the newest
        const cleaned = updated.filter(c => {
          const convBaseId = getBaseId(c.id);
          if (convBaseId !== baseId) return true; // Keep conversations with different baseId
          // For same baseId, keep only the newest uploaded version
          return c.id === newestUploaded.id;
        });
        
        await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: cleaned });
        console.log('[STORAGE] Marked conversation as uploaded and cleaned up old versions:', baseId);
      } else {
        await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: updated });
        console.log('[STORAGE] Marked conversation as uploaded:', baseId);
      }
      
      // Update version status to 'uploaded' via version status metadata
      const result = await chrome.storage.local.get('sys2path_version_status');
      const statuses: Record<string, 'local' | 'generated' | 'none' | 'uploaded'> = 
        (result.sys2path_version_status as Record<string, 'local' | 'generated' | 'none' | 'uploaded'>) || {};
      
      const finalConversations = await this.getAllConversations();
      finalConversations.forEach(c => {
        const convBaseId = getBaseId(c.id);
        if (convBaseId === baseId && c.isUploaded) {
          statuses[c.id] = 'uploaded';
        }
      });
      
      await chrome.storage.local.set({ sys2path_version_status: statuses });
      
      // Store serverUpdateTime if provided
      if (serverUpdateTime) {
        const timesResult = await chrome.storage.local.get(STORAGE_KEYS.SERVER_UPDATE_TIMES);
        const serverUpdateTimes: Record<string, string> = 
          (timesResult[STORAGE_KEYS.SERVER_UPDATE_TIMES] as Record<string, string>) || {};
        serverUpdateTimes[baseId] = serverUpdateTime;
        await chrome.storage.local.set({ [STORAGE_KEYS.SERVER_UPDATE_TIMES]: serverUpdateTimes });
        console.log('[STORAGE] Stored serverUpdateTime for conversation:', baseId, serverUpdateTime);
      }
    } catch (error) {
      console.error('[STORAGE] Failed to mark conversation as uploaded:', error);
      throw error;
    }
  }

  /**
   * Mark page content as uploaded (updates all versions with same base ID)
   * Also updates version status to 'uploaded' via version tags metadata
   * After marking as uploaded, if there are two versions (uploaded + local), and local is now uploaded,
   * delete the old uploaded version, keeping only the newest one
   * @param baseId - Base ID of the page content
   * @param serverUpdateTime - Server update time in local timezone (optional)
   */
  static async markPageContentAsUploaded(baseId: string, serverUpdateTime?: string): Promise<void> {
    try {
      const contents = await this.getAllPageContents();
      const versionsForBaseId = contents.filter(c => {
        const contentBaseId = getBaseId(c.id);
        return contentBaseId === baseId;
      });
      
      // Mark all versions as uploaded
      const updated = contents.map(c => {
        const contentBaseId = getBaseId(c.id);
        if (contentBaseId === baseId) {
          return { ...c, isUploaded: true };
        }
        return c;
      });
      
      // After marking as uploaded, check if we need to clean up old versions
      // If there are multiple uploaded versions, keep only the newest one
      const uploadedVersions = versionsForBaseId.map(c => ({ ...c, isUploaded: true }));
      if (uploadedVersions.length > 1) {
        // Find the newest uploaded version
        const newestUploaded = uploadedVersions.reduce((newest, current) => 
          current.capturedAt > newest.capturedAt ? current : newest
        );
        
        // Remove all old uploaded versions, keep only the newest
        const cleaned = updated.filter(c => {
          const contentBaseId = getBaseId(c.id);
          if (contentBaseId !== baseId) return true; // Keep contents with different baseId
          // For same baseId, keep only the newest uploaded version
          return c.id === newestUploaded.id;
        });
        
        await chrome.storage.local.set({ [STORAGE_KEYS.PAGE_CONTENTS]: cleaned });
        console.log('[STORAGE] Marked page content as uploaded and cleaned up old versions:', baseId);
      } else {
        await chrome.storage.local.set({ [STORAGE_KEYS.PAGE_CONTENTS]: updated });
        console.log('[STORAGE] Marked page content as uploaded:', baseId);
      }
      
      // Update version status to 'uploaded' via version status metadata
      const result = await chrome.storage.local.get('sys2path_version_status');
      const statuses: Record<string, 'local' | 'generated' | 'none' | 'uploaded'> = 
        (result.sys2path_version_status as Record<string, 'local' | 'generated' | 'none' | 'uploaded'>) || {};
      
      const finalContents = await this.getAllPageContents();
      finalContents.forEach(c => {
        const contentBaseId = getBaseId(c.id);
        if (contentBaseId === baseId && c.isUploaded) {
          statuses[c.id] = 'uploaded';
        }
      });
      
      await chrome.storage.local.set({ sys2path_version_status: statuses });
      
      // Store serverUpdateTime if provided
      if (serverUpdateTime) {
        const timesResult = await chrome.storage.local.get(STORAGE_KEYS.SERVER_UPDATE_TIMES);
        const serverUpdateTimes: Record<string, string> = 
          (timesResult[STORAGE_KEYS.SERVER_UPDATE_TIMES] as Record<string, string>) || {};
        serverUpdateTimes[baseId] = serverUpdateTime;
        await chrome.storage.local.set({ [STORAGE_KEYS.SERVER_UPDATE_TIMES]: serverUpdateTimes });
        console.log('[STORAGE] Stored serverUpdateTime for page content:', baseId, serverUpdateTime);
      }
    } catch (error) {
      console.error('[STORAGE] Failed to mark page content as uploaded:', error);
      throw error;
    }
  }

  /**
   * Mark data source as uploaded (tries both conversation and page content)
   * @param baseId - Base ID of the data source
   * @param serverUpdateTime - Server update time in local timezone (optional)
   */
  static async markDataSourceAsUploaded(baseId: string, serverUpdateTime?: string): Promise<void> {
    try {
      // Try conversation first
      const conversations = await this.getAllConversations();
      const hasConversation = conversations.some(c => {
        const convBaseId = getBaseId(c.id);
        return convBaseId === baseId;
      });
      
      if (hasConversation) {
        await this.markConversationAsUploaded(baseId, serverUpdateTime);
        return;
      }
      
      // Try page content
      const contents = await this.getAllPageContents();
      const hasContent = contents.some(c => {
        const contentBaseId = getBaseId(c.id);
        return contentBaseId === baseId;
      });
      
      if (hasContent) {
        await this.markPageContentAsUploaded(baseId, serverUpdateTime);
        return;
      }
      
      console.warn('[STORAGE] Data source not found for base ID:', baseId);
    } catch (error) {
      console.error('[STORAGE] Failed to mark data source as uploaded:', error);
      throw error;
    }
  }
}

