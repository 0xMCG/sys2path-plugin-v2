import { PlatformDetector } from '../../services/platform-detector';
import type { ChatLLMConversation, ChatLLMMessage, ChatLLMPlatform } from '../../types/capture';
import { getConversationData, initChatGPTTokenCapture } from './api-helpers';

/**
 * ChatLLM Platform Capture Module
 * Captures conversations from ChatGPT, Claude, Gemini, NoteBookLM, AI Studio, and Grok
 * Reference: examples/lyra_exporter_fetch.js
 */

export class ChatLLMCapture {
  private platform: ChatLLMPlatform | null = null;
  private sessionId: string | null = null;

  /**
   * Initialize capture for current page
   */
  init(): void {
    this.platform = PlatformDetector.detectPlatform();
    if (!this.platform) {
      console.log('[CAPTURE] Not a ChatLLM platform');
      return;
    }

    // For DOM-based platforms (gemini, notebooklm, aistudio), session ID is optional
    // They use DOM extraction and don't require a session ID from URL
    const domBasedPlatforms: ChatLLMPlatform[] = ['gemini', 'notebooklm', 'aistudio'];
    const isDOMBased = domBasedPlatforms.includes(this.platform);

    if (!isDOMBased) {
      // For API-based platforms, session ID is required
      this.sessionId = PlatformDetector.extractSessionId(this.platform);
      if (!this.sessionId) {
        console.log('[CAPTURE] No session ID found');
        return;
      }
    } else {
      // For DOM-based platforms, try to extract session ID, but generate one if not found
      this.sessionId = PlatformDetector.extractSessionId(this.platform);
      if (!this.sessionId) {
        // Generate a stable ID based on URL for DOM-based platforms
        // This ensures we can track the same conversation across multiple captures
        const url = window.location.href;
        const urlHash = url.split('#')[0]; // Use URL without hash as base
        this.sessionId = `${this.platform}-${btoa(urlHash).replace(/[+/=]/g, '').substring(0, 16)}`;
        console.log('[CAPTURE] Generated session ID for DOM-based platform:', this.sessionId);
      }
    }

    console.log('[CAPTURE] Initialized for platform:', this.platform, 'session:', this.sessionId);
    
    // Initialize token capture for ChatGPT
    if (this.platform === 'chatgpt') {
      initChatGPTTokenCapture();
    }
  }

  /**
   * Capture conversation data using API or DOM extraction
   */
  async capture(): Promise<ChatLLMConversation | null> {
    if (!this.platform) {
      throw new Error('Platform not initialized');
    }

    // For DOM-based platforms, sessionId is optional (generated if not found)
    // For API-based platforms, sessionId is required
    const domBasedPlatforms: ChatLLMPlatform[] = ['gemini', 'notebooklm', 'aistudio'];
    const isDOMBased = domBasedPlatforms.includes(this.platform);

    if (!isDOMBased && !this.sessionId) {
      throw new Error('Platform or session ID not initialized');
    }

    try {
      console.log('[CAPTURE] Fetching conversation data...');
      
      // Fetch conversation data - DOM-based platforms don't need conversationId
      const apiData = isDOMBased 
        ? await getConversationData(this.platform)
        : await getConversationData(this.platform, this.sessionId!);
      
      // Convert API data to ChatLLMConversation format
      const conversation = this.convertAPIDataToConversation(apiData);
      
      if (!conversation || conversation.messages.length === 0) {
        throw new Error('No messages found in conversation');
      }

      // Send to background script for saving instead of direct storage call
      // Content scripts may not have direct access to chrome.storage.local
      chrome.runtime.sendMessage({
        type: 'SAVE_CONVERSATION',
        data: conversation
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[CAPTURE] Failed to save conversation:', chrome.runtime.lastError);
        } else if (response?.success) {
          console.log('[CAPTURE] Successfully saved conversation:', conversation.id);
        } else {
          console.error('[CAPTURE] Failed to save conversation:', response?.error);
        }
      });
      
      return conversation;
    } catch (error) {
      console.error('[CAPTURE] Failed to capture conversation:', error);
      throw error;
    }
  }

  /**
   * Convert API response data to ChatLLMConversation format
   */
  private convertAPIDataToConversation(apiData: unknown): ChatLLMConversation | null {
    if (!this.platform) return null;
    
    // For DOM-based platforms, use generated sessionId if available, otherwise generate one
    const domBasedPlatforms: ChatLLMPlatform[] = ['gemini', 'notebooklm', 'aistudio'];
    const isDOMBased = domBasedPlatforms.includes(this.platform);
    const conversationId = this.sessionId || (isDOMBased ? `${this.platform}-${Date.now()}` : null);
    
    if (!conversationId) return null;

    switch (this.platform) {
      case 'chatgpt':
        return this.convertChatGPTData(apiData);
      case 'claude':
        return this.convertClaudeData(apiData);
      case 'grok':
        return this.convertGrokData(apiData);
      case 'gemini':
        return this.convertGeminiData(apiData);
      case 'notebooklm':
        return this.convertNoteBookLMData(apiData);
      case 'aistudio':
        return this.convertAIStudioData(apiData);
      default:
        throw new Error(`Platform ${this.platform} conversion not yet implemented`);
    }
  }

  /**
   * Decode Unicode escape sequences in strings
   * e.g., "\u5e74" -> "年"
   */
  private decodeUnicodeEscapes(text: string): string {
    if (!text || !text.includes('\\u')) {
      return text;
    }
    
    try {
      // Try JSON.parse for simple cases (wrapped in quotes)
      return JSON.parse('"' + text.replace(/"/g, '\\"') + '"');
    } catch {
      // Fallback: manual replacement for Unicode escape sequences
      return text.replace(/\\u([0-9a-fA-F]{4})/g, (_match, code) => {
        return String.fromCharCode(parseInt(code, 16));
      });
    }
  }

  /**
   * Convert ChatGPT API data to ChatLLMConversation
   */
  private convertChatGPTData(data: unknown): ChatLLMConversation {
    const dataObj = data as { mapping?: Record<string, { message?: { author?: { role?: string }; content?: { parts?: Array<{ text?: string }>; text?: string } }; create_time?: number }>; title?: string };
    const messages: ChatLLMMessage[] = [];
    
    // ChatGPT API returns data in a mapping structure
    if (dataObj.mapping) {
      const nodeIds = Object.keys(dataObj.mapping);
      const sortedNodes = nodeIds
        .map(id => ({ id, node: dataObj.mapping![id] }))
        .filter(({ node }) => node && node.message)
        .sort((a, b) => {
          const aTime = a.node.create_time || 0;
          const bTime = b.node.create_time || 0;
          return aTime - bTime;
        });

      for (const { node } of sortedNodes) {
        const message = node.message;
        if (!message || !message.content) continue;

        const role = message.author?.role === 'user' ? 'user' : 'assistant';
        const content = message.content;
        
        // Extract text content, filtering out tool calls and non-text parts
        let textContent = '';
        
        if (content.parts && Array.isArray(content.parts)) {
          // Filter and extract text parts only
          const textParts: string[] = [];
          for (const part of content.parts) {
            // Skip tool calls and function calls
            if (typeof part === 'string') {
              // Simple string part
              textParts.push(part);
            } else if (part && typeof part === 'object') {
              // Object part - check if it's a text part
              const partObj = part as any; // Use 'any' to handle dynamic ChatGPT API structure
              if (partObj.content_type === 'text' && typeof partObj.text === 'string') {
                textParts.push(partObj.text);
              } else if (typeof partObj.text === 'string' && !partObj.function_call && !partObj.tool_calls) {
                // Text field without function/tool calls
                textParts.push(partObj.text);
              }
              // Skip parts with function_call or tool_calls
            }
          }
          textContent = textParts.join('\n\n').trim();
        } else if (content.text) {
          // Direct text field
          textContent = content.text;
        } else if (typeof content === 'string') {
          // Content is directly a string
          textContent = content;
        }
        
        // Decode Unicode escape sequences in the text content
        if (textContent.trim()) {
          const decodedContent = this.decodeUnicodeEscapes(textContent.trim());
          messages.push({
            role,
            content: decodedContent,
            timestamp: node.create_time ? node.create_time * 1000 : Date.now()
          });
        }
      }
    }

    return {
      id: this.sessionId!,
      platform: 'chatgpt',
      title: dataObj.title || this.extractTitle(),
      messages,
      capturedAt: Date.now(),
      url: window.location.href
    };
  }

  /**
   * Convert Claude API data to ChatLLMConversation
   */
  private convertClaudeData(data: unknown): ChatLLMConversation {
    const dataObj = data as { chat_messages?: Array<{ role?: string; text?: string; created_at?: string }>; name?: string };
    const messages: ChatLLMMessage[] = [];
    
    if (dataObj.chat_messages && Array.isArray(dataObj.chat_messages)) {
      for (const msg of dataObj.chat_messages) {
        const role = msg.role === 'human' ? 'user' : 'assistant';
        const content = msg.text || '';
        
        if (content.trim()) {
          messages.push({
            role,
            content: content.trim(),
            timestamp: msg.created_at ? new Date(msg.created_at).getTime() : Date.now()
          });
        }
      }
    }

    return {
      id: this.sessionId!,
      platform: 'claude',
      title: dataObj.name || this.extractTitle(),
      messages,
      capturedAt: Date.now(),
      url: window.location.href
    };
  }

  /**
   * Process grok:render tags in message content
   * Reference: examples/lyra-exporter/src/utils/fileParser/grokParser.js
   */
  private processGrokRenderTags(content: string, citations?: Array<{ id?: string; url?: string; title?: string }>, webSearchResults?: Array<{ url?: string; title?: string }>): string {
    if (!content || !content.includes('<grok:render')) {
      return content;
    }

    // Build citation map if available
    const citationMap = new Map<string, { url: string; title: string }>();
    
    if (citations && Array.isArray(citations)) {
      citations.forEach(cit => {
        if (cit.id && cit.url) {
          citationMap.set(cit.id, {
            url: cit.url,
            title: cit.title || 'Source'
          });
        }
      });
    }
    
    // Also check webSearchResults for citation mapping
    if (webSearchResults && Array.isArray(webSearchResults) && citationMap.size === 0) {
      // Try to extract citation IDs from grok:render tags and match with webSearchResults
      const renderMatches = content.matchAll(/<grok:render card_id="([^"]+)"[\s\S]*?citation_id[^>]*>(\d+)<\/argument>/g);
      for (const match of renderMatches) {
        const cardId = match[1];
        const citationId = match[2];
        const searchResult = webSearchResults[parseInt(citationId)];
        if (searchResult && searchResult.url) {
          citationMap.set(cardId, {
            url: searchResult.url,
            title: searchResult.title || 'Source'
          });
        }
      }
    }

    let processedContent = content;

      // Replace grok:render tags with Markdown links if citation found
      if (citationMap.size > 0) {
        processedContent = processedContent.replace(
          /<grok:render card_id="([^"]+)"[\s\S]*?<\/grok:render>/g,
          (_match, cardId) => {
            const citation = citationMap.get(cardId);
            if (citation) {
              // Escape brackets in title for Markdown
              const escapedTitle = citation.title.replace(/([\[\]])/g, '\\$1');
              return `[${escapedTitle}](${citation.url})`;
            }
            return ''; // Remove if no citation found
          }
        );
      }

    // Remove all remaining grok:render tags that weren't replaced
    processedContent = processedContent.replace(/<grok:render[\s\S]*?<\/grok:render>/g, '').trim();

    return processedContent;
  }

  /**
   * Convert Grok API data to ChatLLMConversation
   */
  private convertGrokData(data: unknown): ChatLLMConversation {
    const dataObj = data as { 
      responses?: Array<{ 
        sender?: string; 
        message?: string; 
        createTime?: string | number;
        citations?: Array<{ id?: string; url?: string; title?: string }>;
        webSearchResults?: Array<{ url?: string; title?: string }>;
        cardAttachmentsJson?: string[];
      }>; 
      title?: string 
    };
    const messages: ChatLLMMessage[] = [];
    
    if (dataObj.responses && Array.isArray(dataObj.responses)) {
      for (const response of dataObj.responses) {
        const role = response.sender === 'human' ? 'user' : 'assistant';
        let content = response.message || '';
        
        // Process grok:render tags if present
        if (content.includes('<grok:render')) {
          // Try to parse citations from cardAttachmentsJson if available
          let citations: Array<{ id?: string; url?: string; title?: string }> | undefined = undefined;
          if (response.cardAttachmentsJson && Array.isArray(response.cardAttachmentsJson)) {
            try {
              const parsedCitations: Array<{ id?: string; url?: string; title?: string }> = [];
              response.cardAttachmentsJson.forEach(cardStr => {
                try {
                  const card = JSON.parse(cardStr);
                  if (card.cardType === 'citation_card' && card.url) {
                    const searchResult = response.webSearchResults?.find((sr: any) => sr.url === card.url);
                    parsedCitations.push({
                      id: card.id,
                      url: card.url,
                      title: searchResult?.title || 'Source'
                    });
                  }
                } catch (e) {
                  console.warn('[CAPTURE] Failed to parse cardAttachmentsJson:', e);
                }
              });
              if (parsedCitations.length > 0) {
                citations = parsedCitations;
              }
            } catch (e) {
              console.warn('[CAPTURE] Failed to process cardAttachmentsJson:', e);
            }
          }
          
          content = this.processGrokRenderTags(
            content, 
            citations || response.citations || undefined, 
            response.webSearchResults
          );
        }
        
        if (content.trim()) {
          messages.push({
            role,
            content: content.trim(),
            timestamp: response.createTime ? new Date(response.createTime).getTime() : Date.now()
          });
        }
      }
    }

    return {
      id: this.sessionId!,
      platform: 'grok',
      title: dataObj.title || this.extractTitle(),
      messages,
      capturedAt: Date.now(),
      url: window.location.href
    };
  }

  /**
   * Convert Gemini API data to ChatLLMConversation
   */
  private convertGeminiData(data: unknown): ChatLLMConversation {
    const dataObj = data as { conversation?: Array<{ human?: { text?: string }; assistant?: { text?: string } }>; title?: string };
    const messages: ChatLLMMessage[] = [];
    
    if (dataObj.conversation && Array.isArray(dataObj.conversation)) {
      for (const turn of dataObj.conversation) {
        if (turn.human?.text) {
          messages.push({
            role: 'user',
            content: turn.human.text.trim(),
            timestamp: Date.now() - (dataObj.conversation.length - messages.length) * 1000
          });
        }
        if (turn.assistant?.text) {
          messages.push({
            role: 'assistant',
            content: turn.assistant.text.trim(),
            timestamp: Date.now() - (dataObj.conversation.length - messages.length) * 1000
          });
        }
      }
    }

    // Get conversation ID from class property or generate one
    if (!this.platform) {
      throw new Error('Platform not initialized');
    }
    const domBasedPlatforms: ChatLLMPlatform[] = ['gemini', 'notebooklm', 'aistudio'];
    const isDOMBased = domBasedPlatforms.includes(this.platform);
    const conversationId = this.sessionId || (isDOMBased ? `${this.platform}-${Date.now()}` : null);
    
    if (!conversationId) {
      throw new Error('Failed to generate conversation ID');
    }

    return {
      id: conversationId,
      platform: 'gemini',
      title: this.extractTitleFromFirstMessage(messages), // Always extract from first message, ignore API title
      messages,
      capturedAt: Date.now(),
      url: window.location.href
    };
  }

  /**
   * Convert NoteBookLM API data to ChatLLMConversation
   */
  private convertNoteBookLMData(data: unknown): ChatLLMConversation {
    const dataObj = data as { conversation?: Array<{ human?: { text?: string }; assistant?: { text?: string } }>; title?: string };
    const messages: ChatLLMMessage[] = [];
    
    if (dataObj.conversation && Array.isArray(dataObj.conversation)) {
      for (const turn of dataObj.conversation) {
        if (turn.human?.text) {
          messages.push({
            role: 'user',
            content: turn.human.text.trim(),
            timestamp: Date.now() - (dataObj.conversation.length - messages.length) * 1000
          });
        }
        if (turn.assistant?.text) {
          messages.push({
            role: 'assistant',
            content: turn.assistant.text.trim(),
            timestamp: Date.now() - (dataObj.conversation.length - messages.length) * 1000
          });
        }
      }
    }

    // Get conversation ID from class property or generate one
    if (!this.platform) {
      throw new Error('Platform not initialized');
    }
    const domBasedPlatforms: ChatLLMPlatform[] = ['gemini', 'notebooklm', 'aistudio'];
    const isDOMBased = domBasedPlatforms.includes(this.platform);
    const conversationId = this.sessionId || (isDOMBased ? `${this.platform}-${Date.now()}` : null);
    
    if (!conversationId) {
      throw new Error('Failed to generate conversation ID');
    }

    return {
      id: conversationId,
      platform: 'notebooklm',
      title: this.extractTitleFromFirstMessage(messages), // Always extract from first message, ignore API title
      messages,
      capturedAt: Date.now(),
      url: window.location.href
    };
  }

  /**
   * Convert AI Studio API data to ChatLLMConversation
   */
  private convertAIStudioData(data: unknown): ChatLLMConversation {
    const dataObj = data as { conversation?: Array<{ human?: { text?: string }; assistant?: { text?: string } }>; title?: string };
    const messages: ChatLLMMessage[] = [];
    
    if (dataObj.conversation && Array.isArray(dataObj.conversation)) {
      for (const turn of dataObj.conversation) {
        if (turn.human?.text) {
          messages.push({
            role: 'user',
            content: turn.human.text.trim(),
            timestamp: Date.now() - (dataObj.conversation.length - messages.length) * 1000
          });
        }
        if (turn.assistant?.text) {
          messages.push({
            role: 'assistant',
            content: turn.assistant.text.trim(),
            timestamp: Date.now() - (dataObj.conversation.length - messages.length) * 1000
          });
        }
      }
    }

    // Get conversation ID from class property or generate one
    if (!this.platform) {
      throw new Error('Platform not initialized');
    }
    const domBasedPlatforms: ChatLLMPlatform[] = ['gemini', 'notebooklm', 'aistudio'];
    const isDOMBased = domBasedPlatforms.includes(this.platform);
    const conversationId = this.sessionId || (isDOMBased ? `${this.platform}-${Date.now()}` : null);
    
    if (!conversationId) {
      throw new Error('Failed to generate conversation ID');
    }

    return {
      id: conversationId,
      platform: 'aistudio',
      title: this.extractTitleFromFirstMessage(messages), // Always extract from first message, ignore API title
      messages,
      capturedAt: Date.now(),
      url: window.location.href
    };
  }

  /**
   * Extract title from first message
   * For Chinese: first 12 Chinese characters
   * For English: first 5 words
   * For mixed: 1 Chinese char = 1 unit, 1 English word = 2 units, target = 12 units
   * Adds "..." suffix if title is extracted from first message
   */
  private extractTitleFromFirstMessage(messages: ChatLLMMessage[]): string {
    if (messages.length === 0) return 'Untitled Conversation';
    
    // Find first non-empty message (user or assistant)
    const firstMessage = messages.find(msg => msg.content.trim());
    if (!firstMessage) return 'Untitled Conversation';
    
    const text = firstMessage.content.trim();
    if (!text) return 'Untitled Conversation';
    
    // Check if text contains Chinese characters
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    // Check if text contains English words (letters)
    const hasEnglish = /[a-zA-Z]/.test(text);
    
    let title: string;
    
    if (hasChinese && hasEnglish) {
      // Mixed: extract based on "Chinese character units"
      // 1 Chinese char = 1 unit, 1 English word = 2 units
      // Target: 12 units total
      title = this.extractMixedLanguageTitle(text, 12);
    } else if (hasChinese) {
      // Pure Chinese: extract first 12 Chinese characters
      const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
      title = chineseChars.slice(0, 12).join('') || 'Untitled Conversation';
    } else if (hasEnglish) {
      // Pure English: extract first 5 words
      const words = text.split(/\s+/).filter(w => w.length > 0 && /[a-zA-Z]/.test(w));
      title = words.slice(0, 5).join(' ') || 'Untitled Conversation';
    } else {
      // Other languages or no recognizable content
      // Extract first 12 characters as fallback
      title = text.slice(0, 12).trim() || 'Untitled Conversation';
    }
    
    // Add "..." suffix if title is extracted from first message (not default)
    if (title !== 'Untitled Conversation') {
      return title + '...';
    }
    
    return title;
  }

  /**
   * Extract title from mixed language text based on "Chinese character units"
   * @param text - The text to extract from
   * @param targetUnits - Target number of units (default: 10)
   * @returns Extracted title string
   */
  private extractMixedLanguageTitle(text: string, targetUnits: number): string {
    const result: string[] = [];
    let currentUnits = 0;
    let i = 0;
    
    while (i < text.length && currentUnits < targetUnits) {
      const char = text[i];
      
      // Check if current character is Chinese
      if (/[\u4e00-\u9fa5]/.test(char)) {
        result.push(char);
        currentUnits += 1;
        i += 1;
      } 
      // Check if current character starts an English word
      else if (/[a-zA-Z]/.test(char)) {
        // Extract the whole word
        const wordMatch = text.slice(i).match(/^[a-zA-Z]+/);
        if (wordMatch) {
          const word = wordMatch[0];
          result.push(word);
          currentUnits += 2;
          i += word.length;
        } else {
          i += 1;
        }
      } 
      // Other characters (spaces, punctuation, etc.)
      else {
        // Include spaces and punctuation to maintain readability
        if (/\s/.test(char)) {
          result.push(char);
        } else if (currentUnits > 0) {
          // Include punctuation if we already have content
          result.push(char);
        }
        i += 1;
      }
    }
    
    return result.join('').trim() || 'Untitled Conversation';
  }

  /**
   * Extract title from page (fallback method)
   * For DOM-based platforms (Gemini, NotebookLM, AI Studio), use first message
   */
  private extractTitle(messages?: ChatLLMMessage[]): string {
    // For DOM-based platforms, use first message if available
    const domBasedPlatforms: ChatLLMPlatform[] = ['gemini', 'notebooklm', 'aistudio'];
    if (this.platform && domBasedPlatforms.includes(this.platform) && messages && messages.length > 0) {
      return this.extractTitleFromFirstMessage(messages);
    }

    // For other platforms, try various title sources
    const titleElement = document.querySelector('title');
    if (titleElement) {
      const title = titleElement.textContent?.trim();
      if (title && title !== '') return title;
    }

    // Try heading elements
    const h1 = document.querySelector('h1');
    if (h1) {
      const text = h1.textContent?.trim();
      if (text && text !== '') return text;
    }

    return 'Untitled Conversation';
  }
}

