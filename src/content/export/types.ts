/**
 * Export Types
 * Type definitions for export functionality
 */

export interface ConversationItem {
  id: string;
  title?: string;
  uuid?: string;
  updated?: string;
  gizmoId?: string;        // ChatGPT gizmo ID
  gizmoName?: string;      // ChatGPT gizmo name
  projectUuid?: string;   // Claude project UUID
  projectName?: string;   // Claude project name
  project?: any;           // Full project object (Claude)
  [key: string]: any;
}

export interface ProjectGroup {
  id: string;              // gizmoId (ChatGPT) 或 projectUuid (Claude)，"no-project" 表示无项目
  name: string;           // gizmoName (ChatGPT) 或 projectName (Claude)
  count: number;          // 该项目的对话数量
  conversations: ConversationItem[];
}

export interface ExportOptions {
  includeImages?: boolean;
  treeMode?: boolean;      // For Claude branch mode
  maxCount?: number;       // Maximum number of conversations to export (0 = all)
  groupByProject?: boolean; // Whether to group conversations by project in ZIP structure
  selectedProjectIds?: string[];  // 选中的项目 ID 列表，undefined 表示全部
}

export interface ExportResult {
  success: boolean;
  exported: number;
  failed: number;
  total: number;
  error?: string;
  filename?: string;
  failedItems?: Array<{ id: string; error: string }>;
}

export interface ExportProgress {
  current: number;
  total: number;
  exported: number;
  startTime: number;
  lastUpdateTime: number;
  averageTimePerItem: number;
}

export type ExportStatus = 'idle' | 'detecting' | 'exporting' | 'compressing' | 'completed' | 'error';

export type ProgressCallback = (progress: ExportProgress) => void;
export type StatusCallback = (status: ExportStatus, message?: string) => void;
