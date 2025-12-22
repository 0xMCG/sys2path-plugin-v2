import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Network, Database, History, 
  Send, Minimize2, X,
  Trash2, FileText, Globe, Upload, ChevronDown, PlayCircle,
  Eye, Cloud, Copy, Tag, Search, ArrowUp, ArrowDown
} from 'lucide-react';
import { motivations, mockProjects, generateMockResponse, mockEntities, mockGraphData, mockDataSources, mockHistory } from '../../services/mockData';
import { loadDataSources } from '../../services/data-loader';
import { StorageService } from '../../services/storage';
import type { Message, Entity, ViewMode, DataSource } from '../../types';
import type { ChatLLMConversation, GeneralPageContent, ChatLLMPlatform } from '../../types/capture';
import GraphView from './GraphView';

interface WorkbenchProps {
  mode: ViewMode;
}

export const Workbench: React.FC<WorkbenchProps> = () => {
  // --- Layout State ---
  const [secondaryHeight, setSecondaryHeight] = useState(0); // Default: collapsed 
  const [activeSecondaryTab, setActiveSecondaryTab] = useState<'mvg' | 'data' | 'history'>('mvg');
  const [activePrimaryTab, setActivePrimaryTab] = useState<'chat' | 'data'>('chat');
  
  // --- Data State ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Smart Data & Graph
  const [activeEntity, setActiveEntity] = useState<Entity | null>(null);
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  
  // Data Sources - load from storage
  const [dataSources, setDataSources] = useState<DataSource[]>(mockDataSources);
  const [dataFilter, setDataFilter] = useState<'all' | 'web' | 'upload'>('all');
  const [platformFilter, setPlatformFilter] = useState<ChatLLMPlatform | 'general' | 'demo' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedDataIds, setSelectedDataIds] = useState<Set<string>>(new Set());
  const [previewDataId, setPreviewDataId] = useState<string | null>(null);
  const [highlightedDataId, setHighlightedDataId] = useState<string | null>(null);
  const [selectedVersionIds, setSelectedVersionIds] = useState<Map<string, string>>(new Map()); // Map<baseId, versionId>
  const [editingTagVersionId, setEditingTagVersionId] = useState<string | null>(null);
  const [tagInputValue, setTagInputValue] = useState('');
  
  // Preview content state
  const [previewContent, setPreviewContent] = useState<ChatLLMConversation | GeneralPageContent | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Smart Data Selection
  const [selectedSmartIds, setSelectedSmartIds] = useState<Set<string>>(new Set());

  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  // --- Effects ---
  useEffect(() => {
    // Load data sources from storage on mount
    loadDataSources()
      .then(sources => {
        console.log('[WORKBENCH] Loaded real data sources:', sources.length);
        // Merge with mock data (for demo purposes)
        // Use a Set to avoid duplicates based on ID
        const sourceMap = new Map<string, DataSource>();
        
        // Add mock data first
        mockDataSources.forEach(mock => {
          sourceMap.set(mock.id, mock);
        });
        
        // Add real data (will override mock data if same ID)
        sources.forEach(source => {
          sourceMap.set(source.id, source);
        });
        
        const allSources = Array.from(sourceMap.values());
        setDataSources(allSources);
        console.log('[WORKBENCH] Total data sources (mock + real):', allSources.length);
      })
      .catch(error => {
        console.error('[WORKBENCH] Failed to load data sources:', error);
        // Fallback to mock data if loading fails
        setDataSources(mockDataSources);
      });

    // Listen for data capture events
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'DATA_CAPTURED') {
        console.log('[WORKBENCH] Data captured, refreshing...');
        loadDataSources()
          .then(sources => {
            console.log('[WORKBENCH] Refreshed real data sources:', sources.length);
            // Merge with mock data
            const sourceMap = new Map<string, DataSource>();
            
            mockDataSources.forEach(mock => {
              sourceMap.set(mock.id, mock);
            });
            
            sources.forEach(source => {
              sourceMap.set(source.id, source);
            });
            
            const allSources = Array.from(sourceMap.values());
            setDataSources(allSources);
            
            // Switch to Data tab and highlight new item
            setActivePrimaryTab('data');
            if (event.data.data && event.data.data.id) {
              // Extract base ID from versioned ID if needed
              const capturedId = event.data.data.id;
              const baseId = capturedId.split('-').slice(0, -1).join('-') || capturedId;
              setHighlightedDataId(baseId);
            }
          })
          .catch(error => {
            console.error('[WORKBENCH] Failed to refresh data sources:', error);
            // Keep existing data on refresh failure
          });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    // Auto-scroll to highlighted data source if active
    if (activePrimaryTab === 'data' && highlightedDataId) {
       const el = document.getElementById(`ds-${highlightedDataId}`);
       if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
       // Clear highlight after animation
       setTimeout(() => setHighlightedDataId(null), 2000);
    }
  }, [activePrimaryTab, highlightedDataId]);

  // Load preview content when previewDataId changes
  useEffect(() => {
    if (!previewDataId) {
      setPreviewContent(null);
      setPreviewError(null);
      return;
    }

    const loadPreviewContent = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      
      try {
        const dataSource = dataSources.find(d => d.id === previewDataId);
        if (!dataSource) {
          setPreviewError('Data source not found');
          setPreviewLoading(false);
          return;
        }

        // Try to load conversation first
        const conversation = await StorageService.getConversation(dataSource.currentVersionId);
        if (conversation) {
          setPreviewContent(conversation);
          setPreviewLoading(false);
          return;
        }

        // Try to load page content
        const pageContent = await StorageService.getPageContent(dataSource.currentVersionId);
        if (pageContent) {
          setPreviewContent(pageContent);
          setPreviewLoading(false);
          return;
        }

        // If not found by currentVersionId, try to find by base ID
        // This handles cases where the version ID format might be different
        const allConversations = await StorageService.getAllConversations();
        const matchingConv = allConversations.find(c => {
          const baseId = c.id.split('-').slice(0, -1).join('-') || c.id;
          return baseId === dataSource.id || c.id === dataSource.currentVersionId;
        });
        
        if (matchingConv) {
          setPreviewContent(matchingConv);
          setPreviewLoading(false);
          return;
        }

        const allPageContents = await StorageService.getAllPageContents();
        const matchingPage = allPageContents.find(p => {
          const baseId = p.id.split('-').slice(0, -1).join('-') || p.id;
          return baseId === dataSource.id || p.id === dataSource.currentVersionId;
        });

        if (matchingPage) {
          setPreviewContent(matchingPage);
          setPreviewLoading(false);
          return;
        }

        setPreviewError('Content not found in storage');
        setPreviewLoading(false);
      } catch (error) {
        console.error('[WORKBENCH] Failed to load preview content:', error);
        setPreviewError(error instanceof Error ? error.message : 'Failed to load content');
        setPreviewLoading(false);
      }
    };

    loadPreviewContent();
  }, [previewDataId, dataSources]);

  // Cross-page data synchronization
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes['sys2path_conversations'] || changes['sys2path_page_contents']) {
        console.log('[WORKBENCH] Storage changed, refreshing data sources...');
        loadDataSources()
          .then(sources => {
            console.log('[WORKBENCH] Refreshed data sources from storage change:', sources.length);
            // Merge with mock data
            const sourceMap = new Map<string, DataSource>();
            
            mockDataSources.forEach(mock => {
              sourceMap.set(mock.id, mock);
            });
            
            sources.forEach(source => {
              sourceMap.set(source.id, source);
            });
            
            const allSources = Array.from(sourceMap.values());
            setDataSources(allSources);
          })
          .catch(error => {
            console.error('[WORKBENCH] Failed to refresh data sources from storage change:', error);
          });
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // --- Handlers ---

  const handleResizeStart = () => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const availableHeight = containerRect.height;
    // Calculate height from bottom
    const newHeightPx = containerRect.bottom - e.clientY;
    const newHeightPercent = (newHeightPx / availableHeight) * 100;
    // Ensure minimum is 48px (tab bar only) and maximum is 90%
    const minPercent = (48 / availableHeight) * 100;
    const clampedHeight = Math.min(Math.max(newHeightPercent, minPercent), 90);
    setSecondaryHeight(clampedHeight);
  }, []);

  const handleResizeEnd = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  const switchSecondaryTab = (tab: 'mvg' | 'data' | 'history') => {
      if (secondaryHeight <= 0) setSecondaryHeight(50);
      setActiveSecondaryTab(tab);
  };

  // Chat Logic
  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setTimeout(() => {
      const aiMsg = generateMockResponse(text);
      setMessages(prev => [...prev, aiMsg]);
    }, 800);
  };

  const restoreHistory = (item: typeof mockHistory[0]) => {
     setActivePrimaryTab('chat');
     setMessages([
        { id: 'h-user-1', role: 'user', content: `Restore context: ${item.summary}`, timestamp: Date.now() },
        { id: 'h-ai-1', role: 'ai', content: `Context restored from ${item.timestamp}. ${item.preview}`, timestamp: Date.now() }
     ]);
  };

  // Navigations
  const handleChatEntityLinkClick = (entityName: string) => {
    const entity = mockEntities[entityName];
    if (entity) {
        setActiveEntity(entity);
        switchSecondaryTab('data'); 
    }
  };

  const handleGraphNodeClick = (nodeId: string) => {
     setHighlightedNode(nodeId);
     const entity = mockEntities[nodeId];
     if (entity) setActiveEntity(entity);
  };

  // Smart Data -> Data Tab Nav
  const handleSmartSourceClick = (dsId: string) => {
      setActivePrimaryTab('data');
      setHighlightedDataId(dsId);
  };

  // Selection Helpers
  const toggleDataSelection = (id: string) => {
      const newSet = new Set(selectedDataIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedDataIds(newSet);
  };

  // Refresh data sources from storage
  const refreshDataSources = async () => {
    try {
      const sources = await loadDataSources();
      // Merge with mock data (for demo purposes)
      const sourceMap = new Map<string, DataSource>();
      
      // Add mock data first
      mockDataSources.forEach(mock => {
        sourceMap.set(mock.id, mock);
      });
      
      // Add real data (will override mock data if same ID)
      sources.forEach(source => {
        sourceMap.set(source.id, source);
      });
      
      const allSources = Array.from(sourceMap.values());
      setDataSources(allSources);
    } catch (error) {
      console.error('[WORKBENCH] Failed to refresh data sources:', error);
    }
  };

  // Delete single data source
  const handleDeleteDataSource = async (baseId: string) => {
    const dataSource = dataSources.find(ds => ds.id === baseId);
    const title = dataSource?.title || 'this data source';
    
    if (!confirm(`确定要删除 "${title}" 吗？此操作将删除该数据源的所有版本。`)) {
      return;
    }
    
    try {
      await StorageService.deleteDataSources([baseId]);
      await refreshDataSources();
      setSelectedDataIds(new Set());
      // Clear preview if the deleted item was being previewed
      if (previewDataId === baseId) {
        setPreviewDataId(null);
        setPreviewContent(null);
      }
    } catch (error) {
      console.error('[WORKBENCH] Failed to delete data source:', error);
      alert('删除失败，请重试');
    }
  };

  // Batch delete selected data sources
  const handleBatchDelete = async () => {
    const count = selectedDataIds.size;
    if (count === 0) return;
    
    if (!confirm(`确定要删除 ${count} 个数据源吗？此操作将删除这些数据源的所有版本。`)) {
      return;
    }
    
    try {
      await StorageService.deleteDataSources(Array.from(selectedDataIds));
      await refreshDataSources();
      setSelectedDataIds(new Set());
      // Clear preview if any deleted item was being previewed
      if (previewDataId && selectedDataIds.has(previewDataId)) {
        setPreviewDataId(null);
        setPreviewContent(null);
      }
    } catch (error) {
      console.error('[WORKBENCH] Failed to batch delete data sources:', error);
      alert('批量删除失败，请重试');
    }
  };

  // Delete single version
  const handleDeleteVersion = async (versionId: string, baseId: string) => {
    const dataSource = dataSources.find(ds => ds.id === baseId);
    const version = dataSource?.versions.find(v => v.id === versionId);
    const versionInfo = version ? `版本 ${version.timestamp}` : '此版本';
    
    if (!confirm(`确定要删除 ${versionInfo} 吗？`)) {
      return;
    }
    
    try {
      // Try to delete as conversation version first
      await StorageService.deleteConversationVersion(versionId);
      // Also try to delete as page content version (in case it's a page content)
      await StorageService.deletePageContentVersion(versionId);
      
      await refreshDataSources();
      
      // Clear preview if the deleted version was being previewed
      if (previewDataId === baseId) {
        setPreviewDataId(null);
        setPreviewContent(null);
      }
      
      // Clear selected version if it was deleted
      const newMap = new Map(selectedVersionIds);
      if (newMap.get(baseId) === versionId) {
        newMap.delete(baseId);
        setSelectedVersionIds(newMap);
      }
    } catch (error) {
      console.error('[WORKBENCH] Failed to delete version:', error);
      alert('删除版本失败，请重试');
    }
  };

  // Handle tag button click
  const handleTagButtonClick = (versionId: string, currentTag?: string) => {
    setEditingTagVersionId(versionId);
    setTagInputValue(currentTag || '');
  };

  // Handle tag save
  const handleTagSave = async (versionId: string, _baseId: string) => {
    try {
      await StorageService.updateVersionTag(versionId, tagInputValue.trim());
      await refreshDataSources();
      setEditingTagVersionId(null);
      setTagInputValue('');
    } catch (error) {
      console.error('[WORKBENCH] Failed to save tag:', error);
      alert('保存标签失败，请重试');
    }
  };

  // Handle tag cancel
  const handleTagCancel = () => {
    setEditingTagVersionId(null);
    setTagInputValue('');
  };

  const toggleSmartSelection = (id: string) => {
      const newSet = new Set(selectedSmartIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedSmartIds(newSet);
  };

  const copySmartSelection = () => {
      const count = selectedSmartIds.size;
      alert(`Copied ${count} items to clipboard!`);
      setSelectedSmartIds(new Set());
  };

  // Render conversation preview
  const renderConversationPreview = (conversation: ChatLLMConversation) => {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-blue-700 uppercase">Platform:</span>
            <span className="text-sm font-semibold text-blue-900">{conversation.platform}</span>
          </div>
          <div className="text-xs text-blue-600">
            <div>Messages: {conversation.messages.length}</div>
            <div>Captured: {new Date(conversation.capturedAt).toLocaleString()}</div>
          </div>
        </div>

        <div className="space-y-3">
          {conversation.messages.map((message, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${
                message.role === 'user'
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-indigo-50 border-indigo-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    message.role === 'user'
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-indigo-200 text-indigo-700'
                  }`}
                >
                  {message.role === 'user' ? '👤 User' : '🤖 Assistant'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {new Date(message.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                {message.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render page content preview
  const renderPageContentPreview = (content: GeneralPageContent) => {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-xs text-green-600">
            <div>Type: General Page Content</div>
            <div>Characters: {content.content.length.toLocaleString()}</div>
            <div>Captured: {new Date(content.capturedAt).toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
            {content.content}
          </div>
        </div>
      </div>
    );
  };

  // Render preview content based on type
  const renderPreviewContent = () => {
    if (previewLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
            <p className="text-sm text-slate-500">Loading content...</p>
          </div>
        </div>
      );
    }

    if (previewError) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-sm text-red-600 mb-2">Error loading content</p>
            <p className="text-xs text-slate-500">{previewError}</p>
          </div>
        </div>
      );
    }

    if (!previewContent) {
      return (
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-slate-500">Content not found</p>
        </div>
      );
    }

    // Check if it's a conversation (has messages property) or page content
    if ('messages' in previewContent) {
      return renderConversationPreview(previewContent);
    } else {
      return renderPageContentPreview(previewContent);
    }
  };

  // --- Sub-Components ---

  const PrimaryHeader = () => (
    <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white shrink-0">
       <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
             <button 
               onClick={() => setActivePrimaryTab('chat')}
               className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${activePrimaryTab === 'chat' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Chat
             </button>
             <button 
                onClick={() => setActivePrimaryTab('data')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${activePrimaryTab === 'data' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Data
             </button>
          </div>
          {activePrimaryTab === 'data' && (
              <select className="text-xs border-none bg-transparent font-medium text-slate-600 focus:ring-0 cursor-pointer">
                  {mockProjects.map(p => <option key={p.id}>{p.name}</option>)}
              </select>
          )}
       </div>
       <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs cursor-pointer hover:ring-2 hover:ring-indigo-500 ring-offset-2">
              AD
          </div>
       </div>
    </div>
  );

  const ChatView = () => {
    const isHeroMode = messages.length === 0;
    return (
        <div className="flex flex-col h-full relative">
            {isHeroMode ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mb-6 shadow-xl rotate-3">
                        <Network className="text-white w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-6">How can CKG help you today?</h2>
                    
                    <div className="w-full max-w-lg mb-8 relative">
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage(inputText)}
                            placeholder="Ask about context..."
                            className="w-full pl-5 pr-12 py-4 rounded-full border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-lg transition-all"
                            autoFocus
                        />
                         <button onClick={() => sendMessage(inputText)} className="absolute right-2 top-2 bottom-2 aspect-square bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors">
                            <Send size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                        {motivations.slice(0, 4).map(m => (
                            <button key={m.id} onClick={() => sendMessage(m.prompt)} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all text-left">
                                <span className="text-xl">{m.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-slate-700 truncate">{m.label}</div>
                                    <div className="text-xs text-slate-400 truncate">{m.description}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'ai' && (
                                    <div className="w-8 h-8 rounded-full bg-slate-900 flex-shrink-0 flex items-center justify-center mt-1 shadow-sm"><Network size={14} className="text-white" /></div>
                                )}
                                <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}`}>
                                    {msg.content.split(/(\[.*?\])/g).map((part, idx) => {
                                        if (part.startsWith('[') && part.endsWith(']')) {
                                            const name = part.slice(1, -1);
                                            return (
                                                <button key={idx} onClick={() => handleChatEntityLinkClick(name)} className={`mx-1 px-1.5 py-0.5 rounded text-sm font-medium transition-colors inline-flex items-center ${msg.role === 'user' ? 'bg-blue-500 text-white hover:bg-blue-400' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}>
                                                    {name}
                                                </button>
                                            );
                                        }
                                        return <span key={idx}>{part}</span>;
                                    })}
                                </div>
                            </div>
                        ))}
                        <div className="h-4"></div>
                    </div>
                    <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                        <div className="relative">
                            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage(inputText)} placeholder="Reply..." className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"/>
                            <button onClick={() => sendMessage(inputText)} className="absolute right-2 top-2 p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"><Send size={16} /></button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
  };

  const DataView = () => {
    // Filter and sort data sources
    // Note: All dependencies are React state variables, so they should be included
    const filteredAndSorted = React.useMemo(() => {
      const filtered = dataSources.filter(ds => {
        // Type filter
        if (dataFilter !== 'all' && ds.type !== dataFilter) return false;
        // Platform filter
        if (platformFilter !== 'all' && ds.platform !== platformFilter) return false;
        // Text search
        if (searchQuery && !ds.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      });
      
      // Sort by lastSaved time (create a new array to avoid mutating the filtered array)
      return [...filtered].sort((a, b) => {
        const aTime = new Date(a.lastSaved).getTime();
        const bTime = new Date(b.lastSaved).getTime();
        return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataSources, dataFilter, platformFilter, searchQuery, sortOrder]);
    
    const hasSelection = selectedDataIds.size > 0;
    
    // Helper function to get platform display name
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
    
    // Helper function to get platform badge color
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

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            {/* Filter Bar */}
            <div className="flex flex-col gap-2 px-4 py-3 bg-white border-b border-slate-200">
                {/* Top row: Type filters and search */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setDataFilter('all')} className={`text-xs px-2 py-1 rounded ${dataFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>All</button>
                        <button onClick={() => setDataFilter('web')} className={`text-xs px-2 py-1 rounded ${dataFilter === 'web' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Web</button>
                        <button onClick={() => setDataFilter('upload')} className={`text-xs px-2 py-1 rounded ${dataFilter === 'upload' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Files</button>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Search input */}
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="text-xs pl-7 pr-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-indigo-500 w-32"
                            />
                        </div>
                        {/* Sort button */}
                        <button
                            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                            title={`Sort ${sortOrder === 'desc' ? 'Ascending' : 'Descending'}`}
                        >
                            {sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                        </button>
                    </div>
                </div>
                
                {/* Bottom row: Platform filters */}
                <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-slate-500 mr-1">Platform:</span>
                    <button 
                        onClick={() => setPlatformFilter('all')} 
                        className={`text-[10px] px-2 py-0.5 rounded ${platformFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        All
                    </button>
                    {(['chatgpt', 'claude', 'gemini', 'notebooklm', 'aistudio', 'grok', 'general', 'demo'] as const).map(platform => (
                        <button
                            key={platform}
                            onClick={() => setPlatformFilter(platform)}
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

            <div className="flex-1 overflow-y-auto p-4 pb-20">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Data Sources</h3>
                    <span className="text-xs text-slate-500">{filteredAndSorted.length} items</span>
                </div>
                <div className="space-y-3">
                    {filteredAndSorted.map(ds => (
                        <div 
                          key={ds.id} 
                          id={`ds-${ds.id}`}
                          className={`bg-white border rounded-lg shadow-sm p-3 group transition-all duration-500 ${highlightedDataId === ds.id ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200 hover:border-indigo-300'}`}
                        >
                            <div className="flex items-start gap-3 mb-2">
                                <input 
                                  type="checkbox" 
                                  checked={selectedDataIds.has(ds.id)}
                                  onChange={() => toggleDataSelection(ds.id)}
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
                                         {(() => {
                                           const currentVersionId = selectedVersionIds.get(ds.id) || ds.currentVersionId;
                                           const currentVersion = ds.versions.find(v => v.id === currentVersionId);
                                           const versionStatus = currentVersion?.status || 'local';
                                           return (
                                             <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                                               versionStatus === 'generated' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                             }`}>
                                               {versionStatus === 'generated' ? 'CKG Ready' : 'Local'}
                                             </div>
                                           );
                                         })()}
                                    </div>
                                    <div className="ml-6 mt-1 flex items-center gap-2">
                                        {ds.platform && (
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${getPlatformBadgeColor(ds.platform)}`}>
                                                {getPlatformDisplayName(ds.platform)}
                                            </span>
                                        )}
                                        <div className="text-[10px] text-slate-400 truncate">{ds.url}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50 pl-7">
                                {/* Version Dropdown */}
                                <div className="flex items-center gap-2">
                                    <select 
                                      className="bg-slate-50 border border-slate-200 text-[10px] rounded px-1 py-0.5 text-slate-600 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[150px]"
                                      value={selectedVersionIds.get(ds.id) || ds.currentVersionId}
                                      onChange={(e) => {
                                        const newMap = new Map(selectedVersionIds);
                                        newMap.set(ds.id, e.target.value);
                                        setSelectedVersionIds(newMap);
                                      }}
                                    >
                                        {ds.versions.map((v, idx) => (
                                            <option key={v.id} value={v.id}>
                                                v{ds.versions.length - idx} - {v.timestamp} {v.tag ? `[${v.tag}]` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {editingTagVersionId === (selectedVersionIds.get(ds.id) || ds.currentVersionId) ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          value={tagInputValue}
                                          onChange={(e) => setTagInputValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              const versionId = selectedVersionIds.get(ds.id) || ds.currentVersionId;
                                              handleTagSave(versionId, ds.id);
                                            } else if (e.key === 'Escape') {
                                              handleTagCancel();
                                            }
                                          }}
                                          className="text-[10px] px-1 py-0.5 border border-indigo-300 rounded focus:outline-none focus:border-indigo-500 w-20"
                                          placeholder="Tag..."
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => {
                                            const versionId = selectedVersionIds.get(ds.id) || ds.currentVersionId;
                                            handleTagSave(versionId, ds.id);
                                          }}
                                          className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                                          title="Save Tag"
                                        >
                                          <Tag size={12} />
                                        </button>
                                        <button
                                          onClick={handleTagCancel}
                                          className="p-0.5 text-slate-400 hover:bg-slate-100 rounded"
                                          title="Cancel"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={() => {
                                          const currentVersionId = selectedVersionIds.get(ds.id) || ds.currentVersionId;
                                          const currentVersion = ds.versions.find(v => v.id === currentVersionId);
                                          handleTagButtonClick(currentVersionId, currentVersion?.tag);
                                        }}
                                        className="text-slate-400 hover:text-indigo-600" 
                                        title="Add/Edit Version Tag"
                                      >
                                        <Tag size={12} />
                                      </button>
                                    )}
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteVersion(selectedVersionIds.get(ds.id) || ds.currentVersionId, ds.id);
                                      }}
                                      className="p-1 text-red-600 hover:bg-red-50 hover:text-red-700 rounded transition-colors"
                                      title="Delete Current Version"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                
                                {/* Item Actions */}
                                <div className="flex items-center gap-1">
                                    <button 
                                      disabled={ds.isUploaded}
                                      className={`p-1 rounded transition-colors ${ds.isUploaded ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'}`}
                                      title={ds.isUploaded ? "Uploaded" : "Upload to Server"}
                                    >
                                        <Cloud size={14} />
                                    </button>
                                    <button 
                                      className="p-1 text-slate-500 hover:bg-slate-100 hover:text-green-600 rounded transition-colors"
                                      title="Generate CKG"
                                    >
                                        <Network size={14} />
                                    </button>
                                    <button 
                                      onClick={() => setPreviewDataId(ds.id)}
                                      className="p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 rounded transition-colors"
                                      title="Preview Content"
                                    >
                                        <Eye size={14} />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDataSource(ds.id);
                                      }}
                                      className="p-1 text-red-600 hover:bg-red-50 hover:text-red-700 rounded transition-colors"
                                      title="Delete All Versions"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    <button className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-semibold hover:border-slate-300 hover:text-slate-500 flex items-center justify-center gap-2">
                        <Upload size={14} /> Add Source
                    </button>
                </div>
            </div>

            {/* Global Batch Actions */}
            {hasSelection && (
                <div className="absolute bottom-4 left-4 right-4 bg-slate-900 text-white p-2 rounded-lg shadow-lg flex items-center justify-between animate-fade-in z-20">
                     <div className="text-xs font-medium pl-2">{selectedDataIds.size} selected</div>
                     <div className="flex gap-2">
                         <button className="px-2 py-1 hover:bg-white/20 rounded text-xs flex items-center gap-1">
                             <Cloud size={12} /> Upload
                         </button>
                         <button className="px-2 py-1 hover:bg-white/20 rounded text-xs flex items-center gap-1">
                             <Network size={12} /> Generate
                         </button>
                         <button 
                           onClick={handleBatchDelete}
                           className="px-2 py-1 hover:bg-red-500/50 text-red-200 hover:text-white rounded text-xs flex items-center gap-1"
                         >
                             <Trash2 size={12} /> Delete
                         </button>
                     </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewDataId && (
                <div className="absolute inset-0 bg-black/50 z-50 flex justify-end">
                    <div className="w-[85%] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right">
                        <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
                             <div className="flex-1 min-w-0">
                               <h4 className="font-bold text-slate-700 truncate">
                                 Preview: {dataSources.find(d => d.id === previewDataId)?.title || 'Unknown'}
                               </h4>
                               {(() => {
                                 const dataSource = dataSources.find(d => d.id === previewDataId);
                                 if (dataSource) {
                                   return (
                                     <div className="text-xs text-slate-500 mt-0.5 truncate">
                                       {dataSource.url}
                                     </div>
                                   );
                                 }
                                 return null;
                               })()}
                             </div>
                             <button 
                               onClick={() => {
                                 setPreviewDataId(null);
                                 setPreviewContent(null);
                                 setPreviewError(null);
                               }} 
                               className="ml-4 text-slate-400 hover:text-slate-600 transition-colors"
                             >
                                 <X size={20} />
                             </button>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
                            {renderPreviewContent()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  };

  const SmartDataView = () => {
    // Helper to find related entities from graph links
    const getRelatedEntities = (entityId: string) => {
        return mockGraphData.links
            .filter(l => (typeof l.source === 'object' ? l.source.id : l.source) === entityId || (typeof l.target === 'object' ? l.target.id : l.target) === entityId)
            .map(l => {
                const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                const targetId = typeof l.target === 'object' ? l.target.id : l.target;
                const otherId = sourceId === entityId ? targetId : sourceId;
                return { id: otherId as string, summary: l.summary || 'Related connection' };
            });
    };

    return (
      <div className="h-full bg-slate-50 flex flex-col relative">
           
           {/* Global Action Header */}
           <div className="h-10 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Smart Analysis</span>
               <button 
                 onClick={copySmartSelection}
                 disabled={selectedSmartIds.size === 0}
                 className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                     selectedSmartIds.size > 0 
                     ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' 
                     : 'text-slate-300 cursor-not-allowed'
                 }`}
               >
                   <Copy size={12} /> Copy Selection
               </button>
           </div>

           <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* 1. Entity List */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Detected Entities</h3>
                  <div className="space-y-2">
                    {Object.values(mockEntities).sort((a,b) => b.rank - a.rank).map(entity => (
                      <details 
                        key={entity.id} 
                        className="group bg-white border border-slate-200 rounded-lg shadow-sm"
                        open={activeEntity?.id === entity.id}
                      >
                          <summary 
                              className="flex items-center justify-between p-3 cursor-pointer list-none hover:bg-slate-50 transition-colors"
                              onClick={(e) => {
                                  // Check if the click originated from an input (checkbox)
                                  if ((e.target as HTMLElement).tagName === 'INPUT') return;
                                  
                                  // Prevent default native toggle behavior to control via state
                                  e.preventDefault();
                                  
                                  // Toggle active entity
                                  setActiveEntity(prev => prev?.id === entity.id ? null : entity);
                              }}
                          >
                              <div className="flex items-center gap-2">
                                  <input 
                                     type="checkbox" 
                                     checked={selectedSmartIds.has(entity.id)}
                                     onChange={() => toggleSmartSelection(entity.id)}
                                     onClick={(e) => e.stopPropagation()}
                                     className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="font-semibold text-sm text-slate-800">{entity.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono">{entity.type}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-indigo-600 font-bold">{(entity.rank * 10).toFixed(1)}</span>
                                  <ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180" />
                              </div>
                          </summary>
                          <div className="p-3 border-t border-slate-100 text-sm animate-fade-in">
                              
                              {/* Related Entities Section */}
                              <div className="mb-4">
                                  <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Connected Entities</h4>
                                  <div className="space-y-2 pl-1">
                                      {getRelatedEntities(entity.id).map((rel, idx) => (
                                          <div key={idx} className="flex items-start gap-2">
                                              <input 
                                                type="checkbox" 
                                                checked={selectedSmartIds.has(`rel-${entity.id}-${rel.id}`)}
                                                onChange={() => toggleSmartSelection(`rel-${entity.id}-${rel.id}`)}
                                                className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 scale-75"
                                              />
                                              <div>
                                                  <div className="text-xs font-semibold text-indigo-700 cursor-pointer hover:underline" onClick={() => handleChatEntityLinkClick(rel.id)}>
                                                      {rel.id}
                                                  </div>
                                                  <div className="text-[10px] text-slate-500">{rel.summary}</div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>

                              <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-1">Summary</h4>
                              <p className="text-slate-600 mb-3 bg-blue-50/50 p-2 rounded border border-blue-50 text-xs leading-relaxed">{entity.summary}</p>
                              
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Relevant Chunks</h4>
                              <div className="space-y-2">
                                  {entity.relatedChunks.map((chunk, i) => (
                                      <div key={i} className="text-xs text-slate-500 italic border-l-2 border-slate-300 pl-2 py-1">
                                          "{chunk}"
                                      </div>
                                  ))}
                              </div>
                              
                              <div className="mt-3 flex justify-end">
                                  <button onClick={() => switchSecondaryTab('mvg')} className="text-[10px] font-bold text-indigo-600 hover:underline">
                                      VIEW IN GRAPH
                                  </button>
                              </div>
                          </div>
                      </details>
                    ))}
                  </div>
                </div>

                {/* 2. Source Ranking */}
                <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Relevant Data Sources</h3>
                    <div className="space-y-2">
                        {dataSources
                            .filter(ds => ds.relevanceScore !== undefined)
                            .sort((a,b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
                            .map(ds => (
                            <div 
                              key={ds.id} 
                              className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors cursor-pointer"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handleSmartSourceClick(ds.id);
                              }}
                            >
                                <input 
                                   type="checkbox" 
                                   checked={selectedSmartIds.has(ds.id)}
                                   onChange={() => toggleSmartSelection(ds.id)}
                                   onClick={(e) => e.stopPropagation()}
                                   className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="mt-0.5 text-slate-400">
                                    {ds.type === 'web' ? <Globe size={14} /> : <FileText size={14} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <div className="text-sm font-medium text-slate-700 truncate" title={ds.title}>{ds.title}</div>
                                        <div className="text-xs font-bold text-green-600 bg-green-50 px-1 rounded">{((ds.relevanceScore || 0) * 100).toFixed(0)}%</div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">{ds.url}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
           </div>
      </div>
  );
  };

  const HistoryView = () => (
      <div className="h-full bg-slate-50 p-4 overflow-y-auto">
          <div className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Previous Sessions</div>
          <div className="space-y-3">
              {mockHistory.map(h => (
                  <div 
                    key={h.id} 
                    onClick={() => restoreHistory(h)}
                    className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all group"
                  >
                      <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">{h.summary}</h4>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">{h.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-2">{h.preview}</p>
                      <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlayCircle size={10} /> Restore Context
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-slate-50 relative overflow-hidden group">
      
      {/* --- Top Panel (Primary) --- */}
      <div 
        className="flex flex-col flex-1 overflow-hidden min-h-0"
      >
         <PrimaryHeader />
         <div className="flex-1 overflow-hidden relative flex flex-col">
            {activePrimaryTab === 'chat' ? <ChatView /> : <DataView />}
         </div>
      </div>

      {/* --- Resize Handle --- */}
      {secondaryHeight > 0 && (
          <div 
             onMouseDown={handleResizeStart}
             className="h-1 bg-slate-200 hover:bg-blue-400 cursor-row-resize flex items-center justify-center shrink-0 z-10 transition-colors"
          >
             <div className="w-16 h-1 rounded-full bg-slate-300"></div>
          </div>
      )}

      {/* --- Bottom Panel (Secondary Content) - Fixed at bottom, default collapsed --- */}
      <div 
        className="bg-white border-t border-slate-200 flex flex-col shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] transition-[height] duration-200 ease-out shrink-0"
        style={{ 
          height: secondaryHeight > 0 ? `${secondaryHeight}%` : '48px',
          minHeight: '48px',
          maxHeight: '90%'
        }}
      >
          {/* --- Persistent Bottom Tab Bar (Inside panel, above content, always visible) --- */}
          <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-around shrink-0 z-20">
            <button onClick={() => switchSecondaryTab('mvg')} className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${activeSecondaryTab === 'mvg' && secondaryHeight > 0 ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                <Network size={18} /><span className="text-[10px] font-medium">Graph</span>
            </button>
            <button onClick={() => switchSecondaryTab('data')} className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${activeSecondaryTab === 'data' && secondaryHeight > 0 ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                <Database size={18} /><span className="text-[10px] font-medium">Smart Data</span>
            </button>
            <button onClick={() => switchSecondaryTab('history')} className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${activeSecondaryTab === 'history' && secondaryHeight > 0 ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                <History size={18} /><span className="text-[10px] font-medium">History</span>
            </button>
          </div>

          {/* Secondary Header (Collapsible) - Only show when expanded */}
          {secondaryHeight > 0 && (
          <div className="h-8 border-b border-slate-100 flex items-center justify-between px-2 bg-slate-50 shrink-0">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2">
                 {activeSecondaryTab === 'mvg' && "Knowledge Graph"}
                 {activeSecondaryTab === 'data' && "Smart Data Analysis"}
                 {activeSecondaryTab === 'history' && "Interaction History"}
             </div>
             <div className="flex items-center gap-1">
                <button onClick={() => setSecondaryHeight(0)} className="p-1 text-slate-400 hover:text-slate-600">
                    <Minimize2 size={12} />
                </button>
             </div>
          </div>
          )}

          {/* Secondary Content Area - Only show when expanded */}
          {secondaryHeight > 0 && (
          <div className="flex-1 overflow-hidden relative">
             {activeSecondaryTab === 'mvg' && (
                 <div className="w-full h-full p-2 bg-slate-50">
                     <GraphView 
                        data={mockGraphData} 
                        activeNodeId={highlightedNode}
                        onNodeClick={handleGraphNodeClick} 
                     />
                 </div>
             )}

             {activeSecondaryTab === 'data' && <SmartDataView />}

             {activeSecondaryTab === 'history' && <HistoryView />}
          </div>
          )}
      </div>

    </div>
  );
};