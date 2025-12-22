import type { ChatLLMConversation, GeneralPageContent } from '../types/capture';

const STORAGE_KEYS = {
  CONVERSATIONS: 'sys2path_conversations',
  PAGE_CONTENTS: 'sys2path_page_contents',
} as const;

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
   * Creates a new version each time, using timestamp-based ID
   */
  static async saveConversation(conversation: ChatLLMConversation): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.CONVERSATIONS);
      const conversations: ChatLLMConversation[] = Array.isArray(result[STORAGE_KEYS.CONVERSATIONS]) 
        ? (result[STORAGE_KEYS.CONVERSATIONS] as ChatLLMConversation[])
        : [];
      
      // Generate a unique ID for this capture using timestamp
      // Format: {baseId}-{timestamp}
      // This allows multiple versions of the same conversation to coexist
      const baseId = conversation.id.split('-').slice(0, -1).join('-') || conversation.id;
      const timestamp = conversation.capturedAt;
      const versionedId = `${baseId}-${timestamp}`;
      
      // Create a new conversation entry with versioned ID
      const versionedConversation: ChatLLMConversation = {
        ...conversation,
        id: versionedId
      };
      
      // Always add as new entry (version control)
      conversations.push(versionedConversation);
      
      await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: conversations });
      console.log('[STORAGE] Saved conversation version:', versionedId);
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
   * Creates a new version each time, using timestamp-based ID
   */
  static async savePageContent(content: GeneralPageContent): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.PAGE_CONTENTS);
      const contents: GeneralPageContent[] = Array.isArray(result[STORAGE_KEYS.PAGE_CONTENTS]) 
        ? (result[STORAGE_KEYS.PAGE_CONTENTS] as GeneralPageContent[])
        : [];
      
      // Generate a unique ID for this capture using timestamp
      // Format: {baseId}-{timestamp}
      // This allows multiple versions of the same page to coexist
      const baseId = content.id.split('-').slice(0, -1).join('-') || content.id;
      const timestamp = content.capturedAt;
      const versionedId = `${baseId}-${timestamp}`;
      
      // Create a new content entry with versioned ID
      const versionedContent: GeneralPageContent = {
        ...content,
        id: versionedId
      };
      
      // Always add as new entry (version control)
      contents.push(versionedContent);
      
      await chrome.storage.local.set({ [STORAGE_KEYS.PAGE_CONTENTS]: contents });
      console.log('[STORAGE] Saved page content version:', versionedId);
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
   * Update conversation version tag
   */
  static async updateConversationVersionTag(versionId: string, tag: string): Promise<void> {
    try {
      const conversations = await this.getAllConversations();
      const conversation = conversations.find(c => c.id === versionId);
      if (!conversation) {
        throw new Error(`Conversation version not found: ${versionId}`);
      }
      
      // Store tag in conversation metadata (we'll need to extend the type or use a separate storage)
      // For now, we'll store it in a separate metadata object
      // Note: This is a simplified approach. In production, you might want to store tags separately
      const result = await chrome.storage.local.get('sys2path_version_tags');
      const tags: Record<string, string> = (result.sys2path_version_tags as Record<string, string>) || {};
      if (tag.trim()) {
        tags[versionId] = tag.trim();
      } else {
        delete tags[versionId];
      }
      await chrome.storage.local.set({ sys2path_version_tags: tags });
      console.log('[STORAGE] Updated conversation version tag:', versionId, tag);
    } catch (error) {
      console.error('[STORAGE] Failed to update conversation version tag:', error);
      throw error;
    }
  }

  /**
   * Update page content version tag
   */
  static async updatePageContentVersionTag(versionId: string, tag: string): Promise<void> {
    try {
      const contents = await this.getAllPageContents();
      const content = contents.find(c => c.id === versionId);
      if (!content) {
        throw new Error(`Page content version not found: ${versionId}`);
      }
      
      // Store tag in a separate metadata object
      const result = await chrome.storage.local.get('sys2path_version_tags');
      const tags: Record<string, string> = (result.sys2path_version_tags as Record<string, string>) || {};
      if (tag.trim()) {
        tags[versionId] = tag.trim();
      } else {
        delete tags[versionId];
      }
      await chrome.storage.local.set({ sys2path_version_tags: tags });
      console.log('[STORAGE] Updated page content version tag:', versionId, tag);
    } catch (error) {
      console.error('[STORAGE] Failed to update page content version tag:', error);
      throw error;
    }
  }

  /**
   * Update version tag (generic method that tries both conversation and page content)
   */
  static async updateVersionTag(versionId: string, tag: string): Promise<void> {
    try {
      // Try conversation first
      await this.updateConversationVersionTag(versionId, tag);
    } catch (error) {
      // If conversation fails, try page content
      try {
        await this.updatePageContentVersionTag(versionId, tag);
      } catch (err) {
        console.error('[STORAGE] Failed to update version tag:', err);
        throw err;
      }
    }
  }

  /**
   * Get version tag
   */
  static async getVersionTag(versionId: string): Promise<string | undefined> {
    try {
      const result = await chrome.storage.local.get('sys2path_version_tags');
      const tags: Record<string, string> = (result.sys2path_version_tags as Record<string, string>) || {};
      return tags[versionId];
    } catch (error) {
      console.error('[STORAGE] Failed to get version tag:', error);
      return undefined;
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
        'sys2path_version_tags'
      ]);
      console.log('[STORAGE] Cleared all data');
    } catch (error) {
      console.error('[STORAGE] Failed to clear data:', error);
      throw error;
    }
  }
}

