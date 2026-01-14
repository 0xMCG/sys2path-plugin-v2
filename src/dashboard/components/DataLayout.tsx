import React, { useState, useRef, useCallback } from 'react';
import GraphView from '../../sidebar/components/GraphView';
import { ResizableDivider } from './ResizableDivider';
import type { DataSource } from '../../types';
import type { MVGResponse } from '../../types/api';
import { 
  Globe, FileText, Search, ArrowUp, ArrowDown, 
  Cloud, Power, PowerOff, Eye, Trash2, Upload,
  Loader2, CheckCircle2, XCircle
} from 'lucide-react';
import type { ChatLLMPlatform } from '../../types/capture';

interface DataLayoutProps {
  dataSources: DataSource[];
  dataFilter: 'all' | 'web' | 'upload';
  platformFilter: ChatLLMPlatform | 'general' | 'demo' | 'all';
  searchQuery: string;
  sortOrder: 'asc' | 'desc';
  selectedDataIds: Set<string>;
  activatedDataIds: Set<string>;
  activatedSourcesCKG: MVGResponse | null;
  loadingActivatedCKG: boolean;
  activatedCKGError: string | null;
  highlightedNode: string | null;
  uploadStatuses: Map<string, {
    status: 'idle' | 'uploading' | 'success' | 'failed';
    progress?: number;
    error?: string;
  }>;
  previewDataId: string | null;
  onDataFilterChange: (filter: 'all' | 'web' | 'upload') => void;
  onPlatformFilterChange: (filter: ChatLLMPlatform | 'general' | 'demo' | 'all') => void;
  onSearchQueryChange: (query: string) => void;
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  onDataSelectionToggle: (id: string) => void;
  onToggleActivation: (id: string) => void;
  onUploadClick: (id: string) => void;
  onPreviewClick: (id: string) => void;
  onDeleteClick: (id: string) => void;
  onGraphNodeClick: (nodeId: string) => void;
}

export const DataLayout: React.FC<DataLayoutProps> = ({
  dataSources,
  dataFilter,
  platformFilter,
  searchQuery,
  sortOrder,
  selectedDataIds,
  activatedDataIds,
  activatedSourcesCKG,
  loadingActivatedCKG,
  activatedCKGError,
  highlightedNode,
  uploadStatuses,
  onDataFilterChange,
  onPlatformFilterChange,
  onSearchQueryChange,
  onSortOrderChange,
  onDataSelectionToggle,
  onToggleActivation,
  onUploadClick,
  onPreviewClick,
  onDeleteClick,
  onGraphNodeClick,
}) => {
  // Helper functions
  const getPlatformDisplayName = (platform?: ChatLLMPlatform | 'general' | 'demo'): string => {
    if (!platform) return 'Unknown';
    const names: Record<ChatLLMPlatform | 'general' | 'demo', string> = {
      chatgpt: 'ChatGPT',
      claude: 'Claude',
      gemini: 'Gemini',
      notebooklm: 'NotebookLM',
      aistudio: 'AI Studio',
      grok: 'Grok',
      general: 'General',
      demo: 'Demo'
    };
    return names[platform] || platform;
  };
  
  const getPlatformBadgeColor = (platform?: ChatLLMPlatform | 'general' | 'demo'): string => {
    if (!platform) return 'bg-slate-100 text-slate-600';
    const colors: Record<ChatLLMPlatform | 'general' | 'demo', string> = {
      chatgpt: 'bg-green-100 text-green-700',
      claude: 'bg-orange-100 text-orange-700',
      gemini: 'bg-blue-100 text-blue-700',
      notebooklm: 'bg-purple-100 text-purple-700',
      aistudio: 'bg-indigo-100 text-indigo-700',
      grok: 'bg-black text-white',
      general: 'bg-gray-100 text-gray-700',
      demo: 'bg-yellow-100 text-yellow-700'
    };
    return colors[platform] || 'bg-slate-100 text-slate-600';
  };

  // Filter and sort
  const filteredAndSorted = React.useMemo(() => {
    const filtered = dataSources.filter(ds => {
      if (dataFilter !== 'all' && ds.type !== dataFilter) return false;
      if (platformFilter !== 'all' && ds.platform !== platformFilter) return false;
      if (searchQuery && !ds.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
    
    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.lastSaved).getTime();
      const bTime = new Date(b.lastSaved).getTime();
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
    });
  }, [dataSources, dataFilter, platformFilter, searchQuery, sortOrder]);

  // Resizable state
  const [graphWidth, setGraphWidth] = useState(60); // Percentage
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle resize
  const handleResize = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const deltaPercent = (delta / containerWidth) * 100;
    setGraphWidth(prev => {
      const newWidth = prev + deltaPercent;
      return Math.min(Math.max(newWidth, 30), 85);
    });
  }, []);

  return (
    <div ref={containerRef} className="flex h-full">
      {/* Middle: Activated Graph */}
      <div 
        className="p-4 overflow-hidden"
        style={{ width: `${graphWidth}%` }}
      >
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm h-full overflow-hidden">
          {loadingActivatedCKG ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading activated sources graph...
            </div>
          ) : activatedSourcesCKG ? (
            <GraphView
              mvgData={activatedSourcesCKG}
              activeNodeId={highlightedNode}
              onNodeClick={onGraphNodeClick}
            />
          ) : activatedDataIds.size > 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm p-4">
              <div className="mb-2">No graph data available for activated sources.</div>
              {activatedCKGError && (
                <div className="text-xs text-red-500 mb-2 bg-red-50 px-3 py-2 rounded border border-red-200">
                  Error: {activatedCKGError}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              No activated sources. Activate data sources to view their graph.
            </div>
          )}
        </div>
      </div>
      
      {/* Resizable Divider */}
      <ResizableDivider direction="vertical" onResize={handleResize} />
      
      {/* Right: Data Sources List */}
      <div 
        className="border-l border-slate-200 bg-white flex flex-col overflow-hidden"
        style={{ width: `${100 - graphWidth}%` }}
      >
        {/* Filter Bar */}
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => onDataFilterChange('all')} className={`text-xs px-2 py-1 rounded ${dataFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>All</button>
              <button onClick={() => onDataFilterChange('web')} className={`text-xs px-2 py-1 rounded ${dataFilter === 'web' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Web</button>
              <button onClick={() => onDataFilterChange('upload')} className={`text-xs px-2 py-1 rounded ${dataFilter === 'upload' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Files</button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  className="text-xs pl-7 pr-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-indigo-500 w-32"
                />
              </div>
              <button
                onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
              >
                {sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-slate-500 mr-1">Platform:</span>
            <button 
              onClick={() => onPlatformFilterChange('all')} 
              className={`text-[10px] px-2 py-0.5 rounded ${platformFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              All
            </button>
            {(['chatgpt', 'claude', 'gemini', 'notebooklm', 'aistudio', 'grok', 'general', 'demo'] as const).map(platform => (
              <button
                key={platform}
                onClick={() => onPlatformFilterChange(platform)}
                className={`text-[10px] px-2 py-0.5 rounded ${
                  platformFilter === platform 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {getPlatformDisplayName(platform)}
              </button>
            ))}
          </div>
        </div>

        {/* Data Sources List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Data Sources</h3>
            <span className="text-xs text-slate-500">{filteredAndSorted.length} items</span>
          </div>
          <div className="space-y-3">
            {filteredAndSorted.map(ds => {
              const isActivated = activatedDataIds.has(ds.id);
              return (
                <div 
                  key={ds.id}
                  className={`bg-white border rounded-lg shadow-sm p-3 group transition-all ${
                    isActivated
                      ? 'border-2 border-green-400 bg-gradient-to-r from-green-50/50 to-transparent'
                      : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <input 
                      type="checkbox" 
                      checked={selectedDataIds.has(ds.id)}
                      onChange={() => onDataSelectionToggle(ds.id)}
                      className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="p-1 bg-slate-100 rounded text-slate-500 shrink-0">
                            {ds.type === 'web' ? <Globe size={12} /> : <FileText size={12} />}
                          </span>
                          <div className="text-sm font-semibold text-slate-800 truncate" title={ds.title}>{ds.title}</div>
                        </div>
                        {!ds.isUploaded ? (
                          <div className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 bg-blue-100 text-blue-700">
                            LOCAL
                          </div>
                        ) : (
                          <div className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 bg-green-100 text-green-700">
                            SYNCED
                          </div>
                        )}
                      </div>
                      <div className="ml-6 mt-1 flex items-center gap-2 flex-wrap">
                        {ds.platform && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${getPlatformBadgeColor(ds.platform)}`}>
                            {getPlatformDisplayName(ds.platform)}
                          </span>
                        )}
                        <div className="text-[10px] text-slate-400 truncate">{ds.url}</div>
                      </div>
                      <div className="ml-6 mt-1 text-[10px] text-slate-500">
                        Saved: {ds.lastSaved}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end mt-3 pt-2 border-t border-slate-50 pl-7">
                    <div className="flex items-center gap-1">
                      {uploadStatuses.get(ds.id)?.status === 'uploading' && (
                        <div className="flex items-center gap-1 px-1">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          <span className="text-xs text-blue-600">
                            {uploadStatuses.get(ds.id)?.progress || 0}%
                          </span>
                        </div>
                      )}
                      {uploadStatuses.get(ds.id)?.status === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                      {uploadStatuses.get(ds.id)?.status === 'failed' && (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      {(!uploadStatuses.get(ds.id) || uploadStatuses.get(ds.id)?.status === 'idle') && (
                        <button 
                          onClick={() => onUploadClick(ds.id)}
                          disabled={ds.isUploaded}
                          className={`p-1 rounded transition-colors ${ds.isUploaded ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'}`}
                          title="Upload to Server"
                        >
                          <Cloud size={14} />
                        </button>
                      )}
                      {ds.isUploaded && (
                        <button 
                          onClick={() => onToggleActivation(ds.id)}
                          className={`p-1 rounded transition-colors ${
                            isActivated 
                              ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                              : 'text-slate-500 hover:bg-slate-100 hover:text-green-600'
                          }`}
                          title={isActivated ? "Deactivate" : "Activate for CKG filtering"}
                        >
                          {isActivated ? <Power size={14} className="fill-current" /> : <PowerOff size={14} />}
                        </button>
                      )}
                      <button 
                        onClick={() => onPreviewClick(ds.id)}
                        className="p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 rounded transition-colors"
                        title="Preview Content"
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        onClick={() => onDeleteClick(ds.id)}
                        className="p-1 text-red-600 hover:bg-red-50 hover:text-red-700 rounded transition-colors"
                        title="Delete All Versions"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            <button className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-semibold hover:border-slate-300 hover:text-slate-500 flex items-center justify-center gap-2">
              <Upload size={14} /> Add Source
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
