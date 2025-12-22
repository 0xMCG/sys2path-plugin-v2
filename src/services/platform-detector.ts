import type { ChatLLMPlatform } from '../types/capture';

export class PlatformDetector {
  /**
   * Detect platform from hostname
   */
  static detectPlatform(hostname?: string): ChatLLMPlatform | null {
    const host = hostname || window.location.hostname;
    const pathname = window.location.pathname;

    if (host.includes('chatgpt.com') || host.includes('openai.com')) {
      return 'chatgpt';
    }
    if (host.includes('claude.ai') || host.endsWith('easychat.top') || host.includes('.easychat.top')) {
      return 'claude';
    }
    if (host.includes('gemini.google.com')) {
      return 'gemini';
    }
    if (host.includes('notebooklm.google.com')) {
      return 'notebooklm';
    }
    if (host.includes('aistudio.google.com')) {
      return 'aistudio';
    }
    if (host.includes('grok.com') || (host.includes('x.com') && pathname.includes('/i/grok'))) {
      return 'grok';
    }

    return null;
  }

  /**
   * Extract session/conversation ID from URL
   */
  static extractSessionId(platform: ChatLLMPlatform, url?: string): string | null {
    const targetUrl = url || window.location.href;
    const pathname = new URL(targetUrl).pathname;

    try {
      switch (platform) {
        case 'chatgpt':
          // Match /c/{session_id} or /g/{gizmo_id}/c/{session_id}
          const chatgptMatch = pathname.match(/\/(?:c|g\/[^\/]+\/c)\/([a-f0-9-]+)/);
          if (chatgptMatch) return chatgptMatch[1];
          
          // Try URL parameters
          const urlParams = new URLSearchParams(new URL(targetUrl).search);
          return urlParams.get('session') || null;

        case 'claude':
          // Match /chat/{conversation_id}
          const claudeMatch = pathname.match(/\/chat\/([a-f0-9-]+)/);
          return claudeMatch ? claudeMatch[1] : null;

        case 'gemini':
          // Match /app/{id}
          const geminiMatch = pathname.match(/\/app\/([a-f0-9-]+)/);
          return geminiMatch ? geminiMatch[1] : null;

        case 'grok':
          // Match /c/{conversation_id}
          const grokMatch = pathname.match(/\/c\/([a-f0-9-]+)/);
          if (grokMatch) return grokMatch[1];
          
          // Match /project/{project_id}?chat={chat_id}
          if (pathname.startsWith('/project/')) {
            const urlParams = new URLSearchParams(new URL(targetUrl).search);
            return urlParams.get('chat') || null;
          }
          return null;

        case 'notebooklm':
          // Match /notebook/{id}
          const notebookMatch = pathname.match(/\/notebook\/([a-f0-9-]+)/);
          return notebookMatch ? notebookMatch[1] : null;

        case 'aistudio':
          // Similar to Gemini
          const aistudioMatch = pathname.match(/\/app\/([a-f0-9-]+)/);
          return aistudioMatch ? aistudioMatch[1] : null;

        default:
          return null;
      }
    } catch (error) {
      console.error('[PLATFORM] Error extracting session ID:', error);
      return null;
    }
  }

  /**
   * Check if URL matches platform API endpoint
   */
  static isPlatformAPI(url: string, platform: ChatLLMPlatform): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      switch (platform) {
        case 'chatgpt':
          return pathname.includes('/backend-api/conversation/') ||
                 pathname.includes('/backend-api/f/conversation');

        case 'claude':
          return pathname.includes('/api/organizations/') &&
                 pathname.includes('/chat_conversations/');

        case 'gemini':
          return urlObj.hostname.includes('gemini.google.com') &&
                 (pathname.includes('/rpc') || pathname.includes('/app/'));

        case 'grok':
          return pathname.includes('/api/') && pathname.includes('/conversation');

        case 'notebooklm':
          return urlObj.hostname.includes('notebooklm.google.com') &&
                 pathname.includes('/notebook/');

        case 'aistudio':
          return urlObj.hostname.includes('aistudio.google.com') &&
                 (pathname.includes('/rpc') || pathname.includes('/app/'));

        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }
}

