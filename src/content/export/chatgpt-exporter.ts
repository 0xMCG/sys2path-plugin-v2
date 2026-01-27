/**
 * ChatGPT Exporter
 * Handles batch export of ChatGPT conversations with gizmo (project) support
 * Reference: examples/lyra_exporter_fetch.js ChatGPTHandler
 */

import { 
  getAllChatGPTConversations, 
  getAllChatGPTConversationsWithGizmos,
  getChatGPTConversation
} from '../capture/api-helpers';
import type { ConversationItem, ExportOptions, ExportResult, ProgressCallback } from './types';
import { zipSync, strToU8 } from 'fflate';

let workspaceId: string | null = null;
let workspaceType: 'user' | 'team' = 'user';

/**
 * Set ChatGPT workspace configuration
 */
export function setChatGPTWorkspace(id: string | null, type: 'user' | 'team'): void {
  workspaceId = id;
  workspaceType = type;
}

/**
 * Get all ChatGPT conversations
 */
export async function getAllConversations(
  onProgress?: (current: number, total: number | null) => void
): Promise<ConversationItem[]> {
  try {
    // getAllChatGPTConversationsWithGizmos already returns all conversations with gizmo info
    // It fetches all conversations and matches them with gizmo names
    const conversationsWithGizmos = await getAllChatGPTConversationsWithGizmos(onProgress);
    
    // Return directly as it already contains all conversations with proper gizmo info
    return conversationsWithGizmos.map(conv => ({
      ...conv,
      id: conv.id || '',
      gizmoId: conv.gizmoId,
      gizmoName: conv.gizmoName
    }));
  } catch (error) {
    console.warn('[ChatGPT] Failed to get conversations with gizmos, falling back to regular API:', error);
    // Fallback to regular API
    const convs = await getAllChatGPTConversations(
      workspaceId || undefined,
      workspaceType,
      onProgress
    );
    return convs.map(conv => {
      // Try to extract gizmo_id from raw data
      const rawGizmoId = (conv as any).gizmo_id || (conv as any).conversation_template_id;
      return {
        ...conv,
        id: conv.id || '',
        gizmoId: rawGizmoId || undefined,
        gizmoName: undefined // Name not available in fallback mode
      };
    });
  }
}

/**
 * Sanitize filename
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').substring(0, 100);
}

/**
 * Export all conversations
 */
export async function exportAll(
  options: ExportOptions = {},
  onProgress?: ProgressCallback,
  preloadedConversations?: ConversationItem[]
): Promise<ExportResult> {
  const { maxCount = 0, groupByProject = false, selectedProjectIds } = options;

  try {
    // Get all conversations
    if (onProgress) {
      onProgress({
        current: 0,
        total: 0,
        exported: 0,
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        averageTimePerItem: 0
      });
    }

    // Use preloaded conversations if provided, otherwise fetch them
    let allConvs = preloadedConversations || await getAllConversations();
    
    // Filter by selected projects if specified
    if (selectedProjectIds && selectedProjectIds.length > 0) {
      const selectedIdsSet = new Set(selectedProjectIds);
      allConvs = allConvs.filter(conv => {
        if (conv.gizmoId) {
          // Conversation belongs to a gizmo
          return selectedIdsSet.has(conv.gizmoId);
        } else {
          // Conversation has no gizmo
          return selectedIdsSet.has('no-project');
        }
      });
    }
    
    const totalCount = allConvs.length;

    if (totalCount === 0) {
      return {
        success: false,
        exported: 0,
        failed: 0,
        total: 0,
        error: 'No conversations found'
      };
    }

    // Determine how many to export
    const exportCount = maxCount > 0 ? Math.min(maxCount, totalCount) : totalCount;
    const convsToExport = allConvs.slice(0, exportCount);

    const zipEntries: Record<string, Uint8Array> = {};
    let exported = 0;
    const failedItems: Array<{ id: string; error: string }> = [];
    const startTime = Date.now();

    // Group conversations by gizmo if groupByProject is enabled
    const groupedConvs: Record<string, ConversationItem[]> = {};
    const noProjectConvs: ConversationItem[] = [];

    if (groupByProject) {
      for (const conv of convsToExport) {
        const gizmoId = conv.gizmoId;
        if (gizmoId) {
          if (!groupedConvs[gizmoId]) {
            groupedConvs[gizmoId] = [];
          }
          groupedConvs[gizmoId].push(conv);
        } else {
          noProjectConvs.push(conv);
        }
      }
    } else {
      // If not grouping, treat all as no-project
      noProjectConvs.push(...convsToExport);
    }

    // Export each conversation
    let processedCount = 0;
    const totalToProcess = convsToExport.length;

    // Process grouped conversations
    if (groupByProject) {
      for (const [gizmoId, convs] of Object.entries(groupedConvs)) {
        const gizmoName = convs[0].gizmoName || 'Unknown';
        const sanitizedGizmoName = sanitizeFilename(gizmoName);
        const folderName = `projects/gizmo-${gizmoId}-${sanitizedGizmoName}`;

        for (const conv of convs) {
          processedCount++;
          
          // Update progress
          if (onProgress) {
            const elapsed = Date.now() - startTime;
            const avgTime = processedCount > 1 ? elapsed / (processedCount - 1) : 0;
            onProgress({
              current: processedCount,
              total: totalToProcess,
              exported,
              startTime,
              lastUpdateTime: Date.now(),
              averageTimePerItem: avgTime
            });
          }

          // Rate limiting: pause every 5 conversations
          if (processedCount > 1) {
            if (processedCount % 5 === 0) {
              await new Promise(resolve => setTimeout(resolve, 100)); // Yield to browser
            } else {
              await new Promise(resolve => setTimeout(resolve, 300)); // Small delay
            }
          }

          try {
            const data = await getChatGPTConversation(conv.id);
            
            if (data) {
              const title = sanitizeFilename(data.title || conv.title || conv.id);
              const filename = `${folderName}/chatgpt_${conv.id.substring(0, 8)}_${title}.json`;
              zipEntries[filename] = strToU8(JSON.stringify(data, null, 2));
              exported++;
            }
          } catch (error) {
            console.error(`[ChatGPT] Failed to process ${conv.id}:`, error);
            failedItems.push({
              id: conv.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      // Process no-project conversations
      for (const conv of noProjectConvs) {
        processedCount++;
        
        // Update progress
        if (onProgress) {
          const elapsed = Date.now() - startTime;
          const avgTime = processedCount > 1 ? elapsed / (processedCount - 1) : 0;
          onProgress({
            current: processedCount,
            total: totalToProcess,
            exported,
            startTime,
            lastUpdateTime: Date.now(),
            averageTimePerItem: avgTime
          });
        }

        // Rate limiting: pause every 5 conversations
        if (processedCount > 1) {
          if (processedCount % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Yield to browser
          } else {
            await new Promise(resolve => setTimeout(resolve, 300)); // Small delay
          }
        }

        try {
          const data = await getChatGPTConversation(conv.id);
          
          if (data) {
            const title = sanitizeFilename(data.title || conv.title || conv.id);
            const folderPrefix = groupByProject ? 'no-project/' : '';
            const filename = `${folderPrefix}chatgpt_${conv.id.substring(0, 8)}_${title}.json`;
            zipEntries[filename] = strToU8(JSON.stringify(data, null, 2));
            exported++;
          }
        } catch (error) {
          console.error(`[ChatGPT] Failed to process ${conv.id}:`, error);
          failedItems.push({
            id: conv.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } else {
      // Original flat structure (no grouping)
      for (let i = 0; i < convsToExport.length; i++) {
        const conv = convsToExport[i];
        
        // Update progress
        if (onProgress) {
          const elapsed = Date.now() - startTime;
          const avgTime = i > 0 ? elapsed / i : 0;
          onProgress({
            current: i + 1,
            total: convsToExport.length,
            exported,
            startTime,
            lastUpdateTime: Date.now(),
            averageTimePerItem: avgTime
          });
        }

        // Rate limiting: pause every 5 conversations
        if (i > 0) {
          if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Yield to browser
          } else {
            await new Promise(resolve => setTimeout(resolve, 300)); // Small delay
          }
        }

        try {
          const data = await getChatGPTConversation(conv.id);
          
          if (data) {
            const title = sanitizeFilename(data.title || conv.title || conv.id);
            const filename = `chatgpt_${conv.id.substring(0, 8)}_${title}.json`;
            zipEntries[filename] = strToU8(JSON.stringify(data, null, 2));
            exported++;
          }
        } catch (error) {
          console.error(`[ChatGPT] Failed to process ${conv.id}:`, error);
          failedItems.push({
            id: conv.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    // Compress to ZIP
    if (onProgress) {
      onProgress({
        current: totalToProcess,
        total: totalToProcess,
        exported,
        startTime,
        lastUpdateTime: Date.now(),
        averageTimePerItem: (Date.now() - startTime) / totalToProcess
      });
    }

    const zipUint8 = zipSync(zipEntries, { level: 1 });
    const zipBlob = new Blob([zipUint8 as any], { type: 'application/zip' });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `chatgpt_export_${exportCount === totalCount ? 'all' : 'recent_' + exportCount}_${dateStr}.zip`;

    // Download file
    downloadZip(zipBlob, filename);

    return {
      success: true,
      exported,
      failed: failedItems.length,
      total: convsToExport.length,
      filename,
      failedItems: failedItems.length > 0 ? failedItems : undefined
    };
  } catch (error) {
    return {
      success: false,
      exported: 0,
      failed: 0,
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Download ZIP file
 */
function downloadZip(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
