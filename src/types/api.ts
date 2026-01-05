// API类型定义，与后端api.py中的模型对应

export type OAuthProvider = 'google' | 'github' | 'twitter';

export interface Message {
  MessageId: string;
  Content: string;
}

export interface AddSessionsRequest {
  platform: string;
  title: string;
  session_id: string;
  url?: string;
  messages: Message[];
}

export interface AddSessionResponse {
  success: boolean;
  message: string;
  last_message_id: Record<string, string>;
  processing_time_seconds: number;
}

export interface VisualizeMVGRequest {
  prompt?: string;
  rank_threshold?: number;
  expansion_depth?: number;
  max_entities?: number;
  include_structured_output?: boolean;
  include_chunks?: boolean;
  include_session_relevance?: boolean;
  session_relevance_method?: string;
}

export interface RelevantSessionsResponse {
  platform: string;
  url?: string;
  session_id: string;
  rank: number;
  title: string;
  update_time: string;
  last_message_id: string;
}

export interface NodeResponse {
  id: string;
  label: string;
  value: number;
}

export interface EdgeResponse {
  from_node: string;
  to_node: string;
  chunks: string[];
}

export interface MVGResponse {
  nodes: NodeResponse[];
  edges: EdgeResponse[];
}

export interface VisualizeMVGResponse {
  success: boolean;
  message: string;
  prompt_response?: string;
  mvg?: MVGResponse;
  relevant_sessions?: RelevantSessionsResponse[];
  structured_output?: string;
  processing_time_seconds: number;
}

export interface GetSessionsRequest {
  page: number;
  page_size: number;
  platform?: string;
}

export interface Session {
  session_id: string;
  platform: string;
  title: string;
  user_id: number;
  status: string;
  version: number;
  new_message_id: string;
  url?: string;
  update_time: string;
  create_time: string;
}

export interface GetSessionsResponse {
  success: boolean;
  total: number;
  page: number;
  page_size: number;
  sessions: Session[];
}

export interface OAuthCallbackResponse {
  message: string;
  is_new_user: boolean;
  access_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
    provider: string;
    is_verified: boolean;
    created_at?: string;
  };
}

export interface ApiError {
  detail: string;
  status_code?: number;
}

