/**
 * UI Injector
 * Injects overlay widget and sidebar toggle button into the page
 */

import { PlatformDetector } from '../services/platform-detector';
import { exportService } from './export/export-service';
import type { ExportStatus, ExportProgress, ProjectGroup } from './export/types';

export type WidgetState = 'idle' | 'loading' | 'success' | 'error';

let overlayWidgetInjected = false;
let currentState: WidgetState = 'idle';

/**
 * Reset overlay widget injected flag (used when widget is removed)
 */
export function resetOverlayWidgetInjected(): void {
  overlayWidgetInjected = false;
}

/**
 * Inject overlay widget (FAB button)
 */
export function injectOverlayWidget(onClick: () => void, isSidebarOpen: boolean = false, sidebarWidth: number = 450): void {
  // Check if widget actually exists in DOM, if not reset the flag
  const existingWidget = document.getElementById('sys2path-overlay-widget');
  if (!existingWidget && overlayWidgetInjected) {
    overlayWidgetInjected = false;
  }

  if (overlayWidgetInjected && existingWidget) {
    // Update position if sidebar state changed
    existingWidget.style.right = isSidebarOpen ? `${sidebarWidth + 24}px` : '24px';
    // Also update export button position
    updateExportButtonPosition(isSidebarOpen, sidebarWidth);
    return;
  }

  const widget = document.createElement('div');
  widget.id = 'sys2path-overlay-widget';
  widget.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: ${isSidebarOpen ? `${sidebarWidth + 24}px` : '24px'};
    z-index: 999998;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(55, 65, 81, 0.9);
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    border: 4px solid rgba(148, 163, 184, 0.2);
  `;

  widget.addEventListener('mouseenter', () => {
    if (currentState === 'idle') {
      widget.style.transform = 'scale(1.1)';
      widget.style.background = 'rgba(55, 65, 81, 1)';
    }
  });

  widget.addEventListener('mouseleave', () => {
    if (currentState === 'idle') {
      widget.style.transform = 'scale(1)';
      widget.style.background = 'rgba(55, 65, 81, 0.9)';
    }
  });

  widget.addEventListener('click', onClick);

  // Initial save icon
  widget.innerHTML = getIconForState('idle');

  document.body.appendChild(widget);
  overlayWidgetInjected = true;
  currentState = 'idle';
  console.log('[UI] Overlay widget injected');

  // Inject export button if platform supports it
  const platform = PlatformDetector.detectPlatform();
  if (platform === 'chatgpt' || platform === 'claude') {
    injectExportButton(isSidebarOpen, sidebarWidth);
  }
}

/**
 * Get icon SVG for state
 */
function getIconForState(state: WidgetState): string {
  switch (state) {
    case 'loading':
      return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spinning">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.3"></circle>
          <path d="M12 2 A10 10 0 0 1 22 12" stroke-dasharray="31.416" stroke-dashoffset="15.708"></path>
        </svg>
        <style>
          .spinning {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        </style>
      `;
    case 'success':
      return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      `;
    case 'error':
      return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      `;
    case 'idle':
    default:
      return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
      `;
  }
}

/**
 * Update overlay widget state
 */
export function updateOverlayWidgetState(state: WidgetState): void {
  const widget = document.getElementById('sys2path-overlay-widget');
  if (!widget) return;

  currentState = state;

  // Update icon
  widget.innerHTML = getIconForState(state);

  // Update styles based on state
  switch (state) {
    case 'loading':
      widget.style.background = 'rgba(59, 130, 246, 0.9)';
      widget.style.cursor = 'wait';
      widget.style.pointerEvents = 'none';
      break;
    case 'success':
      widget.style.background = 'rgba(34, 197, 94, 0.9)';
      widget.style.cursor = 'default';
      widget.style.pointerEvents = 'none';
      // Reset to idle after 2 seconds
      setTimeout(() => {
        updateOverlayWidgetState('idle');
      }, 2000);
      break;
    case 'error':
      widget.style.background = 'rgba(239, 68, 68, 0.9)';
      widget.style.cursor = 'default';
      widget.style.pointerEvents = 'none';
      // Reset to idle after 3 seconds
      setTimeout(() => {
        updateOverlayWidgetState('idle');
      }, 3000);
      break;
    case 'idle':
    default:
      widget.style.background = 'rgba(55, 65, 81, 0.9)';
      widget.style.cursor = 'pointer';
      widget.style.pointerEvents = 'auto';
      break;
  }
}

/**
 * Update overlay widget position
 */
export function updateOverlayWidgetPosition(isSidebarOpen: boolean, sidebarWidth: number = 450): void {
  const widget = document.getElementById('sys2path-overlay-widget');
  if (widget) {
    widget.style.right = isSidebarOpen ? `${sidebarWidth + 24}px` : '24px';
  }
  updateExportButtonPosition(isSidebarOpen, sidebarWidth);
}

/**
 * Inject sidebar toggle button
 */
export function injectToggleButton(onClick: () => void, isSidebarOpen: boolean, sidebarWidth: number = 450): void {
  // Remove existing button if any
  const existing = document.getElementById('sys2path-toggle-button');
  if (existing) {
    existing.remove();
  }

  const button = document.createElement('button');
  button.id = 'sys2path-toggle-button';
  button.style.cssText = `
    position: fixed;
    top: 50%;
    right: ${isSidebarOpen ? `${sidebarWidth}px` : '0px'};
    transform: translateY(-50%);
    z-index: 999999;
    width: 32px;
    height: 80px;
    background: rgba(37, 99, 235, 0.8);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-right: none;
    border-radius: 8px 0 0 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    padding: 0;
    margin: 0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  `;

  button.addEventListener('mouseenter', () => {
    button.style.background = 'rgba(37, 99, 235, 1)';
    button.style.width = '36px';
  });

  button.addEventListener('mouseleave', () => {
    button.style.background = 'rgba(37, 99, 235, 0.8)';
    button.style.width = '32px';
  });

  button.addEventListener('click', onClick);
  button.title = isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar';

  // Chevron icon SVG
  const chevronIcon = isSidebarOpen
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <polyline points="9 18 15 12 9 6"></polyline>
       </svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <polyline points="15 18 9 12 15 6"></polyline>
       </svg>`;
  button.innerHTML = chevronIcon;

  document.body.appendChild(button);
  console.log('[UI] Toggle button injected');
}

/**
 * Update toggle button position
 */
export function updateToggleButton(isSidebarOpen: boolean, sidebarWidth: number = 450): void {
  const button = document.getElementById('sys2path-toggle-button');
  if (button) {
    button.style.right = isSidebarOpen ? `${sidebarWidth}px` : '0px';
    button.title = isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar';
    
    // Update icon
    const chevronIcon = isSidebarOpen
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <polyline points="9 18 15 12 9 6"></polyline>
         </svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <polyline points="15 18 9 12 15 6"></polyline>
         </svg>`;
    button.innerHTML = chevronIcon;
  }
}

/**
 * Inject export button (for ChatGPT and Claude)
 */
function injectExportButton(isSidebarOpen: boolean = false, sidebarWidth: number = 450): void {
  // Check if already injected
  const existingButton = document.getElementById('sys2path-export-button');
  if (existingButton) {
    updateExportButtonPosition(isSidebarOpen, sidebarWidth);
    return;
  }

  const platform = PlatformDetector.detectPlatform();
  if (platform !== 'chatgpt' && platform !== 'claude') {
    return;
  }

  // Set platform for export service
  exportService.setPlatform(platform);

  // Setup callbacks
  exportService.setStatusCallback((status: ExportStatus, message?: string) => {
    updateExportButtonStatus(status, message);
  });

  exportService.setProgressCallback((progress: ExportProgress) => {
    updateExportButtonProgress(progress);
  });

  const button = document.createElement('div');
  button.id = 'sys2path-export-button';
  button.style.cssText = `
    position: fixed;
    bottom: 96px;
    right: ${isSidebarOpen ? `${sidebarWidth + 24}px` : '24px'};
    z-index: 999997;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9));
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    border: 4px solid rgba(255, 255, 255, 0.2);
    font-size: 12px;
    color: white;
    text-align: center;
    line-height: 1.2;
    overflow: hidden;
  `;

  button.innerHTML = getExportButtonIcon('idle');

  button.addEventListener('mouseenter', () => {
    if (exportService.getStatus() === 'idle') {
      button.style.transform = 'scale(1.1)';
      button.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 1), rgba(37, 99, 235, 1))';
    }
  });

  button.addEventListener('mouseleave', () => {
    if (exportService.getStatus() === 'idle') {
      button.style.transform = 'scale(1)';
      button.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))';
    }
  });

  button.addEventListener('click', async () => {
    if (exportService.getStatus() !== 'idle') {
      return;
    }

    await handleExportClick(platform);
  });

  document.body.appendChild(button);
  console.log('[UI] Export button injected');
}

/**
 * Get export button icon/content
 */
function getExportButtonIcon(status: ExportStatus, progress?: ExportProgress): string {
  switch (status) {
    case 'detecting':
      if (progress && progress.current > 0) {
        const current = progress.current;
        const total = progress.total || 0;
        let displayText = '';
        
        if (total > 0) {
          displayText = `${current}/${total}`;
        } else {
          displayText = `${current}`;
        }
        
        return `
          <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 4px;">
            <div style="font-size: 12px; font-weight: bold; color: white;">${displayText}</div>
          </div>
        `;
      }
      return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spinning">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.3"></circle>
          <path d="M12 2 A10 10 0 0 1 22 12" stroke-dasharray="31.416" stroke-dashoffset="15.708"></path>
        </svg>
        <style>
          .spinning {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        </style>
      `;
    case 'exporting':
    case 'compressing':
      if (progress && progress.total > 0) {
        const percent = Math.round((progress.current / progress.total) * 100);
        
        return `
          <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 4px;">
            <div style="font-size: 14px; font-weight: bold; color: white;">${percent}%</div>
          </div>
        `;
      }
      return getExportButtonIcon('detecting');
    case 'completed':
      return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      `;
    case 'error':
      return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      `;
    case 'idle':
    default:
      return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      `;
  }
}

/**
 * Update export button status
 */
function updateExportButtonStatus(status: ExportStatus, _message?: string): void {
  const button = document.getElementById('sys2path-export-button');
  if (!button) return;

  const progress = exportService.getProgress();
  button.innerHTML = getExportButtonIcon(status, progress);

  // Update styles based on status
  switch (status) {
    case 'detecting':
    case 'exporting':
    case 'compressing':
      button.style.cursor = 'wait';
      button.style.pointerEvents = 'none';
      button.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))';
      break;
    case 'completed':
      button.style.cursor = 'default';
      button.style.pointerEvents = 'none';
      button.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))';
      setTimeout(() => {
        if (exportService.getStatus() === 'completed') {
          updateExportButtonStatus('idle');
        }
      }, 2000);
      break;
    case 'error':
      button.style.cursor = 'default';
      button.style.pointerEvents = 'auto';
      button.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))';
      setTimeout(() => {
        if (exportService.getStatus() === 'error') {
          updateExportButtonStatus('idle');
        }
      }, 3000);
      break;
    case 'idle':
    default:
      button.style.cursor = 'pointer';
      button.style.pointerEvents = 'auto';
      button.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))';
      break;
  }
}

/**
 * Update export button progress
 */
function updateExportButtonProgress(progress: ExportProgress): void {
  const button = document.getElementById('sys2path-export-button');
  if (!button) return;

  const status = exportService.getStatus();
  if (status === 'detecting' || status === 'exporting' || status === 'compressing') {
    button.innerHTML = getExportButtonIcon(status, progress);
  }
}

/**
 * Update export button position
 */
function updateExportButtonPosition(isSidebarOpen: boolean, sidebarWidth: number = 450): void {
  const button = document.getElementById('sys2path-export-button');
  if (button) {
    button.style.right = isSidebarOpen ? `${sidebarWidth + 24}px` : '24px';
  }
}

/**
 * Show project selection dialog
 */
function showProjectSelectionDialog(
  projectGroups: ProjectGroup[],
  totalCount: number
): Promise<string[] | null> {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'sys2path-project-selection-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Detect dark mode
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDarkMode) {
      dialog.style.background = '#1e1e1e';
      dialog.style.color = '#e5e5e5';
    }

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px 24px;
      border-bottom: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    const title = document.createElement('h3');
    title.textContent = '选择要导出的项目';
    title.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600;';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: ${isDarkMode ? '#999' : '#666'};
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.background = 'transparent';
    };
    closeBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };
    
    header.appendChild(title);
    header.appendChild(closeBtn);

    // Summary
    const summary = document.createElement('div');
    summary.style.cssText = `
      padding: 12px 24px;
      border-bottom: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
      font-size: 14px;
      color: ${isDarkMode ? '#999' : '#666'};
    `;
    const summaryText = document.createElement('span');
    summaryText.id = 'sys2path-selection-summary';
    summaryText.textContent = `共 ${totalCount} 个对话`;
    summary.appendChild(summaryText);

    // Controls (Select All / Deselect All)
    const controls = document.createElement('div');
    controls.style.cssText = `
      padding: 12px 24px;
      border-bottom: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
      display: flex;
      gap: 12px;
    `;
    
    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = '全选';
    selectAllBtn.style.cssText = `
      padding: 6px 12px;
      border: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
      background: ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'white'};
      color: ${isDarkMode ? '#e5e5e5' : '#333'};
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    `;
    selectAllBtn.onmouseenter = () => {
      selectAllBtn.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
    };
    selectAllBtn.onmouseleave = () => {
      selectAllBtn.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'white';
    };

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.textContent = '取消全选';
    deselectAllBtn.style.cssText = selectAllBtn.style.cssText;

    // Project list container (scrollable)
    const listContainer = document.createElement('div');
    listContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
      max-height: 400px;
    `;

    // Track selected projects
    const selectedIds = new Set<string>(projectGroups.map(g => g.id));
    
    // Create project items
    const checkboxes: Map<string, HTMLInputElement> = new Map();
    
    projectGroups.forEach(group => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 12px 24px;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: background 0.2s;
      `;
      item.onmouseenter = () => {
        item.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)';
      };
      item.onmouseleave = () => {
        item.style.background = 'transparent';
      };

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `project-${group.id}`;
      checkbox.checked = true;
      checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
      
      checkbox.onchange = () => {
        if (checkbox.checked) {
          selectedIds.add(group.id);
        } else {
          selectedIds.delete(group.id);
        }
        updateSummary();
      };

      checkboxes.set(group.id, checkbox);

      const label = document.createElement('label');
      label.htmlFor = `project-${group.id}`;
      label.style.cssText = `
        flex: 1;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = group.name;
      nameSpan.style.cssText = 'font-weight: 500;';
      
      const countSpan = document.createElement('span');
      countSpan.textContent = `${group.count} 个对话`;
      countSpan.style.cssText = `color: ${isDarkMode ? '#999' : '#666'}; font-size: 14px;`;
      
      label.appendChild(nameSpan);
      label.appendChild(countSpan);

      item.appendChild(checkbox);
      item.appendChild(label);
      listContainer.appendChild(item);

      // Click on item toggles checkbox
      item.onclick = (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      };
    });

    // Update summary function
    function updateSummary() {
      const selectedCount = Array.from(selectedIds).reduce((sum, id) => {
        const group = projectGroups.find(g => g.id === id);
        return sum + (group ? group.count : 0);
      }, 0);
      summaryText.textContent = `共 ${totalCount} 个对话，已选择 ${selectedCount} 个`;
    }

    // Select all / Deselect all handlers
    selectAllBtn.onclick = () => {
      projectGroups.forEach(group => {
        const checkbox = checkboxes.get(group.id);
        if (checkbox) {
          checkbox.checked = true;
          selectedIds.add(group.id);
        }
      });
      updateSummary();
    };

    deselectAllBtn.onclick = () => {
      projectGroups.forEach(group => {
        const checkbox = checkboxes.get(group.id);
        if (checkbox) {
          checkbox.checked = false;
          selectedIds.delete(group.id);
        }
      });
      updateSummary();
    };

    controls.appendChild(selectAllBtn);
    controls.appendChild(deselectAllBtn);

    // Footer with buttons
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 16px 24px;
      border-top: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 8px 16px;
      border: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
      background: ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'white'};
      color: ${isDarkMode ? '#e5e5e5' : '#333'};
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    `;
    cancelBtn.onmouseenter = () => {
      cancelBtn.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
    };
    cancelBtn.onmouseleave = () => {
      cancelBtn.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'white';
    };
    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '确定';
    confirmBtn.style.cssText = `
      padding: 8px 16px;
      border: none;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9));
      color: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    confirmBtn.onmouseenter = () => {
      confirmBtn.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 1), rgba(37, 99, 235, 1))';
    };
    confirmBtn.onmouseleave = () => {
      confirmBtn.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))';
    };
    confirmBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(Array.from(selectedIds));
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    // Assemble dialog
    dialog.appendChild(header);
    dialog.appendChild(summary);
    dialog.appendChild(controls);
    dialog.appendChild(listContainer);
    dialog.appendChild(footer);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Handle ESC key
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', escHandler);
        resolve(null);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Handle click outside (optional - commented out to avoid accidental closes)
    // overlay.onclick = (e) => {
    //   if (e.target === overlay) {
    //     document.body.removeChild(overlay);
    //     document.removeEventListener('keydown', escHandler);
    //     resolve(null);
    //   }
    // };

    updateSummary();
  });
}

/**
 * Handle export button click
 */
async function handleExportClick(_platform: 'chatgpt' | 'claude'): Promise<void> {
  try {
    // Detect conversation count (this will cache the conversations)
    const count = await exportService.detectConversationCount();
    
    if (count === 0) {
      alert('没有找到可导出的对话');
      return;
    }

    // Get cached conversations
    const cachedConvs = exportService.getCachedConversations();
    if (!cachedConvs) {
      alert('无法获取对话列表，请重试');
      return;
    }

    // Get project groups
    const projectGroups = exportService.getProjectGroups(cachedConvs);

    // Show project selection dialog
    const selectedProjectIds = await showProjectSelectionDialog(projectGroups, count);

    if (selectedProjectIds === null) {
      return; // User cancelled
    }

    // If all projects selected, pass undefined (export all)
    const allSelected = selectedProjectIds.length === projectGroups.length;
    const selectedIds = allSelected ? undefined : selectedProjectIds;

    // Start export
    const result = await exportService.exportAll({
      maxCount: 0, // Export all selected conversations
      includeImages: false, // Can be made configurable
      groupByProject: true, // Enable project grouping
      selectedProjectIds: selectedIds
    });

    if (result.success) {
      const message = `成功导出 ${result.exported} 个对话${result.failed > 0 ? `，${result.failed} 个失败` : ''}`;
      console.log('[EXPORT]', message);
    } else {
      alert(`导出失败: ${result.error || '未知错误'}`);
    }
  } catch (error) {
    console.error('[EXPORT] Error:', error);
    alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * Remove all injected UI elements
 */
export function removeInjectedUI(): void {
  const widget = document.getElementById('sys2path-overlay-widget');
  if (widget) widget.remove();
  overlayWidgetInjected = false;

  const button = document.getElementById('sys2path-toggle-button');
  if (button) button.remove();

  const exportButton = document.getElementById('sys2path-export-button');
  if (exportButton) exportButton.remove();
}

