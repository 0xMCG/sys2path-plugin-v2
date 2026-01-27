/**
 * Claude Exporter
 * Handles batch export of Claude conversations
 * Reference: examples/lyra_exporter_fetch.js ClaudeHandler
 */

import { getAllClaudeConversations, getClaudeConversationWithTree, getClaudeUserId } from '../capture/api-helpers';
import type { ConversationItem, ExportOptions, ExportResult, ProgressCallback } from './types';
import { zipSync, strToU8 } from 'fflate';

/**
 * Get base URL for Claude API
 */
function getBaseUrl(): string {
  if (window.location.hostname.includes('claude.ai')) {
    return 'https://claude.ai';
  } else if (window.location.hostname.includes('easychat.top')) {
    return `https://${window.location.hostname}`;
  }
  return window.location.origin;
}

/**
 * Convert blob to base64
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get all Claude conversations
 */
export async function getAllConversations(
  onProgress?: (current: number, total: number | null) => void
): Promise<ConversationItem[]> {
  const convs = await getAllClaudeConversations(onProgress);
  // Ensure all items have 'id' field and extract project information
  return convs.map(conv => ({
    ...conv,
    id: conv.uuid || conv.id || '',
    projectUuid: conv.project_uuid,
    projectName: conv.project?.name || conv.project?.title || undefined,
    project: conv.project
  }));
}

/**
 * Get single conversation with optional image processing and tree mode
 */
export async function getConversation(
  uuid: string,
  includeImages: boolean = false,
  treeMode: boolean = false
): Promise<any> {
  const userId = await getClaudeUserId();
  if (!userId) {
    throw new Error('Claude user ID not found');
  }

  const data = await getClaudeConversationWithTree(uuid, treeMode);

  // Process images if requested
  if (includeImages && data.chat_messages) {
    const baseUrl = getBaseUrl();
    
    for (const msg of data.chat_messages) {
      const fileArrays = ['files', 'files_v2', 'attachments'];
      
      for (const key of fileArrays) {
        if (Array.isArray(msg[key])) {
          for (const file of msg[key]) {
            const isImage = file.file_kind === 'image' || file.file_type?.startsWith('image/');
            const imageUrl = file.preview_url || file.thumbnail_url || file.file_url;
            
            if (isImage && imageUrl && !file.embedded_image) {
              try {
                const fullUrl = imageUrl.startsWith('http') ? imageUrl : baseUrl + imageUrl;
                const imgResp = await fetch(fullUrl);
                
                if (imgResp.ok) {
                  const blob = await imgResp.blob();
                  const base64 = await blobToBase64(blob);
                  file.embedded_image = {
                    type: 'image',
                    format: blob.type,
                    size: blob.size,
                    data: base64,
                    original_url: imageUrl
                  };
                }
              } catch (err) {
                console.error('[Claude] Process image error:', err);
              }
            }
          }
        }
      }
    }
  }

  return data;
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
  const { includeImages = false, treeMode = false, maxCount = 0, groupByProject = true, selectedProjectIds } = options;

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
        const projectUuid = conv.projectUuid || conv.project_uuid;
        if (projectUuid) {
          // Conversation belongs to a project
          return selectedIdsSet.has(projectUuid);
        } else {
          // Conversation has no project
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

    // Group conversations by project if groupByProject is enabled
    const groupedConvs: Record<string, ConversationItem[]> = {};
    const noProjectConvs: ConversationItem[] = [];

    if (groupByProject) {
      for (const conv of convsToExport) {
        const projectUuid = conv.projectUuid || conv.project_uuid;
        if (projectUuid) {
          const key = `project-${projectUuid}`;
          if (!groupedConvs[key]) {
            groupedConvs[key] = [];
          }
          groupedConvs[key].push(conv);
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
      for (const [projectKey, convs] of Object.entries(groupedConvs)) {
        const projectName = convs[0].projectName || convs[0].project?.name || 'Unknown';
        const sanitizedProjectName = sanitizeFilename(projectName);
        const folderName = `projects/${projectKey}-${sanitizedProjectName}`;

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
            const data = await getConversation(conv.uuid || conv.id, includeImages, treeMode);
            
            if (data) {
              const title = sanitizeFilename(data.name || conv.uuid || conv.id);
              const uuid = conv.uuid || conv.id;
              const filename = `${folderName}/claude_${uuid.substring(0, 8)}_${title}.json`;
              zipEntries[filename] = strToU8(JSON.stringify(data, null, 2));
              exported++;
            }
          } catch (error) {
            console.error(`[Claude] Failed to process ${conv.uuid || conv.id}:`, error);
            failedItems.push({
              id: conv.uuid || conv.id,
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
          const data = await getConversation(conv.uuid || conv.id, includeImages, treeMode);
          
          if (data) {
            const title = sanitizeFilename(data.name || conv.uuid || conv.id);
            const uuid = conv.uuid || conv.id;
            const folderPrefix = groupByProject ? 'no-project/' : '';
            const filename = `${folderPrefix}claude_${uuid.substring(0, 8)}_${title}.json`;
            zipEntries[filename] = strToU8(JSON.stringify(data, null, 2));
            exported++;
          }
        } catch (error) {
          console.error(`[Claude] Failed to process ${conv.uuid || conv.id}:`, error);
          failedItems.push({
            id: conv.uuid || conv.id,
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
          const data = await getConversation(conv.uuid || conv.id, includeImages, treeMode);
          
          if (data) {
            const title = sanitizeFilename(data.name || conv.uuid || conv.id);
            const uuid = conv.uuid || conv.id;
            const filename = `claude_${uuid.substring(0, 8)}_${title}.json`;
            zipEntries[filename] = strToU8(JSON.stringify(data, null, 2));
            exported++;
          }
        } catch (error) {
          console.error(`[Claude] Failed to process ${conv.uuid || conv.id}:`, error);
          failedItems.push({
            id: conv.uuid || conv.id,
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
    const filename = `claude_export_${exportCount === totalCount ? 'all' : 'recent_' + exportCount}_${dateStr}.zip`;

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
