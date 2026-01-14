import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SidebarNav } from './SidebarNav';
import { ChatLayout } from './ChatLayout';
import { DataLayout } from './DataLayout';
import { loadDataSources } from '../../services/data-loader';
import { StorageService } from '../../services/storage';
import { authService, type AuthState } from '../../services/auth-service';
import type { Message, PromptResponse, DataSource } from '../../types';
import type { ChatLLMPlatform } from '../../types/capture';
import type { MVGResponse, RelevantSessionsResponse } from '../../types/api';

export const FullscreenWorkbench: React.FC = () => {
  // --- Layout State ---
  const [activePrimaryTab, setActivePrimaryTab] = useState<'chat' | 'data' | 'history'>('chat');
  
  // --- Auth State ---
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
  });

  // --- Data State ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isWaitingResponse, setIsWaitingResponse] = useState(false);
  
  // Smart Data & Graph
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [mvgData, setMvgData] = useState<MVGResponse | null>(null);
  const [relevantSessions, setRelevantSessions] = useState<RelevantSessionsResponse[]>([]);
  const [structuredOutput, setStructuredOutput] = useState<string | null>(null);
  
  // Data Sources
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dataFilter, setDataFilter] = useState<'all' | 'web' | 'upload'>('all');
  const [platformFilter, setPlatformFilter] = useState<ChatLLMPlatform | 'general' | 'demo' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedDataIds, setSelectedDataIds] = useState<Set<string>>(new Set());
  const [previewDataId, setPreviewDataId] = useState<string | null>(null);
  
  // Upload status management
  const [uploadStatuses, setUploadStatuses] = useState<Map<string, {
    status: 'idle' | 'uploading' | 'success' | 'failed';
    progress?: number;
    error?: string;
  }>>(new Map());

  // Activated data sources
  const [activatedDataIds, setActivatedDataIds] = useState<Set<string>>(new Set());
  const [activatedSourcesCKG, setActivatedSourcesCKG] = useState<MVGResponse | null>(null);
  const [loadingActivatedCKG, setLoadingActivatedCKG] = useState(false);
  const [activatedCKGError, setActivatedCKGError] = useState<string | null>(null);

  // --- Refs ---
  const heroInputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  // Load auth state
  useEffect(() => {
    authService.getAuthState().then(state => {
      setAuthState(state);
    });
  }, []);

  // Load data sources
  const refreshDataSources = useCallback(async () => {
    try {
      const sources = await loadDataSources();
      setDataSources(sources);
    } catch (error) {
      console.error('[DASHBOARD] Failed to refresh data sources:', error);
    }
  }, []);

  useEffect(() => {
    refreshDataSources();
    StorageService.loadActivatedDataIds().then(ids => {
      setActivatedDataIds(ids);
    });
  }, [refreshDataSources]);

  // Load activated sources CKG
  const loadActivatedSourcesCKG = useCallback(async () => {
    if (activatedDataIds.size === 0) {
      setActivatedSourcesCKG(null);
      return;
    }

    if (!authState.isAuthenticated) {
      setActivatedSourcesCKG(null);
      return;
    }

    setLoadingActivatedCKG(true);
    try {
      const { apiService } = await import('../../services/api');
      const sourceIdsArray = Array.from(activatedDataIds);
      const response = await apiService.visualizeMVG({
        source_ids: sourceIdsArray,
        max_entities: 100,
        expansion_depth: 0,
      });

      if (response.success && response.mvg) {
        setActivatedSourcesCKG(response.mvg);
        setActivatedCKGError(null);
      } else {
        setActivatedSourcesCKG(null);
        setActivatedCKGError(response.message || 'Failed to load graph');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load graph';
      setActivatedSourcesCKG(null);
      setActivatedCKGError(errorMsg);
    } finally {
      setLoadingActivatedCKG(false);
    }
  }, [activatedDataIds, authState.isAuthenticated]);

  useEffect(() => {
    if (activatedDataIds.size > 0 && authState.isAuthenticated) {
      loadActivatedSourcesCKG();
    } else {
      setActivatedSourcesCKG(null);
      setActivatedCKGError(null);
    }
  }, [activatedDataIds, authState.isAuthenticated, loadActivatedSourcesCKG]);

  // Sync state from storage
  useEffect(() => {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== 'local') return;
      
      // Sync activated data IDs (check for both user-specific and general keys)
      const activatedKeys = Object.keys(changes).filter(key => 
        key.startsWith('sys2path_activated_data_ids')
      );
      if (activatedKeys.length > 0) {
        StorageService.loadActivatedDataIds().then(ids => {
          setActivatedDataIds(ids);
        });
      }
      
      // Sync auth state
      if (changes['sys2path_auth_token'] || changes['sys2path_user_info']) {
        authService.getAuthState().then(state => {
          setAuthState(state);
        });
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Chat handlers
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  }, []);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    setIsComposing(false);
  }, []);

  const handleSendClick = useCallback(async () => {
    if (!inputText.trim()) return;
    
    if (!authState.isAuthenticated) {
      alert('Please login first to use this feature');
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    const text = inputText;
    setInputText('');
    setMvgData(null);
    setRelevantSessions([]);
    setStructuredOutput(null);
    setIsWaitingResponse(true);

    try {
      const { apiService } = await import('../../services/api');
      const sourceIds = activatedDataIds.size > 0 ? Array.from(activatedDataIds) : undefined;
      
      const response = await apiService.visualizeMVG({
        prompt: text,
        max_entities: 100,
        expansion_depth: 0,
        include_structured_output: true,
        include_session_relevance: true,
        source_ids: sourceIds,
      });

      setIsWaitingResponse(false);

      if (response.success && response.mvg) {
        setMvgData(response.mvg);
        setRelevantSessions(response.relevant_sessions || []);
        setStructuredOutput(response.structured_output || null);

        let promptResponse: PromptResponse | undefined;
        if (response.prompt_response) {
          try {
            const parsed = JSON.parse(response.prompt_response);
            if (parsed.expanded_query && Array.isArray(parsed.right_questions) && Array.isArray(parsed.action_items)) {
              promptResponse = {
                expanded_query: parsed.expanded_query,
                right_questions: parsed.right_questions,
                action_items: parsed.action_items,
              };
            }
          } catch (error) {
            console.warn('[CHAT] Failed to parse prompt_response:', error);
          }
        }

        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: promptResponse ? promptResponse.expanded_query : (response.message || 'MVG visualization generated successfully'),
          timestamp: Date.now(),
          promptResponse: promptResponse,
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(response.message || 'Failed to generate MVG');
      }
    } catch (error) {
      setIsWaitingResponse(false);
      console.error('[CHAT] Failed to visualize MVG:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to generate MVG';
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `Error: ${errorMsg}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    }
  }, [inputText, authState.isAuthenticated, activatedDataIds]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendClick();
    }
  }, [isComposing, handleSendClick]);

  const handleChatEntityLinkClick = useCallback(() => {
    // Handle entity link click
  }, []);

  const handleGraphNodeClick = useCallback((nodeId: string) => {
    setHighlightedNode(nodeId);
  }, []);

  // Data handlers
  const handleToggleActivation = useCallback(async (dataSourceId: string) => {
    const newActivatedIds = new Set(activatedDataIds);
    if (newActivatedIds.has(dataSourceId)) {
      newActivatedIds.delete(dataSourceId);
    } else {
      newActivatedIds.add(dataSourceId);
    }
    setActivatedDataIds(newActivatedIds);
    
    try {
      await StorageService.saveActivatedDataIds(newActivatedIds);
    } catch (error) {
      console.error('[DASHBOARD] Failed to save activated data IDs:', error);
    }
  }, [activatedDataIds]);

  const handleUploadClick = useCallback(async (id: string) => {
    const ids = [id];
    setUploadStatuses(prev => {
      const newStatuses = new Map(prev);
      ids.forEach(id => {
        newStatuses.set(id, { status: 'uploading', progress: 0 });
      });
      return newStatuses;
    });
    
    try {
      const { uploadDataSources } = await import('../../services/upload-service');
      const result = await uploadDataSources(
        ids,
        undefined,
        (id, itemProgress) => {
          setUploadStatuses(prev => {
            const newStatuses = new Map(prev);
            const current = newStatuses.get(id);
            if (current) {
              newStatuses.set(id, { ...current, progress: itemProgress });
            }
            return newStatuses;
          });
        }
      );
      
      setUploadStatuses(prev => {
        const newStatuses = new Map(prev);
        ids.forEach(id => {
          newStatuses.set(id, { 
            status: result.success ? 'success' : 'failed',
            progress: result.success ? 100 : 0
          });
        });
        return newStatuses;
      });
      
      if (result.success) {
        refreshDataSources();
      }
      
      setTimeout(() => {
        setUploadStatuses(prev => {
          const newStatuses = new Map(prev);
          ids.forEach(id => newStatuses.delete(id));
          return newStatuses;
        });
      }, 3000);
    } catch (error) {
      console.error('[UPLOAD] Failed to upload:', error);
      setUploadStatuses(prev => {
        const newStatuses = new Map(prev);
        ids.forEach(id => {
          newStatuses.set(id, { status: 'failed', progress: 0 });
        });
        return newStatuses;
      });
    }
  }, [refreshDataSources]);

  const handleDeleteClick = useCallback(async (id: string) => {
    if (confirm('Are you sure you want to delete this data source?')) {
      try {
        await StorageService.deleteDataSources([id]);
        refreshDataSources();
      } catch (error) {
        console.error('[DASHBOARD] Failed to delete data source:', error);
      }
    }
  }, [refreshDataSources]);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Left Sidebar */}
      <SidebarNav
        activeTab={activePrimaryTab}
        onTabChange={setActivePrimaryTab}
        onAuthChange={setAuthState}
      />
      
      {/* Right Content Area */}
      <div className="flex-1 overflow-hidden">
        {activePrimaryTab === 'chat' ? (
          <ChatLayout
            messages={messages}
            inputText={inputText}
            onInputChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onSendClick={handleSendClick}
            onChatEntityLinkClick={handleChatEntityLinkClick}
            heroInputRef={heroInputRef}
            replyInputRef={replyInputRef}
            isWaitingResponse={isWaitingResponse}
            mvgData={mvgData}
            structuredOutput={structuredOutput}
            relevantSessions={relevantSessions}
            highlightedNode={highlightedNode}
            onGraphNodeClick={handleGraphNodeClick}
          />
        ) : activePrimaryTab === 'data' ? (
          <DataLayout
            dataSources={dataSources}
            dataFilter={dataFilter}
            platformFilter={platformFilter}
            searchQuery={searchQuery}
            sortOrder={sortOrder}
            selectedDataIds={selectedDataIds}
            activatedDataIds={activatedDataIds}
            activatedSourcesCKG={activatedSourcesCKG}
            loadingActivatedCKG={loadingActivatedCKG}
            activatedCKGError={activatedCKGError}
            highlightedNode={highlightedNode}
            uploadStatuses={uploadStatuses}
            previewDataId={previewDataId}
            onDataFilterChange={setDataFilter}
            onPlatformFilterChange={setPlatformFilter}
            onSearchQueryChange={setSearchQuery}
            onSortOrderChange={setSortOrder}
            onDataSelectionToggle={(id) => {
              setSelectedDataIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) {
                  newSet.delete(id);
                } else {
                  newSet.add(id);
                }
                return newSet;
              });
            }}
            onToggleActivation={handleToggleActivation}
            onUploadClick={handleUploadClick}
            onPreviewClick={setPreviewDataId}
            onDeleteClick={handleDeleteClick}
            onGraphNodeClick={handleGraphNodeClick}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-lg">
            待实现
          </div>
        )}
      </div>
    </div>
  );
};
