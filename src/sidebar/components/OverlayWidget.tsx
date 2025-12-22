import React from 'react';
import { Save, Check, RefreshCw } from 'lucide-react';
import type { PageStatus } from '../../types';

interface OverlayWidgetProps {
  status: PageStatus;
  onSave: () => void;
  isSidebarOpen: boolean;
}

const OverlayWidget: React.FC<OverlayWidgetProps> = ({ status, onSave, isSidebarOpen }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'saved':
        return {
          bg: 'bg-green-600',
          icon: <Check size={24} className="text-white" />,
          label: 'Saved',
          ring: 'ring-green-400'
        };
      case 'modified':
        return {
          bg: 'bg-amber-500',
          icon: <RefreshCw size={24} className="text-white" />,
          label: 'Changes Detected',
          ring: 'ring-amber-300'
        };
      case 'unsaved':
      default:
        return {
          bg: 'bg-slate-700',
          icon: <Save size={24} className="text-white" />,
          label: 'Save Context',
          ring: 'ring-slate-400'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div 
      className="fixed bottom-6 z-50 flex flex-col items-end gap-2 group transition-all duration-300 ease-in-out"
      style={{ right: isSidebarOpen ? '474px' : '1.5rem' }}
    >
      <div className="bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-1 mb-1 mr-1 pointer-events-none">
        {status === 'modified' ? 'Content changed. Click to update.' : 
         status === 'saved' ? 'Context is up to date.' : 'Capture current conversation'}
      </div>

      <button 
        onClick={onSave}
        className={`${config.bg} bg-opacity-50 hover:bg-opacity-90 backdrop-blur-sm w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ring-4 ring-opacity-20 ${config.ring} hover:ring-opacity-40`}
      >
        <div className={`transition-transform duration-500 ${status === 'modified' ? 'rotate-180' : ''}`}>
           {config.icon}
        </div>
        
        {status === 'modified' && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center">
             <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
          </span>
        )}
      </button>
    </div>
  );
};

export default OverlayWidget;

