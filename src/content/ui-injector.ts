/**
 * UI Injector
 * Injects overlay widget and sidebar toggle button into the page
 */

export type WidgetState = 'idle' | 'loading' | 'success' | 'error';

let overlayWidgetInjected = false;
let currentState: WidgetState = 'idle';

/**
 * Inject overlay widget (FAB button)
 */
export function injectOverlayWidget(onClick: () => void, isSidebarOpen: boolean = false): void {
  if (overlayWidgetInjected) {
    // Update position if sidebar state changed
    const widget = document.getElementById('sys2path-overlay-widget');
    if (widget) {
      widget.style.right = isSidebarOpen ? '474px' : '24px';
    }
    return;
  }

  const widget = document.createElement('div');
  widget.id = 'sys2path-overlay-widget';
  widget.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: ${isSidebarOpen ? '474px' : '24px'};
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
export function updateOverlayWidgetPosition(isSidebarOpen: boolean): void {
  const widget = document.getElementById('sys2path-overlay-widget');
  if (widget) {
    widget.style.right = isSidebarOpen ? '474px' : '24px';
  }
}

/**
 * Inject sidebar toggle button
 */
export function injectToggleButton(onClick: () => void, isSidebarOpen: boolean): void {
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
    right: ${isSidebarOpen ? '450px' : '0px'};
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
export function updateToggleButton(isSidebarOpen: boolean): void {
  const button = document.getElementById('sys2path-toggle-button');
  if (button) {
    button.style.right = isSidebarOpen ? '450px' : '0px';
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
 * Remove all injected UI elements
 */
export function removeInjectedUI(): void {
  const widget = document.getElementById('sys2path-overlay-widget');
  if (widget) widget.remove();
  overlayWidgetInjected = false;

  const button = document.getElementById('sys2path-toggle-button');
  if (button) button.remove();
}

