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

