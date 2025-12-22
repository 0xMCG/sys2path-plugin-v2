import type { GeneralPageContent } from '../../types/capture';

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

      const pageContent: GeneralPageContent = {
        id: this.generateId(url),
        url,
        title,
        content,
        capturedAt: Date.now()
      };

      // Send to background script for saving instead of direct storage call
      // Content scripts may not have direct access to chrome.storage.local
      chrome.runtime.sendMessage({
        type: 'SAVE_PAGE_CONTENT',
        data: pageContent
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[CAPTURE] Failed to save page content:', chrome.runtime.lastError);
        } else if (response?.success) {
          console.log('[CAPTURE] Successfully saved page content:', pageContent.id);
        } else {
          console.error('[CAPTURE] Failed to save page content:', response?.error);
        }
      });
      
      return pageContent;
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

    // Extract text content (automatically strips HTML tags)
    let text = clone.textContent || (clone as HTMLElement).innerText || '';

    // Clean up whitespace
    text = text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();

    return text;
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

