import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export type ViewMode = 'overlay' | 'sidebar' | 'dashboard';

export type PageStatus = 'unsaved' | 'saved' | 'modified';

export interface UserProfile {
  name: string;
  email: string;
  plan: 'Free' | 'Pro';
  tokensUsed: number;
  tokenLimit: number;
  nodeCount: number;
}

export interface Motivation {
  id: string;
  icon: string;
  label: string;
  prompt: string;
  description: string;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  rank: number; // PageRank score 0-1
  summary: string;
  relatedChunks: string[];
}

export interface PromptResponse {
  expanded_query: string;
  right_questions: string[];
  action_items: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
  entities?: string[]; // IDs of entities mentioned
  promptResponse?: PromptResponse; // Parsed prompt_response from visualize-mvg API
}

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  label?: string;
  group: number;
  rank: number;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
  summary?: string; // Description of the relationship
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface SourceVersion {
  id: string;
  timestamp: string;
  changeSummary: string;
  tag?: string; // User defined tag
  status?: 'local' | 'generated' | 'none' | 'uploaded'; // Version-level status
  isOutdated?: boolean; // Whether this version is outdated (has newer local version)
}

import type { ChatLLMPlatform } from './capture';

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'failed';

export interface DataSource {
  id: string;
  title: string;
  url: string;
  type: 'web' | 'upload';
  platform?: ChatLLMPlatform | 'general' | 'demo'; // Platform identifier (ChatLLM platform, 'general' for non-ChatLLM pages, or 'demo' for mock data)
  isUploaded: boolean; // Server sync status (persistent)
  uploadStatus?: UploadStatus; // Current upload status (temporary)
  uploadProgress?: number; // 0-100
  uploadError?: string; // Error message if failed
  lastSaved: string;
  versions: SourceVersion[];
  currentVersionId: string;
  ckgStatus: 'generated' | 'pending' | 'none';
  relevanceScore?: number; // For Smart Data ranking
  isServerOnly?: boolean; // Mark as only existing on server (local record deleted)
  serverUpdateTime?: string; // Server update time (if synced with server)
}

export interface HistoryItem {
  id: string;
  summary: string;
  timestamp: string;
  messageCount: number;
  preview: string;
}

export interface Project {
  id: string;
  name: string;
  sourceCount: number;
  lastActive: string;
}

