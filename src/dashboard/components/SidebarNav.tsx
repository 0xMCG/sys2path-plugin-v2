import React from 'react';
import { MessageSquare, Database, History } from 'lucide-react';
import { AuthButton } from '../../sidebar/components/AuthButton';
import { ConnectionStatus } from '../../sidebar/components/ConnectionStatus';
import type { AuthState } from '../../services/auth-service';

interface SidebarNavProps {
  activeTab: 'chat' | 'data' | 'history';
  onTabChange: (tab: 'chat' | 'data' | 'history') => void;
  onAuthChange: (authState: AuthState) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onTabChange,
  onAuthChange,
}) => {
  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full">
      {/* Navigation Items */}
      <div className="flex-1 py-4">
        <nav className="space-y-1 px-3">
          <button
            onClick={() => onTabChange('chat')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'chat'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <MessageSquare size={20} />
            <span>Chat</span>
          </button>
          
          <button
            onClick={() => onTabChange('data')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'data'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Database size={20} />
            <span>Data</span>
          </button>
          
          <button
            onClick={() => onTabChange('history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <History size={20} />
            <span>History</span>
          </button>
        </nav>
      </div>
      
      {/* User Info at Bottom */}
      <div className="border-t border-slate-200 p-4 space-y-3">
        <AuthButtonWrapper onAuthChange={onAuthChange} />
        <div className="pt-2 border-t border-slate-100">
          <ConnectionStatus />
        </div>
      </div>
    </div>
  );
};

// Sidebar-specific AuthButton wrapper that adjusts menu positioning
const AuthButtonWrapper: React.FC<{ onAuthChange: (authState: AuthState) => void }> = ({ onAuthChange }) => {
  return (
    <div className="relative">
      <AuthButton onAuthChange={onAuthChange} />
      <style>{`
        .relative > div > div[class*="absolute"] {
          right: auto !important;
          left: 0 !important;
          bottom: 100% !important;
          top: auto !important;
          margin-bottom: 0.5rem !important;
          margin-top: 0 !important;
        }
      `}</style>
    </div>
  );
};
