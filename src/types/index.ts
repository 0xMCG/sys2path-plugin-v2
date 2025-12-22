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

export interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
  entities?: string[]; // IDs of entities mentioned
}

export interface GraphNode extends SimulationNodeDatum {
  id: string;
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
  status?: 'local' | 'generated' | 'none'; // Version-level status
}

import type { ChatLLMPlatform } from './capture';

export interface DataSource {
  id: string;
  title: string;
  url: string;
  type: 'web' | 'upload';
  platform?: ChatLLMPlatform | 'general' | 'demo'; // Platform identifier (ChatLLM platform, 'general' for non-ChatLLM pages, or 'demo' for mock data)
  isUploaded: boolean; // Server sync status
  lastSaved: string;
  versions: SourceVersion[];
  currentVersionId: string;
  ckgStatus: 'generated' | 'pending' | 'none';
  relevanceScore?: number; // For Smart Data ranking
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

