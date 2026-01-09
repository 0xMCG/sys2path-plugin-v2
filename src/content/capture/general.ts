import type { GeneralPageContent } from '../../types/capture';
import { generateMessageId } from '../../services/data-converter';

/**
 * General Page Capture Module
 * Captures main content from any webpage, stripping HTML tags
 */

export class GeneralPageCapture {
  /**
   * Capture current page content
   */
  async capture(): Promise<GeneralPageContent | null> {
    try {
      const content = this.extractMainContent();
      const title = this.extractTitle();
      const url = window.location.href;

      if (!content || content.trim().length === 0) {
        console.log('[CAPTURE] No content found on page');
        return null;
      }

      // Generate messageId at save time
      const messageId = generateMessageId({
        content,
        timestamp: Date.now()
      });

      const pageContent: GeneralPageContent = {
        id: this.generateId(url),
        url,
        title,
        content,
        capturedAt: Date.now(),
        messageId
      };

      // Send to background script for saving instead of direct storage call
      // Content scripts may not have direct access to chrome.storage.local
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'SAVE_PAGE_CONTENT',
          data: pageContent
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[CAPTURE] Failed to save page content:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            console.log('[CAPTURE] Successfully saved page content:', pageContent.id);
            resolve(pageContent);
          } else if (response?.message) {
            // Duplicate content detected
            console.log('[CAPTURE] Duplicate content:', response.message);
            // Return pageContent with a flag to show message
            (pageContent as any).__duplicateMessage = response.message;
            resolve(pageContent);
          } else {
            console.error('[CAPTURE] Failed to save page content:', response?.error);
            reject(new Error(response?.error || 'Unknown error'));
          }
        });
      });
    } catch (error) {
      console.error('[CAPTURE] Failed to capture page content:', error);
      return null;
    }
  }

  /**
   * Extract main content from page, stripping HTML tags
   */
  private extractMainContent(): string {
    // Try to find main content area
    const mainSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.main-content',
      '.content',
      '#content',
      '#main',
      '.post-content',
      '.entry-content'
    ];

    let mainElement: Element | null = null;

    for (const selector of mainSelectors) {
      mainElement = document.querySelector(selector);
      if (mainElement) break;
    }

    // If no main element found, use body but exclude common non-content elements
    if (!mainElement) {
      mainElement = document.body;
    }

    // Clone to avoid modifying original
    const clone = mainElement.cloneNode(true) as Element;

    // Remove script and style elements
    clone.querySelectorAll('script, style, noscript, iframe, embed, object').forEach(el => el.remove());

    // Remove common non-content elements
    clone.querySelectorAll('nav, header, footer, aside, .sidebar, .navigation, .menu, .advertisement, .ads').forEach(el => el.remove());

    // Extract text content while preserving paragraph structure
    // Use DOM traversal to identify block-level elements and preserve their structure
    const text = this.extractTextWithParagraphs(clone);

    // Clean up whitespace while preserving paragraph structure
    return this.cleanTextPreservingParagraphs(text);
  }

  /**
   * Extract text while preserving paragraph structure
   * Traverses DOM nodes and identifies block-level elements to preserve paragraph breaks
   */
  private extractTextWithParagraphs(element: Element): string {
    // Block-level elements that should have line breaks before and after
    const BLOCK_ELEMENTS = new Set([
      'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'li', 'blockquote', 'pre', 'hr', 'section', 'article',
      'header', 'footer', 'aside', 'nav', 'table', 'tr',
      'ul', 'ol', 'dl', 'dt', 'dd', 'figure', 'figcaption'
    ]);

    function processNode(node: Node): string {
      // Text node: return text content
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        // Normalize whitespace within text (multiple spaces -> single space)
        // But preserve newlines that might be in the text
        return text.replace(/[ \t]+/g, ' ');
      }

      // Not an element node
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      const isBlock = BLOCK_ELEMENTS.has(tagName);

      // Process child nodes
      const children = Array.from(element.childNodes)
        .map(child => processNode(child))
        .join('');

      // Handle special elements
      if (tagName === 'br') {
        return '\n';
      }

      if (tagName === 'hr') {
        return '\n---\n';
      }

      // Block-level elements: add line breaks before and after
      if (isBlock) {
        // For list items, preserve as-is with line breaks (parent ul/ol will handle formatting)
        if (tagName === 'li') {
          const trimmed = children.trim();
          return trimmed ? `\n${trimmed}\n` : '';
        }
        // For other block elements, add line breaks
        const trimmed = children.trim();
        return trimmed ? `\n${trimmed}\n` : '';
      }

      // Inline elements: return children as-is
      return children;
    }

    return processNode(element);
  }

  /**
   * Clean text while preserving paragraph structure
   * - Preserves line breaks between paragraphs
   * - Normalizes whitespace within lines
   * - Removes excessive blank lines
   */
  private cleanTextPreservingParagraphs(text: string): string {
    return text
      // First, normalize line breaks (handle different line break formats)
      .replace(/\r\n/g, '\n')  // Windows line breaks
      .replace(/\r/g, '\n')    // Old Mac line breaks
      // Clean up whitespace within lines (multiple spaces/tabs -> single space)
      .replace(/[ \t]+/g, ' ')  // Multiple spaces or tabs become single space
      // Remove trailing whitespace from each line
      .replace(/[ \t]+$/gm, '')  // Remove trailing spaces/tabs from each line
      // Preserve paragraph breaks (2 newlines), but normalize excessive blank lines
      .replace(/\n{3,}/g, '\n\n')  // 3 or more newlines become 2 (one blank line)
      // Remove leading/trailing whitespace
      .trim();
  }

  /**
   * Extract page title
   */
  private extractTitle(): string {
    // Try various title sources
    const titleElement = document.querySelector('title');
    if (titleElement) {
      const title = titleElement.textContent?.trim();
      if (title && title !== '') return title;
    }

    // Try h1
    const h1 = document.querySelector('h1');
    if (h1) {
      const text = h1.textContent?.trim();
      if (text && text !== '') return text;
    }

    // Try meta og:title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const content = ogTitle.getAttribute('content');
      if (content && content !== '') return content;
    }

    return document.location.hostname;
  }

  /**
   * Generate unique ID from URL
   */
  private generateId(url: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `page_${Math.abs(hash).toString(36)}`;
  }
}

