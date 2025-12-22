import type { ChatLLMConversation, GeneralPageContent } from '../types/capture';
import type { DataSource, SourceVersion } from '../types';

/**
 * Extract base ID from versioned ID (removes timestamp suffix)
 */
function getBaseId(versionedId: string): string {
  // Format: {baseId}-{timestamp}
  // Try to split by last dash and check if last part is a timestamp (numeric)
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

/**
 * Convert a single conversation to a version entry
 */
function conversationToVersion(conversation: ChatLLMConversation, versionTags?: Record<string, string>): SourceVersion {
  const capturedDate = new Date(conversation.capturedAt);
  const timestamp = capturedDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    id: conversation.id,
    timestamp,
    changeSummary: `Captured ${conversation.messages.length} messages`,
    status: 'local', // Default status for new versions
    tag: versionTags?.[conversation.id] // Load tag from storage
  };
}

/**
 * Convert a single page content to a version entry
 */
function pageContentToVersion(content: GeneralPageContent, versionTags?: Record<string, string>): SourceVersion {
  const capturedDate = new Date(content.capturedAt);
  const timestamp = capturedDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    id: content.id,
    timestamp,
    changeSummary: `Captured ${content.content.length} characters`,
    status: 'local', // Default status for new versions
    tag: versionTags?.[content.id] // Load tag from storage
  };
}

/**
 * Convert multiple conversations with same URL to a single DataSource with versions
 */
export function convertConversationsToDataSource(conversations: ChatLLMConversation[], versionTags?: Record<string, string>): DataSource | null {
  if (conversations.length === 0) return null;

  // Sort by capturedAt (newest first)
  const sorted = [...conversations].sort((a, b) => b.capturedAt - a.capturedAt);
  const latest = sorted[0];

  // Get base ID from the first conversation
  const baseId = getBaseId(latest.id);

  // Create versions from all conversations
  const versions: SourceVersion[] = sorted.map(conv => conversationToVersion(conv, versionTags));

  const latestDate = new Date(latest.capturedAt);
  const lastSaved = latestDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    id: baseId,
    title: latest.title || 'Untitled Conversation',
    url: latest.url,
    type: 'web',
    platform: latest.platform, // Set platform from conversation
    isUploaded: false,
    lastSaved,
    versions,
    currentVersionId: versions[0].id, // Latest version
    ckgStatus: 'none',
    relevanceScore: undefined
  };
}

/**
 * Convert multiple page contents with same URL to a single DataSource with versions
 */
export function convertPageContentsToDataSource(contents: GeneralPageContent[], versionTags?: Record<string, string>): DataSource | null {
  if (contents.length === 0) return null;

  // Sort by capturedAt (newest first)
  const sorted = [...contents].sort((a, b) => b.capturedAt - a.capturedAt);
  const latest = sorted[0];

  // Get base ID from the first content
  const baseId = getBaseId(latest.id);

  // Create versions from all contents
  const versions: SourceVersion[] = sorted.map(content => pageContentToVersion(content, versionTags));

  const latestDate = new Date(latest.capturedAt);
  const lastSaved = latestDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    id: baseId,
    title: latest.title || 'Untitled Page',
    url: latest.url,
    type: 'web',
    platform: 'general', // General page content (not ChatLLM)
    isUploaded: false,
    lastSaved,
    versions,
    currentVersionId: versions[0].id, // Latest version
    ckgStatus: 'none',
    relevanceScore: undefined
  };
}

/**
 * Convert a single conversation to DataSource (for backward compatibility)
 * @deprecated Use convertConversationsToDataSource instead
 */
export function convertConversationToDataSource(conversation: ChatLLMConversation): DataSource {
  return convertConversationsToDataSource([conversation])!;
}

/**
 * Convert a single page content to DataSource (for backward compatibility)
 * @deprecated Use convertPageContentsToDataSource instead
 */
export function convertPageContentToDataSource(content: GeneralPageContent): DataSource {
  return convertPageContentsToDataSource([content])!;
}

/**
 * Load all data sources from storage
 * Groups conversations and page contents by URL to create versioned DataSources
 */
export async function loadDataSources(): Promise<DataSource[]> {
  try {
    console.log('[DATA_LOADER] Requesting data from background...');
    // Get conversations and page contents from background
    const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_DATA' });
    
    if (!response) {
      console.warn('[DATA_LOADER] No response from background');
      return [];
    }
    
    if (!response.success) {
      console.error('[DATA_LOADER] Background returned error:', response.error);
      return [];
    }
    
    console.log('[DATA_LOADER] Received response:', {
      conversationsCount: response.conversations?.length || 0,
      pageContentsCount: response.pageContents?.length || 0
    });
    
    // Load version tags
    const tagsResult = await chrome.storage.local.get('sys2path_version_tags');
    const versionTags: Record<string, string> = (tagsResult.sys2path_version_tags as Record<string, string>) || {};
    
    const dataSources: DataSource[] = [];
    
    // Group conversations by URL (same URL = same conversation, different versions)
    if (response.conversations && Array.isArray(response.conversations)) {
      console.log('[DATA_LOADER] Processing conversations:', response.conversations.length);
      const conversationsByUrl = new Map<string, ChatLLMConversation[]>();
      
      for (const conv of response.conversations) {
        if (!conv || typeof conv !== 'object') {
          console.warn('[DATA_LOADER] Invalid conversation entry:', conv);
          continue;
        }
        
        const url = conv.url || '';
        if (!conversationsByUrl.has(url)) {
          conversationsByUrl.set(url, []);
        }
        conversationsByUrl.get(url)!.push(conv);
      }
      
      // Convert each group to a DataSource with versions
      for (const [_url, convs] of conversationsByUrl.entries()) {
        try {
          const dataSource = convertConversationsToDataSource(convs, versionTags);
          if (dataSource) {
            dataSources.push(dataSource);
          }
        } catch (error) {
          console.error('[DATA_LOADER] Failed to convert conversation group:', error, convs);
        }
      }
      console.log('[DATA_LOADER] Converted conversations to data sources:', conversationsByUrl.size);
    } else {
      console.log('[DATA_LOADER] No conversations found or invalid format');
    }
    
    // Group page contents by URL (same URL = same page, different versions)
    if (response.pageContents && Array.isArray(response.pageContents)) {
      console.log('[DATA_LOADER] Processing page contents:', response.pageContents.length);
      const contentsByUrl = new Map<string, GeneralPageContent[]>();
      
      for (const content of response.pageContents) {
        if (!content || typeof content !== 'object') {
          console.warn('[DATA_LOADER] Invalid page content entry:', content);
          continue;
        }
        
        const url = content.url || '';
        if (!contentsByUrl.has(url)) {
          contentsByUrl.set(url, []);
        }
        contentsByUrl.get(url)!.push(content);
      }
      
      // Convert each group to a DataSource with versions
      for (const [_url, contents] of contentsByUrl.entries()) {
        try {
          const dataSource = convertPageContentsToDataSource(contents, versionTags);
          if (dataSource) {
            dataSources.push(dataSource);
          }
        } catch (error) {
          console.error('[DATA_LOADER] Failed to convert page content group:', error, contents);
        }
      }
      console.log('[DATA_LOADER] Converted page contents to data sources:', contentsByUrl.size);
    } else {
      console.log('[DATA_LOADER] No page contents found or invalid format');
    }
    
    // Sort by lastSaved (newest first)
    dataSources.sort((a, b) => {
      try {
        const aTime = new Date(a.lastSaved).getTime();
        const bTime = new Date(b.lastSaved).getTime();
        return bTime - aTime;
      } catch (error) {
        console.warn('[DATA_LOADER] Failed to sort data sources:', error);
        return 0;
      }
    });
    
    console.log('[DATA_LOADER] Total data sources loaded:', dataSources.length);
    return dataSources;
  } catch (error) {
    console.error('[DATA_LOADER] Failed to load data sources:', error);
    // Return empty array instead of throwing to allow fallback to mock data
    return [];
  }
}

