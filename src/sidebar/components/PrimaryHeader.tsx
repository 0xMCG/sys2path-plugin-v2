import React, { useCallback } from 'react';
import { ConnectionStatus } from './ConnectionStatus';
import { AuthButton } from './AuthButton';
import type { AuthState } from '../../services/auth-service';

interface PrimaryHeaderProps {
  activeTab: 'chat' | 'data' | 'history';
  onTabChange: (tab: 'chat' | 'data' | 'history') => void;
  onAuthChange: (authState: AuthState) => void;
}

export const PrimaryHeader = React.memo<PrimaryHeaderProps>(({ 
  activeTab, 
  onTabChange,
  onAuthChange
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
          <div style={{ pointerEvents: 'auto' }}>
            <AuthButton onAuthChange={onAuthChange} />
          </div>
       </div>
    </div>
  );
});

PrimaryHeader.displayName = 'PrimaryHeader';

