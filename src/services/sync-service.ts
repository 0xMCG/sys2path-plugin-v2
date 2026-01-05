// 同步服务 - 同步服务器 sessions 与本地 data sources
import { apiService } from './api';
import { loadDataSources } from './data-loader';
import type { DataSource } from '../types';
import type { Session } from '../types/api';

/**
 * Sync server sessions with local data sources
 * - Fetches all sessions from server
 * - Compares with local data sources
 * - Creates "Only In Server" DataSource for server-only sessions
 * - Updates serverUpdateTime for synced data sources
 */
export async function syncServerSessions(): Promise<DataSource[]> {
  try {
    console.log('[SYNC] Starting server sessions sync...');
    
    // Get all local data sources
    const localDataSources = await loadDataSources();
    console.log('[SYNC] Local data sources:', localDataSources.length);
    
    // Fetch all sessions from server (paginated)
    const allServerSessions: Session[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;
    
    while (hasMore) {
      try {
        const response = await apiService.getSessions({
          page,
          page_size: pageSize
        });
        
        if (!response.success) {
          throw new Error('Failed to get sessions from server');
        }
        
        allServerSessions.push(...response.sessions);
        console.log(`[SYNC] Fetched page ${page}: ${response.sessions.length} sessions`);
        
        // Check if there are more pages
        hasMore = (page * pageSize) < response.total;
        page++;
      } catch (error) {
        console.error(`[SYNC] Failed to fetch page ${page}:`, error);
        // If it's the first page and fails, throw the error
        if (page === 1) {
          throw error;
        }
        // Otherwise, break and use what we have
        break;
      }
    }
    
    console.log('[SYNC] Total server sessions:', allServerSessions.length);
    
    // Create a map of local data sources by baseId
    const localMap = new Map<string, DataSource>();
    localDataSources.forEach(ds => {
      localMap.set(ds.id, ds);
    });
    
    // Create a map of server sessions by session_id
    const serverMap = new Map<string, Session>();
    allServerSessions.forEach(session => {
      serverMap.set(session.session_id, session);
    });
    
    // Process each server session
    const syncedDataSources: DataSource[] = [];
    const processedLocalIds = new Set<string>();
    
    // First, process server sessions
    for (const serverSession of allServerSessions) {
      const sessionId = serverSession.session_id;
      const localDataSource = localMap.get(sessionId);
      
      if (localDataSource) {
        // Local exists and server exists - update with server info
        processedLocalIds.add(sessionId);
        // Convert UTC time to local time
        const serverTime = new Date(serverSession.update_time);
        const localTimeString = serverTime.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
          // No timeZone specified - uses browser's local timezone
        });
        
        syncedDataSources.push({
          ...localDataSource,
          isUploaded: true,
          serverUpdateTime: localTimeString,
          isServerOnly: false
        });
      } else {
        // Server exists but local doesn't - create "Only In Server" DataSource
        // Convert UTC time to local time
        const serverTime = new Date(serverSession.update_time);
        const localTimeString = serverTime.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
          // No timeZone specified - uses browser's local timezone
        });
        
        const serverOnlyDataSource: DataSource = {
          id: sessionId,
          title: serverSession.title || 'Untitled Session',
          url: serverSession.url || '',
          type: 'web',
          platform: serverSession.platform as any,
          isUploaded: true,
          lastSaved: localTimeString,
          versions: [{
            id: `${sessionId}-${serverTime.getTime()}`,
            timestamp: localTimeString,
            changeSummary: 'Server-only session',
            status: 'uploaded',
            isOutdated: false
          }],
          currentVersionId: `${sessionId}-${serverTime.getTime()}`,
          ckgStatus: 'none',
          isServerOnly: true,
          serverUpdateTime: localTimeString
        };
        syncedDataSources.push(serverOnlyDataSource);
      }
    }
    
    // Add local-only data sources (not on server)
    for (const localDataSource of localDataSources) {
      if (!processedLocalIds.has(localDataSource.id)) {
        syncedDataSources.push({
          ...localDataSource,
          isServerOnly: false
        });
      }
    }
    
    console.log('[SYNC] Sync completed. Total data sources:', syncedDataSources.length);
    return syncedDataSources;
  } catch (error) {
    console.error('[SYNC] Failed to sync server sessions:', error);
    // Return local data sources on error
    return await loadDataSources();
  }
}

