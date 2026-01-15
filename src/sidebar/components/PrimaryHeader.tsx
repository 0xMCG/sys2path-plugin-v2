import React, { useCallback } from 'react';
import { Maximize2 } from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';
import { AuthButton } from './AuthButton';
import type { AuthState } from '../../services/auth-service';

interface ChatState {
  messages: any[];
  mvgData: any | null;
  relevantSessions: any[];
  structuredOutput: string | null;
  highlightedNode: string | null;
}

interface PrimaryHeaderProps {
  activeTab: 'chat' | 'data' | 'history';
  onTabChange: (tab: 'chat' | 'data' | 'history') => void;
  onAuthChange: (authState: AuthState) => void;
  getChatState?: () => ChatState | null;
}

export const PrimaryHeader = React.memo<PrimaryHeaderProps>(({ 
  activeTab, 
  onTabChange,
  onAuthChange,
  getChatState
}) => {
  const handleChatClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[WORKBENCH] Chat tab clicked');
    onTabChange('chat');
  }, [onTabChange]);

  const handleDataClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[WORKBENCH] Data tab clicked');
    onTabChange('data');
  }, [onTabChange]);

  const handleHistoryClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[WORKBENCH] History tab clicked');
    onTabChange('history');
  }, [onTabChange]);

  const handleOpenDashboard = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[WORKBENCH] Open dashboard clicked');
    
    // Save chat state before opening dashboard
    if (getChatState) {
      const chatState = getChatState();
      if (chatState) {
        try {
          // Get user ID for storage key isolation
          const userInfoResult = await chrome.storage.local.get('sys2path_user_info');
          const userInfo = userInfoResult.sys2path_user_info;
          const userId = (userInfo && typeof userInfo === 'object' && 'id' in userInfo && userInfo.id) 
            ? userInfo.id as number 
            : null;
          
          const storageKey = userId !== null 
            ? `sys2path_chat_state_user_${userId}` 
            : 'sys2path_chat_state';
          
          await chrome.storage.local.set({ [storageKey]: chatState });
          console.log('[WORKBENCH] Chat state saved to storage:', storageKey);
        } catch (error) {
          console.error('[WORKBENCH] Failed to save chat state:', error);
        }
      }
    }
    
    const url = chrome.runtime.getURL('dashboard.html');
    chrome.tabs.create({ url });
  }, [getChatState]);

  return (
    <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white shrink-0 z-50 relative" style={{ pointerEvents: 'auto' }}>
       <div className="flex items-center gap-4" style={{ pointerEvents: 'auto' }}>
          <div className="flex bg-slate-100 p-1 rounded-lg" style={{ pointerEvents: 'auto' }}>
             <button 
               onClick={handleChatClick}
               type="button"
               style={{ pointerEvents: 'auto' }}
               className={`px-3 py-1 rounded-md text-sm font-medium transition-all cursor-pointer ${activeTab === 'chat' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Chat
             </button>
             <button 
                onClick={handleDataClick}
                type="button"
                style={{ pointerEvents: 'auto' }}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all cursor-pointer ${activeTab === 'data' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Data
             </button>
             <button 
                onClick={handleHistoryClick}
                type="button"
                style={{ pointerEvents: 'auto' }}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all cursor-pointer ${activeTab === 'history' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
             >
                History
             </button>
          </div>
       </div>
       <div className="flex items-center gap-4" style={{ pointerEvents: 'auto' }}>
          <div style={{ pointerEvents: 'none' }}>
            <ConnectionStatus />
          </div>
          <button
            onClick={handleOpenDashboard}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title="Open in fullscreen"
            style={{ pointerEvents: 'auto' }}
          >
            <Maximize2 size={18} />
          </button>
          <div style={{ pointerEvents: 'auto' }}>
            <AuthButton onAuthChange={onAuthChange} />
          </div>
       </div>
    </div>
  );
});

PrimaryHeader.displayName = 'PrimaryHeader';

