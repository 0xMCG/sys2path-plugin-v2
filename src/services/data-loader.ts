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
function conversationToVersion(
  conversation: ChatLLMConversation, 
  versionStatuses?: Record<string, 'local' | 'generated' | 'none' | 'uploaded'>,
  isOutdated?: boolean
): SourceVersion {
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
    status: versionStatuses?.[conversation.id] || (conversation.isUploaded ? 'uploaded' : 'local'),
    isOutdated: isOutdated || false
  };
}

/**
 * Convert a single page content to a version entry
 */
function pageContentToVersion(
  content: GeneralPageContent, 
  versionStatuses?: Record<string, 'local' | 'generated' | 'none' | 'uploaded'>,
  isOutdated?: boolean
): SourceVersion {
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
    status: versionStatuses?.[content.id] || (content.isUploaded ? 'uploaded' : 'local'),
    isOutdated: isOutdated || false
  };
}

/**
 * Convert multiple conversations with same URL to a single DataSource with versions
 * Limits to maximum 2 versions: newest uploaded (if exists) + newest local
 */
export function convertConversationsToDataSource(
  conversations: ChatLLMConversation[], 
  versionStatuses?: Record<string, 'local' | 'generated' | 'none' | 'uploaded'>,
  serverUpdateTime?: string
): DataSource | null {
  if (conversations.length === 0) return null;

  // Sort by capturedAt (newest first)
  const sorted = [...conversations].sort((a, b) => b.capturedAt - a.capturedAt);
  const latest = sorted[0];

  // Get base ID from the first conversation
  const baseId = getBaseId(latest.id);

  // Separate uploaded and local versions
  const uploadedVersions = sorted.filter(c => c.isUploaded === true);
  const localVersions = sorted.filter(c => !c.isUploaded);
  
  // Get newest uploaded version (if exists)
  const newestUploaded = uploadedVersions.length > 0
    ? uploadedVersions.reduce((newest, current) => 
        current.capturedAt > newest.capturedAt ? current : newest
      )
    : null;
  
  // Get newest local version
  const newestLocal = localVersions.length > 0
    ? localVersions.reduce((newest, current) => 
        current.capturedAt > newest.capturedAt ? current : newest
      )
    : null;
  
  // Build versions array: max 2 versions (uploaded first, then local)
  const versions: SourceVersion[] = [];
  
  if (newestUploaded) {
    versions.push(conversationToVersion(newestUploaded, versionStatuses, false));
  }
  
  if (newestLocal) {
    // Mark local version as pending sync if there's an uploaded version
    const isOutdated = newestUploaded !== null && newestLocal.id !== newestUploaded.id;
    versions.push(conversationToVersion(newestLocal, versionStatuses, isOutdated));
  }

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
    isUploaded: newestUploaded !== null,
    lastSaved,
    versions,
    currentVersionId: versions[0]?.id || latest.id, // Latest version
    ckgStatus: 'none',
    relevanceScore: undefined,
    serverUpdateTime: serverUpdateTime // Include serverUpdateTime if provided
  };
}

/**
 * Convert multiple page contents with same URL to a single DataSource with versions
 * Limits to maximum 2 versions: newest uploaded (if exists) + newest local
 */
export function convertPageContentsToDataSource(
  contents: GeneralPageContent[], 
  versionStatuses?: Record<string, 'local' | 'generated' | 'none' | 'uploaded'>,
  serverUpdateTime?: string
): DataSource | null {
  if (contents.length === 0) return null;

  // Sort by capturedAt (newest first)
  const sorted = [...contents].sort((a, b) => b.capturedAt - a.capturedAt);
  const latest = sorted[0];

  // Get base ID from the first content
  const baseId = getBaseId(latest.id);

  // Separate uploaded and local versions
  const uploadedVersions = sorted.filter(c => c.isUploaded === true);
  const localVersions = sorted.filter(c => !c.isUploaded);
  
  // Get newest uploaded version (if exists)
  const newestUploaded = uploadedVersions.length > 0
    ? uploadedVersions.reduce((newest, current) => 
        current.capturedAt > newest.capturedAt ? current : newest
      )
    : null;
  
  // Get newest local version
  const newestLocal = localVersions.length > 0
    ? localVersions.reduce((newest, current) => 
        current.capturedAt > newest.capturedAt ? current : newest
      )
    : null;
  
  // Build versions array: max 2 versions (uploaded first, then local)
  const versions: SourceVersion[] = [];
  
  if (newestUploaded) {
    versions.push(pageContentToVersion(newestUploaded, versionStatuses, false));
  }
  
  if (newestLocal) {
    // Mark local version as pending sync if there's an uploaded version
    const isOutdated = newestUploaded !== null && newestLocal.id !== newestUploaded.id;
    versions.push(pageContentToVersion(newestLocal, versionStatuses, isOutdated));
  }

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
    isUploaded: newestUploaded !== null,
    lastSaved,
    versions,
    currentVersionId: versions[0]?.id || latest.id, // Latest version
    ckgStatus: 'none',
    relevanceScore: undefined,
    serverUpdateTime: serverUpdateTime // Include serverUpdateTime if provided
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
    
    // Get current user ID for storage key isolation
    const userInfoResult = await chrome.storage.local.get('sys2path_user_info');
    const userInfo = userInfoResult.sys2path_user_info;
    const userId = (userInfo && typeof userInfo === 'object' && 'id' in userInfo && userInfo.id) ? userInfo.id as number : null;
    
    // Load version statuses with user isolation
    const versionStatusKey = userId !== null ? `sys2path_version_status_user_${userId}` : 'sys2path_version_status';
    const statusResult = await chrome.storage.local.get(versionStatusKey);
    const versionStatuses: Record<string, 'local' | 'generated' | 'none' | 'uploaded'> = 
      (statusResult[versionStatusKey] as Record<string, 'local' | 'generated' | 'none' | 'uploaded'>) || {};
    
    // Load server update times with user isolation
    const serverUpdateTimesKey = userId !== null ? `sys2path_server_update_times_user_${userId}` : 'sys2path_server_update_times';
    const timesResult = await chrome.storage.local.get(serverUpdateTimesKey);
    const serverUpdateTimes: Record<string, string> = 
      (timesResult[serverUpdateTimesKey] as Record<string, string>) || {};
    
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
          // Get baseId to look up serverUpdateTime
          const baseId = getBaseId(convs[0]?.id || '');
          const serverUpdateTime = serverUpdateTimes[baseId];
          const dataSource = convertConversationsToDataSource(convs, versionStatuses, serverUpdateTime);
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
          // Get baseId to look up serverUpdateTime
          const baseId = getBaseId(contents[0]?.id || '');
          const serverUpdateTime = serverUpdateTimes[baseId];
          const dataSource = convertPageContentsToDataSource(contents, versionStatuses, serverUpdateTime);
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

