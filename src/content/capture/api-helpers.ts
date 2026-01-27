import type { ChatLLMPlatform } from '../../types/capture';

/**
 * API Helpers for ChatLLM Platforms
 * Handles authentication and API calls for fetching conversation data
 * Reference: examples/lyra_exporter_fetch.js
 */

// Store intercepted tokens
let chatGPTAccessToken: string | null = null;
let chatGPTDeviceId: string | null = null;
let claudeUserId: string | null = null;

/**
 * Convert HTML element to Markdown text
 * Reference: examples/lyra_exporter_fetch.js (lines 2398-2444)
 */
function htmlToMarkdown(element: Element | null): string {
  if (!element) return '';

  const MD_TAGS: Record<string, (c: string) => string> = {
    h1: c => `\n# ${c}\n`,
    h2: c => `\n## ${c}\n`,
    h3: c => `\n### ${c}\n`,
    h4: c => `\n#### ${c}\n`,
    h5: c => `\n##### ${c}\n`,
    h6: c => `\n###### ${c}\n`,
    strong: c => `**${c}**`,
    b: c => `**${c}**`,
    em: c => `*${c}*`,
    i: c => `*${c}*`,
    hr: () => '\n---\n',
    br: () => '\n',
    p: c => `\n${c}\n`,
    div: c => c,
    blockquote: c => `\n> ${c.split('\n').join('\n> ')}\n`,
    table: c => `\n${c}\n`,
    thead: c => c,
    tbody: c => c,
    tr: c => `${c}|\n`,
    th: c => `| **${c}** `,
    td: c => `| ${c} `,
    li: c => c
  };

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    const children = [...element.childNodes].map(processNode).join('');

    if (MD_TAGS[tag]) {
      return MD_TAGS[tag](children);
    }

    if (tag === 'code') {
      const inPre = element.parentElement?.tagName.toLowerCase() === 'pre';
      if (children.includes('\n') || inPre) {
        return inPre ? children : `\n\`\`\`\n${children}\n\`\`\`\n`;
      }
      return `\`${children}\``;
    }

    if (tag === 'pre') {
      const code = element.querySelector('code');
      if (code) {
        const lang = code.className.match(/language-(\w+)/)?.[1] || '';
        return `\n\`\`\`${lang}\n${code.textContent}\n\`\`\`\n`;
      }
      return `\n\`\`\`\n${children}\n\`\`\`\n`;
    }

    if (tag === 'a') {
      const href = element.getAttribute('href');
      return href ? `[${children}](${href})` : children;
    }

    if (tag === 'ul') {
      return `\n${[...element.children].map(li => `- ${processNode(li)}`).join('\n')}\n`;
    }

    if (tag === 'ol') {
      return `\n${[...element.children].map((li, i) => `${i + 1}. ${processNode(li)}`).join('\n')}\n`;
    }

    // Handle custom tags like grok:render - remove the tag but keep text content
    if (tag.includes('grok') || tag.includes('render') || element.tagName.toLowerCase().includes('grok')) {
      // Remove grok:render tags, only keep text content
      return children;
    }

    return children;
  }

  return processNode(element).replace(/^\s+/, '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Initialize fetch interception for ChatGPT to capture access token
 */
export function initChatGPTTokenCapture(): void {
  if ((window as any).__sys2path_fetch_intercepted) return;
  (window as any).__sys2path_fetch_intercepted = true;

  const originalFetch = window.fetch;
  window.fetch = async function(_resource: RequestInfo | URL, options?: RequestInit) {
    const headers = options?.headers;
    if (headers) {
      let authHeader: string | null = null;
      
      if (typeof headers === 'string') {
        authHeader = headers;
      } else if (headers instanceof Headers) {
        authHeader = headers.get('Authorization');
      } else if (headers && typeof headers === 'object') {
        authHeader = (headers as any).Authorization || (headers as any).authorization;
      }

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        if (token && token.toLowerCase() !== 'dummy') {
          chatGPTAccessToken = token;
          console.log('[API] Captured ChatGPT access token');
        }
      }
    }

    return originalFetch.apply(this, arguments as any);
  };
}

/**
 * Get ChatGPT access token
 */
export async function getChatGPTAccessToken(): Promise<string | null> {
  if (chatGPTAccessToken) return chatGPTAccessToken;

  try {
    const response = await fetch('/api/auth/session?unstable_client=true');
    const session = await response.json();
    if (session.accessToken) {
      chatGPTAccessToken = session.accessToken;
      return session.accessToken;
    }
  } catch (error) {
    console.error('[API] Failed to get ChatGPT access token:', error);
  }

  return null;
}

/**
 * Get ChatGPT device ID from cookies
 */
export function getChatGPTDeviceId(): string | null {
  if (chatGPTDeviceId) return chatGPTDeviceId;

  const cookieString = document.cookie;
  const match = cookieString.match(/oai-did=([^;]+)/);
  if (match) {
    chatGPTDeviceId = match[1];
    return chatGPTDeviceId;
  }

  return null;
}

/**
 * Get ChatGPT conversation data
 */
export async function getChatGPTConversation(conversationId: string): Promise<any> {
  const token = await getChatGPTAccessToken();
  if (!token) {
    throw new Error('ChatGPT access token not found');
  }

  const deviceId = getChatGPTDeviceId();
  if (!deviceId) {
    throw new Error('ChatGPT device ID not found');
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'oai-device-id': deviceId
  };

  const response = await fetch(`/backend-api/conversation/${conversationId}`, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch ChatGPT conversation (${response.status}): ${errorText || response.statusText}`);
  }

  return await response.json();
}

/**
 * Get Claude user ID
 * Uses the same approach as lyra_exporter_fetch.js
 */
export async function getClaudeUserId(): Promise<string | null> {
  if (claudeUserId) return claudeUserId;

  try {
    // Try to get from localStorage first (set by intercept script)
    const stored = localStorage.getItem('lyraClaudeUserId');
    if (stored) {
      claudeUserId = stored;
      return claudeUserId;
    }

    // Try to extract from organization endpoint
    const orgResponse = await fetch('/api/organizations');
    if (orgResponse.ok) {
      const orgs = await orgResponse.json();
      if (orgs && Array.isArray(orgs) && orgs.length > 0 && orgs[0].uuid) {
        const userId = orgs[0].uuid;
        claudeUserId = userId;
        localStorage.setItem('lyraClaudeUserId', userId);
        return userId;
      }
    }

    // Try to intercept from fetch requests (similar to lyra_exporter_fetch.js)
    // This is a fallback - the init script should capture it
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        function captureUserId(url) {
          const match = url.match(/\\/api\\/organizations\\/([a-f0-9-]+)\\//);
          if (match && match[1]) {
            localStorage.setItem('lyraClaudeUserId', match[1]);
            window.dispatchEvent(new CustomEvent('sys2pathClaudeUserIdCaptured', { detail: { userId: match[1] } }));
          }
        }
        const originalFetch = window.fetch;
        window.fetch = function(resource) {
          const url = typeof resource === 'string' ? resource : (resource.url || '');
          if (url) captureUserId(url);
          return originalFetch.apply(this, arguments);
        };
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();

    // Wait a bit for the intercept to capture
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const captured = localStorage.getItem('lyraClaudeUserId');
    if (captured) {
      claudeUserId = captured;
      return claudeUserId;
    }
  } catch (error) {
    console.error('[API] Failed to get Claude user ID:', error);
  }

  return null;
}

/**
 * Get Claude conversation data
 */
export async function getClaudeConversation(uuid: string): Promise<any> {
  const userId = await getClaudeUserId();
  if (!userId) {
    throw new Error('Claude user ID not found');
  }

  const endpoint = `/api/organizations/${userId}/chat_conversations/${uuid}`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Claude conversation (${response.status}): ${errorText || response.statusText}`);
  }

  return await response.json();
}

/**
 * Get Grok conversation data
 */
export async function getGrokConversation(conversationId: string): Promise<any> {
  try {
    // Step 1: Get response nodes
    const nodeUrl = `/rest/app-chat/conversations/${conversationId}/response-node?includeThreads=true`;
    const nodeResponse = await fetch(nodeUrl, {
      headers: { 'Accept': 'application/json' },
      credentials: 'include'
    });

    if (!nodeResponse.ok) {
      throw new Error(`Failed to get Grok response nodes: ${nodeResponse.status}`);
    }

    const nodeData = await nodeResponse.json();
    const responseNodes = nodeData.responseNodes || [];
    const responseIds = responseNodes.map((node: any) => node.responseId);

    if (!responseIds.length) {
      return { conversationId, responses: [], title: null };
    }

    // Step 2: Load full conversation content
    const loadUrl = `/rest/app-chat/conversations/${conversationId}/load-responses`;
    const loadResponse = await fetch(loadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ responseIds })
    });

    if (!loadResponse.ok) {
      throw new Error(`Failed to load Grok responses: ${loadResponse.status}`);
    }

    const conversationData = await loadResponse.json();

    // Try to get title
    let title = null;
    try {
      const allConvsResponse = await fetch('/rest/app-chat/conversations', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (allConvsResponse.ok) {
        const allConvs = await allConvsResponse.json();
        const conv = (allConvs.conversations || []).find((c: any) => c.conversationId === conversationId);
        title = conv?.title || null;
      }
    } catch (e) {
      console.warn('[API] Could not fetch Grok title:', e);
    }

    return {
      conversationId,
      title,
      responses: (conversationData.responses || []).filter((r: any) => !r.partial),
      responseNodes
    };
  } catch (error) {
    console.error('[API] Failed to get Grok conversation:', error);
    throw error;
  }
}

/**
 * Get Gemini conversation data (uses DOM-based extraction)
 */
export async function getGeminiConversation(): Promise<any> {
  // Gemini uses DOM extraction as there's no simple API
  const data: Array<{ human: { text: string; images?: any[] }; assistant: { text: string; images?: any[] } }> = [];
  const turns = document.querySelectorAll('div.conversation-turn, div.single-turn, div.conversation-container');

  for (const container of turns) {
    const userEl = container.querySelector('user-query .query-text, .query-text-line, [data-user-text]');
    const messageContent = container.querySelector('message-content');
    const modelEl = messageContent?.querySelector('.markdown-main-panel');

    const humanText = userEl?.textContent?.trim() || '';
    let assistantText = '';

    if (modelEl) {
      const clone = modelEl.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('button.retry-without-tool-button, model-thoughts, .model-thoughts, .thoughts-header').forEach(b => b.remove());
      // Use htmlToMarkdown to properly handle custom tags like grok:render
      assistantText = htmlToMarkdown(clone).trim();
    } else if (messageContent) {
      const clone = messageContent.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('button.retry-without-tool-button, model-thoughts, .model-thoughts, .thoughts-header').forEach(b => b.remove());
      // Use htmlToMarkdown to properly handle custom tags like grok:render
      assistantText = htmlToMarkdown(clone).trim();
    }

    // Filter out short thinking titles
    if (assistantText.length < 50 && !assistantText.includes('\n') && !assistantText.includes('*') && !assistantText.includes('#')) {
      assistantText = '';
    }

    if (humanText || assistantText) {
      data.push({
        human: { text: humanText },
        assistant: { text: assistantText }
      });
    }
  }

  return {
    title: document.querySelector('title')?.textContent?.trim() || 'Gemini Chat',
    platform: 'gemini',
    exportedAt: new Date().toISOString(),
    conversation: data
  };
}

/**
 * Get NoteBookLM conversation data (uses DOM-based extraction)
 */
export async function getNoteBookLMConversation(): Promise<any> {
  const data: Array<{ human: { text: string; images?: any[] }; assistant: { text: string; images?: any[] } }> = [];

  for (const turn of document.querySelectorAll('div.chat-message-pair')) {
    let question = turn.querySelector('chat-message .from-user-container .message-text-content')?.textContent?.trim() || '';
    if (question.startsWith('[Preamble] ')) {
      question = question.substring(11).trim();
    }

    let answer = '';
    const answerEl = turn.querySelector('chat-message .to-user-container .message-text-content');
    if (answerEl) {
      const parts: string[] = [];
      answerEl.querySelectorAll('labs-tailwind-structural-element-view-v2').forEach(el => {
        const bulletEl = el.querySelector('.bullet');
        let line = (bulletEl?.textContent?.trim() || '') + ' ';
        const para = el.querySelector('.paragraph');
        if (para) {
          let text = '';
          para.childNodes.forEach(n => {
            if (n.nodeType === Node.TEXT_NODE) {
              text += n.textContent;
            } else if (n.nodeType === Node.ELEMENT_NODE && !(n as Element).querySelector?.('.citation-marker')) {
              const elem = n as Element;
              text += elem.classList?.contains('bold') ? `**${elem.textContent}**` : (elem.textContent || '');
            }
          });
          line += text;
        }
        if (line.trim()) parts.push(line.trim());
      });
      answer = parts.join('\n\n');
    }

    if (question || answer) {
      data.push({
        human: { text: question },
        assistant: { text: answer }
      });
    }
  }

  return {
    title: `NotebookLM_${new Date().toISOString().slice(0, 10)}`,
    platform: 'notebooklm',
    exportedAt: new Date().toISOString(),
    conversation: data
  };
}

/**
 * Get AI Studio conversation data (uses DOM-based extraction)
 */
export async function getAIStudioConversation(): Promise<any> {
  const data: Array<{ human: { text: string; images?: any[] }; assistant: { text: string; images?: any[] } }> = [];
  const collectedData = new Map<Element, { type: string; text: string; images: any[] }>();

  // Helper function to extract data incrementally
  async function extractDataIncremental(_includeImages = true): Promise<void> {
    for (const turn of document.querySelectorAll('ms-chat-turn')) {
      if (collectedData.has(turn)) continue;

      const userEl = turn.querySelector('.chat-turn-container.user');
      const modelEl = turn.querySelector('.chat-turn-container.model');
      const turnData: { type: string; text: string; images: any[] } = { type: 'unknown', text: '', images: [] };

      if (userEl) {
        const textEl = userEl.querySelector('.user-prompt-container .turn-content');
        if (textEl) {
          // Use innerText instead of textContent for better text extraction
          let text = (textEl as HTMLElement).innerText?.trim().replace(/^User\s*[\n:]?/i, '').trim() || '';
          if (text) {
            turnData.type = 'user';
            turnData.text = text;
          }
        }
      } else if (modelEl) {
        const chunks = modelEl.querySelectorAll('ms-prompt-chunk');
        const texts: string[] = [];

        chunks.forEach(chunk => {
          if (chunk.querySelector('ms-thought-chunk')) return;
          const cmark = chunk.querySelector('ms-cmark-node');
          if (cmark) {
            // Use htmlToMarkdown instead of textContent for better formatting
            const md = htmlToMarkdown(cmark);
            if (md) texts.push(md);
          }
        });

        const text = texts.join('\n\n').trim();
        if (text) {
          turnData.type = 'model';
          turnData.text = text;
        }
      }

      // Allow messages with only images (no text)
      if (turnData.type !== 'unknown' && (turnData.text || turnData.images.length)) {
        collectedData.set(turn, turnData);
      }
    }
  }

  // Scroll and extract data
  const scroller = (() => {
    for (const sel of ['ms-chat-session ms-autoscroll-container', 'mat-sidenav-content', '.chat-view-container']) {
      const el = document.querySelector(sel);
      if (el && ((el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight || (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth)) {
        return el as HTMLElement;
      }
    }
    return document.documentElement;
  })();

  scroller.scrollTop = 0;
  await new Promise(resolve => setTimeout(resolve, 1000));

  let lastScrollTop = -1;
  while (true) {
    await extractDataIncremental();
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 10) break;
    lastScrollTop = scroller.scrollTop;
    scroller.scrollTop += scroller.clientHeight * 0.85;
    await new Promise(resolve => setTimeout(resolve, 250));
    if (scroller.scrollTop === lastScrollTop) break;
  }

  await extractDataIncremental();
  await new Promise(resolve => setTimeout(resolve, 500));

  // Pair user and assistant messages
  const sorted: Array<{ type: string; text: string; images: any[] }> = [];
  document.querySelectorAll('ms-chat-turn').forEach(t => {
    if (collectedData.has(t)) {
      sorted.push(collectedData.get(t)!);
    }
  });

  let lastHuman: { text: string; images?: any[] } | null = null;
  for (const item of sorted) {
    if (item.type === 'user') {
      lastHuman = lastHuman || { text: '', images: [] };
      lastHuman.text = (lastHuman.text ? lastHuman.text + '\n' : '') + item.text;
      if (item.images?.length) {
        if (!lastHuman.images) lastHuman.images = [];
        lastHuman.images.push(...item.images);
      }
    } else if (item.type === 'model') {
      const human: { text: string; images?: any[] } = { text: lastHuman?.text || '[No preceding user prompt found]' };
      if (lastHuman?.images?.length) human.images = lastHuman.images;
      const assistant: { text: string; images?: any[] } = { text: item.text };
      if (item.images?.length) assistant.images = item.images;
      data.push({ human, assistant });
      lastHuman = null;
    }
  }

  if (lastHuman) {
    data.push({
      human: { text: lastHuman.text },
      assistant: { text: '[Model response is pending]' }
    });
  }

  return {
    title: document.querySelector('title')?.textContent?.trim() || 'AI_Studio_Chat',
    platform: 'aistudio',
    exportedAt: new Date().toISOString(),
    conversation: data
  };
}

/**
 * Get conversation data for a platform
 * For DOM-based platforms (gemini, notebooklm, aistudio), conversationId is optional
 */
export async function getConversationData(
  platform: ChatLLMPlatform,
  conversationId?: string
): Promise<any> {
  switch (platform) {
    case 'chatgpt':
      if (!conversationId) throw new Error('ChatGPT requires conversation ID');
      return await getChatGPTConversation(conversationId);
    case 'claude':
      if (!conversationId) throw new Error('Claude requires conversation ID');
      return await getClaudeConversation(conversationId);
    case 'grok':
      if (!conversationId) throw new Error('Grok requires conversation ID');
      return await getGrokConversation(conversationId);
    case 'gemini':
      // DOM-based extraction, no conversationId needed
      return await getGeminiConversation();
    case 'notebooklm':
      // DOM-based extraction, no conversationId needed
      return await getNoteBookLMConversation();
    case 'aistudio':
      // DOM-based extraction, no conversationId needed
      return await getAIStudioConversation();
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

/**
 * Get all ChatGPT conversations (paginated)
 * Reference: examples/lyra_exporter_fetch.js ChatGPTHandler.getAllConversations
 */
export async function getAllChatGPTConversations(
  workspaceId?: string,
  workspaceType: 'user' | 'team' = 'user',
  onProgress?: (current: number, total: number | null) => void
): Promise<Array<{ id: string; title?: string; [key: string]: any }>> {
  const token = await getChatGPTAccessToken();
  if (!token) {
    throw new Error('ChatGPT access token not found');
  }

  const deviceId = getChatGPTDeviceId();
  if (!deviceId) {
    throw new Error('ChatGPT device ID not found');
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'oai-device-id': deviceId
  };

  if (workspaceType === 'team' && workspaceId) {
    headers['ChatGPT-Account-Id'] = workspaceId;
  }

  const allConversations: Array<{ id: string; title?: string; [key: string]: any }> = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`/backend-api/conversations?offset=${offset}&limit=28&order=updated`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch ChatGPT conversation list (${response.status})`);
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      allConversations.push(...data.items);
      hasMore = data.items.length === 28;
      offset += data.items.length;
      
      // Report progress
      if (onProgress) {
        onProgress(allConversations.length, null); // total is unknown until all pages are fetched
      }
    } else {
      hasMore = false;
    }
  }

  return allConversations;
}

/**
 * Get all Claude conversations
 * Reference: examples/lyra_exporter_fetch.js ClaudeHandler.getAllConversations
 */
export async function getAllClaudeConversations(
  onProgress?: (current: number, total: number | null) => void
): Promise<Array<{ uuid: string; name?: string; project_uuid?: string; project?: any; [key: string]: any }>> {
  const userId = await getClaudeUserId();
  if (!userId) {
    throw new Error('Claude user ID not found');
  }

  // Report progress: starting
  if (onProgress) {
    onProgress(0, null);
  }

  // Determine base URL
  let baseUrl = '';
  if (window.location.hostname.includes('claude.ai')) {
    baseUrl = 'https://claude.ai';
  } else if (window.location.hostname.includes('easychat.top')) {
    baseUrl = `https://${window.location.hostname}`;
  } else {
    baseUrl = window.location.origin;
  }

  const response = await fetch(`${baseUrl}/api/organizations/${userId}/chat_conversations`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Claude conversation list (${response.status})`);
  }

  const conversations = await response.json();
  
  // Report progress: completed
  if (onProgress && Array.isArray(conversations)) {
    onProgress(conversations.length, conversations.length);
  }

  return conversations;
}

/**
 * Get Claude conversation with tree mode support
 */
export async function getClaudeConversationWithTree(uuid: string, treeMode: boolean = false): Promise<any> {
  const userId = await getClaudeUserId();
  if (!userId) {
    throw new Error('Claude user ID not found');
  }

  // Determine base URL
  let baseUrl = '';
  if (window.location.hostname.includes('claude.ai')) {
    baseUrl = 'https://claude.ai';
  } else if (window.location.hostname.includes('easychat.top')) {
    baseUrl = `https://${window.location.hostname}`;
  } else {
    baseUrl = window.location.origin;
  }

  const endpoint = treeMode
    ? `/api/organizations/${userId}/chat_conversations/${uuid}?tree=True&rendering_mode=messages&render_all_tools=true`
    : `/api/organizations/${userId}/chat_conversations/${uuid}`;
  
  const apiUrl = `${baseUrl}${endpoint}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Claude conversation (${response.status}): ${errorText || response.statusText}`);
  }

  return await response.json();
}

/**
 * Get all ChatGPT gizmos (projects) with pagination support
 * API: /backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=5&owned_only=true
 */
export async function getAllChatGPTGizmos(
  onProgress?: (current: number, total: number | null) => void
): Promise<{
  items: Array<{
    gizmo: {
      gizmo: {
        id: string;
        display: { name: string };
      };
    };
    conversations: {
      items: Array<any>;
      cursor: string | null;
    };
  }>;
  cursor: string | null;
}> {
  const token = await getChatGPTAccessToken();
  if (!token) {
    throw new Error('ChatGPT access token not found');
  }

  const deviceId = getChatGPTDeviceId();
  if (!deviceId) {
    throw new Error('ChatGPT device ID not found');
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'oai-device-id': deviceId
  };

  const allItems: Array<{
    gizmo: {
      gizmo: {
        id: string;
        display: { name: string };
      };
    };
    conversations: {
      items: Array<any>;
      cursor: string | null;
    };
  }> = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const url = cursor
      ? `/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=5&owned_only=true&cursor=${encodeURIComponent(cursor)}`
      : `/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=5&owned_only=true`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch ChatGPT gizmos (${response.status})`);
    }

    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      allItems.push(...data.items);
      
      // Report progress
      if (onProgress) {
        onProgress(allItems.length, null);
      }
    }

    cursor = data.cursor || null;
    hasMore = cursor !== null;
  }

  return {
    items: allItems,
    cursor: null
  };
}

/**
 * Get all conversations for a specific gizmo
 * Note: The gizmo API returns limited conversations per gizmo.
 * For complete conversation list, we also fetch from regular conversations API and filter by gizmo_id.
 */
export async function getGizmoConversations(
  gizmoId: string,
  gizmoName: string,
  onProgress?: (current: number, total: number | null) => void
): Promise<Array<{ id: string; title?: string; gizmoId: string; gizmoName: string; [key: string]: any }>> {
  const allConversations: Array<{ id: string; title?: string; gizmoId: string; gizmoName: string; [key: string]: any }> = [];

  // Fetch all conversations and filter by gizmo_id
  // This ensures we get all conversations for the gizmo, not just the limited ones from gizmo API
  const allConvs = await getAllChatGPTConversations(undefined, 'user');
  
  for (const conv of allConvs) {
    // Check if conversation belongs to this gizmo
    // ChatGPT conversations may have gizmo_id field
    const convGizmoId = (conv as any).gizmo_id || (conv as any).conversation_template_id;
    if (convGizmoId === gizmoId) {
      allConversations.push({
        ...conv,
        id: conv.id || '',
        gizmoId,
        gizmoName
      });
      
      // Report progress
      if (onProgress) {
        onProgress(allConversations.length, null);
      }
    }
  }

  return allConversations;
}

/**
 * Get all ChatGPT conversations with gizmo information
 * Combines conversations from gizmos and regular conversations
 */
export async function getAllChatGPTConversationsWithGizmos(
  onProgress?: (current: number, total: number | null) => void
): Promise<Array<{ id: string; title?: string; gizmoId?: string; gizmoName?: string; [key: string]: any }>> {
  try {
    // 第一步：获取所有 gizmos（projects）及其包含的 conversation 信息
    // gizmo API 返回的每个 gizmo 的 conversations.items 包含了该 gizmo 的所有 conversations
    // 通过 cursor 分页可以获取所有 gizmos
    const gizmosData = await getAllChatGPTGizmos();

    // 建立 gizmo ID -> gizmo Name 映射
    const gizmoNameMap = new Map<string, string>();
    // 建立 conversation ID -> gizmo ID 映射（从 gizmo API 的 conversations.items 中）
    const conversationToGizmoMap = new Map<string, string>();
    // 保存第一步中的 conversations（这些已经有完整的 gizmo 信息）
    const conversationsFromGizmos: Array<{ id: string; title?: string; gizmoId: string; gizmoName: string; [key: string]: any }> = [];
    
    // 遍历所有 gizmos，建立映射关系并保存 conversations
    for (const item of gizmosData.items) {
      const gizmo = item.gizmo?.gizmo;
      if (gizmo && gizmo.id) {
        const gizmoId = gizmo.id;
        const gizmoName = gizmo.display?.name || 'Unknown';
        // 始终设置 gizmoNameMap，即使名称为空也要记录
        gizmoNameMap.set(gizmoId, gizmoName);
        
        // 从 gizmo API 返回的 conversations.items 中提取所有 conversation IDs
        // 注意：conversations 在 item 的顶层，不在 item.gizmo 中
        // 这些是第一步中获取的项目包含的所有 conversation 信息（完整的）
        const conversations = (item as any).conversations?.items || [];
        for (const conv of conversations) {
          const convId = conv.id || conv.conversation_id;
          if (convId) {
            conversationToGizmoMap.set(convId, gizmoId);
            // 保存第一步中的 conversation（已有完整的 gizmo 信息）
            conversationsFromGizmos.push({
              ...conv,
              id: convId,
              gizmoId,
              gizmoName
            });
          }
        }
      }
    }
    
    // 调试日志：检查第一步获取的数据
    console.log('[DEBUG] Gizmos count:', gizmosData.items.length);
    console.log('[DEBUG] Conversations from gizmos count:', conversationsFromGizmos.length);
    console.log('[DEBUG] Gizmo name map:', Array.from(gizmoNameMap.entries()).slice(0, 5));
    console.log('[DEBUG] Sample conversations from gizmos:', conversationsFromGizmos.slice(0, 3).map(c => ({ id: c.id, gizmoId: c.gizmoId, gizmoName: c.gizmoName })));

    // 第二步：获取所有 conversations
    const allRegularConvs = await getAllChatGPTConversations(undefined, 'user', onProgress);
    
    // 第三步：合并两步的数据
    // 第一步中的 conversations 和第二步中的 conversations 应该合并，而不是只匹配
    const conversationsMap = new Map<string, { id: string; title?: string; gizmoId?: string; gizmoName?: string; [key: string]: any }>();
    
    // 先添加第一步中的 conversations（这些已经有完整的 gizmo 信息）
    for (const conv of conversationsFromGizmos) {
      conversationsMap.set(conv.id, conv);
    }
    
    // 调试日志：检查第一步添加后的状态
    const conversationsWithGizmo = Array.from(conversationsMap.values()).filter(c => c.gizmoId);
    console.log('[DEBUG] After adding gizmo conversations, conversations with gizmo:', conversationsWithGizmo.length);
    console.log('[DEBUG] Sample conversations with gizmo:', conversationsWithGizmo.slice(0, 3).map(c => ({ id: c.id, gizmoId: c.gizmoId, gizmoName: c.gizmoName })));
    
    // 然后处理第二步中的 conversations
    for (const conv of allRegularConvs) {
      const convId = conv.id || '';
      
      // 如果已经在第一步中添加过，跳过（避免重复）
      if (conversationsMap.has(convId)) {
        continue;
      }
      
      // 完全基于第一步的映射来匹配
      // 如果 conversation ID 在映射中，则它属于对应的 gizmo
      // 如果不在，则它不属于任何 gizmo（属于"无项目"）
      const gizmoId = conversationToGizmoMap.get(convId);
      const gizmoName = gizmoId ? gizmoNameMap.get(gizmoId) : undefined;
      
      conversationsMap.set(convId, {
        ...conv,
        id: convId,
        gizmoId: gizmoId || undefined,
        gizmoName: gizmoName || undefined
      });
    }
    
    // 调试日志：检查最终结果
    const finalConversationsWithGizmo = Array.from(conversationsMap.values()).filter(c => c.gizmoId);
    console.log('[DEBUG] Final conversations with gizmo:', finalConversationsWithGizmo.length);
    console.log('[DEBUG] Final conversations without gizmo:', Array.from(conversationsMap.values()).filter(c => !c.gizmoId).length);

    // 最终进度更新
    if (onProgress) {
      onProgress(conversationsMap.size, conversationsMap.size);
    }

    return Array.from(conversationsMap.values());
  } catch (error) {
    // 如果 gizmo API 失败，回退到常规 API
    // 回退模式下无法获取 gizmo 信息，所有 conversations 都属于"无项目"
    const convs = await getAllChatGPTConversations(undefined, 'user', onProgress);
    return convs.map(conv => ({
      ...conv,
      id: conv.id || '',
      gizmoId: undefined,
      gizmoName: undefined
    }));
  }
}

