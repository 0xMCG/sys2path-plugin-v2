export type ChatLLMPlatform = 'chatgpt' | 'claude' | 'gemini' | 'notebooklm' | 'aistudio' | 'grok';

export interface ChatLLMMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatLLMConversation {
  id: string;
  platform: ChatLLMPlatform;
  title: string;
  messages: ChatLLMMessage[];
  capturedAt: number;
  url: string;
}

export interface GeneralPageContent {
  id: string;
  url: string;
  title: string;
  content: string; // Plain text with HTML stripped
  capturedAt: number;
}

