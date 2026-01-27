/**
 * Export Service
 * Core logic for batch export functionality
 */

import type { ChatLLMPlatform } from '../../types/capture';
import type { ExportStatus, ExportProgress, ExportOptions, ExportResult, ProgressCallback, StatusCallback, ConversationItem, ProjectGroup } from './types';
import { exportAll as exportChatGPT, getAllConversations as getAllChatGPTConversationsExporter, setChatGPTWorkspace } from './chatgpt-exporter';
import { exportAll as exportClaude, getAllConversations as getAllClaudeConversationsExporter } from './claude-exporter';

export class ExportService {
  private status: ExportStatus = 'idle';
  private progress: ExportProgress = {
    current: 0,
    total: 0,
    exported: 0,
    startTime: 0,
    lastUpdateTime: 0,
    averageTimePerItem: 0
  };
  private statusCallback?: StatusCallback;
  private progressCallback?: ProgressCallback;
  private platform: ChatLLMPlatform | null = null;
  private cancelled = false;
  private cachedConversations: ConversationItem[] | null = null;
  private cachedPlatform: ChatLLMPlatform | null = null;

  /**
   * Set status callback
   */
  setStatusCallback(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Set platform
   */
  setPlatform(platform: ChatLLMPlatform): void {
    // Clear cache if platform changes
    if (this.platform !== platform) {
      this.clearCache();
    }
    this.platform = platform;
  }

  /**
   * Clear cached conversations
   */
  clearCache(): void {
    this.cachedConversations = null;
    this.cachedPlatform = null;
  }

  /**
   * Get project groups from conversations
   */
  getProjectGroups(conversations: ConversationItem[]): ProjectGroup[] {
    if (!this.platform) {
      return [];
    }

    const groups: Record<string, ProjectGroup> = {};
    const noProjectConvs: ConversationItem[] = [];

    for (const conv of conversations) {
      let projectId: string | undefined;
      let projectName: string | undefined;

      if (this.platform === 'chatgpt') {
        projectId = conv.gizmoId;
        projectName = conv.gizmoName;
      } else if (this.platform === 'claude') {
        projectId = conv.projectUuid || conv.project_uuid;
        projectName = conv.projectName || conv.project?.name || conv.project?.title;
      }

      if (projectId) {
        if (!groups[projectId]) {
          groups[projectId] = {
            id: projectId,
            name: projectName || 'Unknown',
            count: 0,
            conversations: []
          };
        }
        groups[projectId].conversations.push(conv);
        groups[projectId].count++;
      } else {
        noProjectConvs.push(conv);
      }
    }

    const result: ProjectGroup[] = Object.values(groups);

    // Add "no project" group if there are conversations without projects
    if (noProjectConvs.length > 0) {
      result.push({
        id: 'no-project',
        name: '无项目',
        count: noProjectConvs.length,
        conversations: noProjectConvs
      });
    }

    // Sort by name (no-project at the end)
    result.sort((a, b) => {
      if (a.id === 'no-project') return 1;
      if (b.id === 'no-project') return -1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }

  /**
   * Set ChatGPT workspace configuration
   */
  setChatGPTWorkspaceConfig(workspaceId: string | null, workspaceType: 'user' | 'team'): void {
    setChatGPTWorkspace(workspaceId, workspaceType);
  }

  /**
   * Get current status
   */
  getStatus(): ExportStatus {
    return this.status;
  }

  /**
   * Get current progress
   */
  getProgress(): ExportProgress {
    return { ...this.progress };
  }

  /**
   * Get cached conversations
   */
  getCachedConversations(): ConversationItem[] | null {
    return this.cachedConversations && this.cachedPlatform === this.platform
      ? this.cachedConversations
      : null;
  }

  /**
   * Cancel export
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Check if cancelled
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Update status
   */
  private updateStatus(status: ExportStatus, message?: string): void {
    this.status = status;
    if (this.statusCallback) {
      this.statusCallback(status, message);
    }
  }

  /**
   * Update progress
   */
  private updateProgress(progress: Partial<ExportProgress>): void {
    this.progress = { ...this.progress, ...progress };
    if (this.progressCallback) {
      this.progressCallback(this.progress);
    }
  }

  /**
   * Detect total conversation count
   */
  async detectConversationCount(): Promise<number> {
    if (!this.platform) {
      throw new Error('Platform not set');
    }

    this.updateStatus('detecting');
    this.updateProgress({
      current: 0,
      total: 0,
      exported: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      averageTimePerItem: 0
    });

    try {
      let count = 0;
      
      // Create progress callback for detection phase
      const detectionProgressCallback = (current: number, total: number | null) => {
        this.updateProgress({
          current,
          total: total || 0,
          exported: 0,
          startTime: this.progress.startTime,
          lastUpdateTime: Date.now(),
          averageTimePerItem: 0
        });
      };
      
      let convs: ConversationItem[];
      
      if (this.platform === 'chatgpt') {
        convs = await getAllChatGPTConversationsExporter(detectionProgressCallback);
        count = convs.length;
      } else if (this.platform === 'claude') {
        convs = await getAllClaudeConversationsExporter(detectionProgressCallback);
        count = convs.length;
      } else {
        throw new Error(`Export not supported for platform: ${this.platform}`);
      }

      // Cache the conversations for later use in exportAll()
      this.cachedConversations = convs;
      this.cachedPlatform = this.platform;

      // Final progress update
      this.updateProgress({
        current: count,
        total: count,
        exported: 0,
        startTime: this.progress.startTime,
        lastUpdateTime: Date.now(),
        averageTimePerItem: 0
      });

      this.updateStatus('idle');
      return count;
    } catch (error) {
      // Clear cache on error
      this.clearCache();
      this.updateStatus('error', error instanceof Error ? error.message : 'Failed to detect conversations');
      throw error;
    }
  }

  /**
   * Export all conversations
   */
  async exportAll(options: ExportOptions = {}): Promise<ExportResult> {
    if (!this.platform) {
      return {
        success: false,
        exported: 0,
        failed: 0,
        total: 0,
        error: 'Platform not set'
      };
    }

    if (this.status === 'exporting' || this.status === 'compressing') {
      return {
        success: false,
        exported: 0,
        failed: 0,
        total: 0,
        error: 'Export already in progress'
      };
    }

    this.cancelled = false;
    this.updateStatus('exporting');
    this.updateProgress({
      current: 0,
      total: 0,
      exported: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      averageTimePerItem: 0
    });

    try {
      // Create progress wrapper
      const progressWrapper: ProgressCallback = (progress) => {
        if (this.cancelled) {
          return;
        }
        this.updateProgress(progress);
      };

      let result: ExportResult;

      // Default groupByProject to true for Claude and ChatGPT (with gizmo support)
      const exportOptions: ExportOptions = {
        ...options,
        groupByProject: options.groupByProject !== undefined ? options.groupByProject : true
      };

      // Use cached conversations if available and platform matches
      const preloadedConversations = 
        this.cachedConversations && 
        this.cachedPlatform === this.platform 
          ? this.cachedConversations 
          : undefined;

      if (this.platform === 'chatgpt') {
        result = await exportChatGPT(exportOptions, progressWrapper, preloadedConversations);
      } else if (this.platform === 'claude') {
        result = await exportClaude(exportOptions, progressWrapper, preloadedConversations);
      } else {
        throw new Error(`Export not supported for platform: ${this.platform}`);
      }

      // Clear cache after export completes (success or failure)
      this.clearCache();

      if (this.cancelled) {
        this.updateStatus('idle');
        return {
          success: false,
          exported: result.exported,
          failed: result.failed,
          total: result.total,
          error: 'Export cancelled by user'
        };
      }

      this.updateStatus('completed');
      
      // Reset after a delay
      setTimeout(() => {
        if (this.status === 'completed') {
          this.updateStatus('idle');
        }
      }, 2000);

      return result;
    } catch (error) {
      // Clear cache on error
      this.clearCache();
      
      this.updateStatus('error', error instanceof Error ? error.message : 'Export failed');
      
      // Reset after a delay
      setTimeout(() => {
        if (this.status === 'error') {
          this.updateStatus('idle');
        }
      }, 3000);

      return {
        success: false,
        exported: 0,
        failed: 0,
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Singleton instance
export const exportService = new ExportService();

/**
 * Format time for display
 */
export function formatTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}分${secs}秒`;
}

/**
 * Estimate remaining time
 */
export function estimateRemainingTime(progress: ExportProgress): number {
  if (progress.current === 0 || progress.total === 0) {
    return 0;
  }
  
  const elapsed = Date.now() - progress.startTime;
  const avgTime = progress.current > 0 ? elapsed / progress.current : 0;
  const remaining = (progress.total - progress.current) * avgTime;
  
  return Math.max(0, remaining);
}
