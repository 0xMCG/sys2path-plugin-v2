import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Network, Database,
  Send, X,
  Trash2, FileText, Globe, Upload, ChevronDown,
  Eye, Cloud, Search, ArrowUp, ArrowDown,
  Loader2, CheckCircle2, XCircle, Copy, Check
} from 'lucide-react';
import { loadDataSources } from '../../services/data-loader';
import { StorageService } from '../../services/storage';
import type { Message, ViewMode, DataSource } from '../../types';
import type { ChatLLMConversation, GeneralPageContent, ChatLLMPlatform, ChatLLMMessage } from '../../types/capture';
import type { MVGResponse, RelevantSessionsResponse } from '../../types/api';
import GraphView from './GraphView';
import { RelevantSessionsList } from './RelevantSessionsList';
import { StructuredOutput } from './StructuredOutput';
import { PrimaryHeader } from './PrimaryHeader';
import type { AuthState } from '../../services/auth-service';

interface WorkbenchProps {
  mode: ViewMode;
}

// ChatView component props
interface ChatViewProps {
  messages: Message[];
  inputText: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  onSendClick: () => void;
  onChatEntityLinkClick: () => void;
  heroInputRef: React.RefObject<HTMLInputElement | null>;
  replyInputRef: React.RefObject<HTMLInputElement | null>;
}

// Extract ChatView as a memoized component to prevent unnecessary re-renders
const ChatView = React.memo<ChatViewProps>(({
  messages,
  inputText,
  onInputChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onSendClick,
  onChatEntityLinkClick,
  heroInputRef,
  replyInputRef
}) => {
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
              ref={heroInputRef}
              type="text" 
              id="chat-input-hero"
              name="chat-input-hero"
              value={inputText} 
              onChange={onInputChange} 
              onKeyDown={onKeyDown}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              placeholder="Ask about context..."
              className="w-full pl-5 pr-12 py-4 rounded-full border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-lg transition-all"
            />
            <button onClick={onSendClick} className="absolute right-2 top-2 bottom-2 aspect-square bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors">
              <Send size={18} />
            </button>
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
                        <button key={idx} onClick={onChatEntityLinkClick} className={`mx-1 px-1.5 py-0.5 rounded text-sm font-medium transition-colors inline-flex items-center ${msg.role === 'user' ? 'bg-blue-500 text-white hover:bg-blue-400' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}>
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
              <input 
                ref={replyInputRef}
                type="text" 
                id="chat-input-reply"
                name="chat-input-reply"
                value={inputText} 
                onChange={onInputChange} 
                onKeyDown={onKeyDown}
                onCompositionStart={onCompositionStart}
                onCompositionEnd={onCompositionEnd}
                placeholder="Reply..." 
                className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
              <button onClick={onSendClick} className="absolute right-2 top-2 p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"><Send size={16} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if messages or inputText change
  return prevProps.messages.length === nextProps.messages.length &&
         prevProps.inputText === nextProps.inputText &&
         prevProps.messages.every((msg, idx) => 
           msg.id === nextProps.messages[idx]?.id && 
           msg.content === nextProps.messages[idx]?.content
         );
});

ChatView.displayName = 'ChatView';

export const Workbench: React.FC<WorkbenchProps> = () => {
  // --- Layout State ---
  const [secondaryHeight, setSecondaryHeight] = useState(0); // Default: collapsed 
  const [activeSecondaryTab, setActiveSecondaryTab] = useState<'mvg' | 'data' | 'resources'>('mvg');
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
  
  // Smart Data & Graph
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  
  // Data Sources - load from storage
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dataFilter, setDataFilter] = useState<'all' | 'web' | 'upload'>('all');
  const [platformFilter, setPlatformFilter] = useState<ChatLLMPlatform | 'general' | 'demo' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedDataIds, setSelectedDataIds] = useState<Set<string>>(new Set());
  const [previewDataId, setPreviewDataId] = useState<string | null>(null);
  const [highlightedDataId, setHighlightedDataId] = useState<string | null>(null);
  
  // Preview content state
  const [previewContent, setPreviewContent] = useState<ChatLLMConversation | GeneralPageContent | null>(null);
  const [previewContentOld, setPreviewContentOld] = useState<ChatLLMConversation | GeneralPageContent | null>(null); // For diff comparison
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Copy success state for Structured Output
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Upload status management
  const [uploadStatuses, setUploadStatuses] = useState<Map<string, {
    status: 'idle' | 'uploading' | 'success' | 'failed';
    progress?: number;
    error?: string;
  }>>(new Map());

  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false); // Use ref to track composition state without causing re-renders

  // Refresh data sources from storage - memoized to prevent unnecessary re-renders
  // Declared early so it can be used in useEffect dependencies
  const refreshDataSources = useCallback(async () => {
    try {
      const sources = await loadDataSources();
      setDataSources(sources);
    } catch (error) {
      console.error('[WORKBENCH] Failed to refresh data sources:', error);
    }
  }, []);

  // --- Effects ---
  useEffect(() => {
    // Load data sources from storage on mount
    loadDataSources()
      .then(sources => {
        console.log('[WORKBENCH] Loaded real data sources:', sources.length);
        setDataSources(sources);
      })
      .catch(error => {
        console.error('[WORKBENCH] Failed to load data sources:', error);
        // Keep empty array on loading failure
        setDataSources([]);
      });

    // Listen for data capture events
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'DATA_CAPTURED') {
        console.log('[WORKBENCH] Data captured, refreshing...');
        
        // Check for duplicate message
        if (event.data.duplicateMessage) {
          setToastMessage(event.data.duplicateMessage);
          // Auto-hide toast after 3 seconds
          setTimeout(() => setToastMessage(null), 3000);
        }
        
        // Use refreshDataSources instead of direct loadDataSources to maintain consistency
        refreshDataSources()
          .then(() => {
            // Only switch to Data tab if not duplicate
            if (!event.data.duplicateMessage) {
              setActivePrimaryTab('data');
              if (event.data.data && event.data.data.id) {
                // Extract base ID from versioned ID if needed
                const capturedId = event.data.data.id;
                const baseId = capturedId.split('-').slice(0, -1).join('-') || capturedId;
                setHighlightedDataId(baseId);
              }
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
  }, [refreshDataSources]);

  // Track previous user ID to detect user switching
  const prevUserIdRef = useRef<number | null>(null);

  // Sync with server when user is authenticated or user switches
  useEffect(() => {
    const currentUserId = authState.user?.id || null;
    const isUserSwitched = prevUserIdRef.current !== null && 
                          prevUserIdRef.current !== currentUserId && 
                          currentUserId !== null;
    
    if (isUserSwitched) {
      console.log('[WORKBENCH] User switched from', prevUserIdRef.current, 'to', currentUserId);
      // Refresh data sources when user switches
      refreshDataSources();
    }
    
    // Update previous user ID
    prevUserIdRef.current = currentUserId;
    
    if (authState.isAuthenticated) {
      const syncWithServer = async () => {
        try {
          const { syncServerSessions } = await import('../../services/sync-service');
          const syncedSources = await syncServerSessions();
          console.log('[WORKBENCH] Synced with server, total sources:', syncedSources.length);
          setDataSources(syncedSources);
        } catch (error) {
          console.error('[WORKBENCH] Failed to sync with server:', error);
          // Keep existing data sources on sync failure
        }
      };
      syncWithServer();
    }
  }, [authState.isAuthenticated, authState.user?.id, refreshDataSources]);

  useEffect(() => {
    // Auto-scroll to highlighted data source if active
    if (activePrimaryTab === 'data' && highlightedDataId) {
       // 使用 requestAnimationFrame 确保在渲染完成后执行
       requestAnimationFrame(() => {
         requestAnimationFrame(() => {
           const el = document.getElementById(`ds-${highlightedDataId}`);
           if (el) {
             el.scrollIntoView({ behavior: 'smooth', block: 'center' });
           }
           // Clear highlight after animation
           setTimeout(() => setHighlightedDataId(null), 2000);
         });
       });
    }
  }, [activePrimaryTab, highlightedDataId]);

  // Load preview content when previewDataId changes
  useEffect(() => {
    if (!previewDataId) {
      setPreviewContent(null);
      setPreviewContentOld(null);
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

        // If there are 2 versions, load both for diff comparison
        if (dataSource.versions.length === 2) {
          const [uploadedVersion, localVersion] = dataSource.versions;
          
          // Load both versions
          let newContent: ChatLLMConversation | GeneralPageContent | null = null;
          let oldContent: ChatLLMConversation | GeneralPageContent | null = null;
          
          // Try to load as conversations
          const newConv = await StorageService.getConversation(localVersion.id);
          const oldConv = await StorageService.getConversation(uploadedVersion.id);
          
          if (newConv && oldConv) {
            newContent = newConv;
            oldContent = oldConv;
          } else {
            // Try to load as page contents
            const newPage = await StorageService.getPageContent(localVersion.id);
            const oldPage = await StorageService.getPageContent(uploadedVersion.id);
            
            if (newPage && oldPage) {
              newContent = newPage;
              oldContent = oldPage;
            }
          }
          
          if (newContent && oldContent) {
            setPreviewContent(newContent);
            setPreviewContentOld(oldContent);
            setPreviewLoading(false);
            return;
          }
        }
        
        // Single version or fallback: load current version only
        const conversation = await StorageService.getConversation(dataSource.currentVersionId);
        if (conversation) {
          setPreviewContent(conversation);
          setPreviewContentOld(null);
          setPreviewLoading(false);
          return;
        }

        const pageContent = await StorageService.getPageContent(dataSource.currentVersionId);
        if (pageContent) {
          setPreviewContent(pageContent);
          setPreviewContentOld(null);
          setPreviewLoading(false);
          return;
        }

        // If not found by currentVersionId, try to find by base ID
        const allConversations = await StorageService.getAllConversations();
        const matchingConv = allConversations.find(c => {
          const baseId = c.id.split('-').slice(0, -1).join('-') || c.id;
          return baseId === dataSource.id || c.id === dataSource.currentVersionId;
        });
        
        if (matchingConv) {
          setPreviewContent(matchingConv);
          setPreviewContentOld(null);
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
          setPreviewContentOld(null);
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

  // Cross-page data synchronization - optimized to prevent unnecessary re-renders
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      // Check for changes in user-isolated storage keys (with or without user suffix)
      const hasConversationChange = Object.keys(changes).some(key => 
        key.startsWith('sys2path_conversations')
      );
      const hasPageContentChange = Object.keys(changes).some(key => 
        key.startsWith('sys2path_page_contents')
      );
      
      if (hasConversationChange || hasPageContentChange) {
        console.log('[WORKBENCH] Storage changed, scheduling refresh...');
        
        // Debounce storage changes to avoid frequent re-renders
        // Only refresh if we're on the Data tab or if user is not actively typing
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }
        
        refreshTimer = setTimeout(() => {
          // Only refresh if not actively composing (typing)
          if (!isComposingRef.current) {
            refreshDataSources();
          } else {
            // If user is typing, schedule refresh after composition ends
            const checkComposition = setInterval(() => {
              if (!isComposingRef.current) {
                clearInterval(checkComposition);
                refreshDataSources();
              }
            }, 100);
            // Clear interval after 5 seconds to avoid infinite loop
            setTimeout(() => clearInterval(checkComposition), 5000);
          }
        }, 300); // 300ms debounce
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [refreshDataSources]);

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

  const switchSecondaryTab = (tab: 'mvg' | 'data' | 'resources') => {
      if (secondaryHeight <= 0) setSecondaryHeight(50);
      setActiveSecondaryTab(tab);
  };

  // MVG visualization state
  const [mvgData, setMvgData] = useState<MVGResponse | null>(null);
  const [relevantSessions, setRelevantSessions] = useState<RelevantSessionsResponse[]>([]);
  const [structuredOutput, setStructuredOutput] = useState<string | null>(null);

  // Chat Logic
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    // Check authentication
    if (!authState.isAuthenticated) {
      alert('Please login first to use this feature');
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setMvgData(null);
    setRelevantSessions([]);
    setStructuredOutput(null);

    try {
      // Call backend API
      const { apiService } = await import('../../services/api');
      const response = await apiService.visualizeMVG({
        prompt: text,
        max_entities: 100,
        expansion_depth: 0,
        include_structured_output: true,
        include_session_relevance: true,
      });

      if (response.success && response.mvg) {
        setMvgData(response.mvg);
        setRelevantSessions(response.relevant_sessions || []);
        setStructuredOutput(response.structured_output || null);

        // Switch to Graph tab and expand secondary panel
        if (secondaryHeight <= 0) {
          setSecondaryHeight(50);
        }
        setActiveSecondaryTab('mvg');

        // Add AI response message
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: response.message || 'MVG visualization generated successfully',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(response.message || 'Failed to generate MVG');
      }
    } catch (error) {
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
  }, [authState.isAuthenticated, secondaryHeight]);
  
  // Input handlers with useCallback to prevent re-renders
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
    setIsComposing(true); // Keep state for handleKeyDown if needed
  }, []);
  
  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    setIsComposing(false);
  }, []);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // 在组合输入期间，直接更新值但不触发状态更新，避免中断输入法
    setInputText(e.target.value);
  }, []);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // 在组合输入期间，不处理 Enter 键
    if (isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage(inputText);
    }
  }, [inputText, sendMessage, isComposing]);
  
  const handleSendClick = useCallback(() => {
    sendMessage(inputText);
  }, [inputText, sendMessage]);
  
  // 使用 ref 跟踪上一次的 tab，只在从非 chat 切换到 chat 时聚焦
  const prevTabRef = useRef<'chat' | 'data' | 'history'>(activePrimaryTab);
  const prevMessagesLengthRef = useRef<number>(messages.length);
  const hasFocusedRef = useRef(false);
  
  // Focus management: 只在切换 tab 或模式切换时聚焦
  useEffect(() => {
    const prevTab = prevTabRef.current;
    const isSwitchingToChat = prevTab !== 'chat' && activePrimaryTab === 'chat';
    const isModeSwitching = prevMessagesLengthRef.current === 0 && messages.length > 0; // Hero to reply mode
    
    // 选择正确的 input ref
    const currentInputRef = messages.length === 0 ? heroInputRef : replyInputRef;
    
    if ((isSwitchingToChat || isModeSwitching) && currentInputRef.current) {
      const timer = setTimeout(() => {
        if (!isComposingRef.current && 
            currentInputRef.current && 
            document.activeElement !== currentInputRef.current) {
          // 检查输入框是否为空（只在切换 tab 时）
          if (isSwitchingToChat && currentInputRef.current.value === '') {
            currentInputRef.current.focus();
            hasFocusedRef.current = true;
          } else if (isModeSwitching) {
            // 模式切换时，直接聚焦（用户可能正在输入）
            currentInputRef.current.focus();
            // 将光标移到末尾
            const len = currentInputRef.current.value.length;
            currentInputRef.current.setSelectionRange(len, len);
            hasFocusedRef.current = true;
          }
        }
      }, 150);
      
      prevTabRef.current = activePrimaryTab;
      prevMessagesLengthRef.current = messages.length;
      return () => clearTimeout(timer);
    } else {
      prevTabRef.current = activePrimaryTab;
      prevMessagesLengthRef.current = messages.length;
    }
    
    // 当离开 chat tab 时，重置聚焦标志
    if (activePrimaryTab !== 'chat') {
      hasFocusedRef.current = false;
    }
  }, [activePrimaryTab, messages.length]); // 添加 messages.length 以检测模式切换
  
  // Enhanced focus management: 监听 input 元素焦点状态，自动恢复焦点
  useEffect(() => {
    if (activePrimaryTab !== 'chat') return;
    
    const currentInput = messages.length === 0 ? heroInputRef.current : replyInputRef.current;
    if (!currentInput) return;
    
    // 检查是否失去焦点但应该保持焦点
    const checkAndRestoreFocus = () => {
      // 只在用户正在输入（有内容）且不在组合输入时恢复焦点
      if (currentInput.value.length > 0 && 
          !isComposingRef.current &&
          document.activeElement !== currentInput &&
          document.activeElement !== document.body) {
        // 延迟恢复焦点，避免与其他操作冲突
        requestAnimationFrame(() => {
          if (currentInput && document.activeElement !== currentInput) {
            currentInput.focus();
            // 将光标移到末尾
            const len = currentInput.value.length;
            currentInput.setSelectionRange(len, len);
          }
        });
      }
    };
    
    // 监听焦点事件
    const handleBlur = (e: FocusEvent) => {
      // 如果焦点转移到其他可交互元素，不恢复焦点
      const target = e.relatedTarget as HTMLElement;
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      // 延迟检查，避免与其他操作冲突
      setTimeout(checkAndRestoreFocus, 100);
    };
    
    currentInput.addEventListener('blur', handleBlur);
    
    return () => {
      currentInput.removeEventListener('blur', handleBlur);
    };
  }, [activePrimaryTab, messages.length, inputText]); // 依赖 inputText 以检测用户输入

  // Navigations
  const handleChatEntityLinkClick = () => {
    // Entity navigation removed - no mock data
    switchSecondaryTab('data'); 
  };

  const handleGraphNodeClick = (nodeId: string) => {
     setHighlightedNode(nodeId);
     // Entity selection removed - no mock data
  };

  // Copy Structured Output to clipboard with multi-layer fallback
  const handleCopyStructuredOutput = useCallback(async () => {
    if (!structuredOutput) return;
    
    try {
      // Method 1: Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(structuredOutput);
          setCopySuccess(true);
          setTimeout(() => {
            setCopySuccess(false);
          }, 2000);
          return;
        } catch (clipboardError) {
          console.warn('[WORKBENCH] Clipboard API failed, trying fallback:', clipboardError);
          // Fall through to fallback method
        }
      }
      
      // Method 2: Try document.execCommand fallback
      const textarea = document.createElement('textarea');
      textarea.value = structuredOutput;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
          setCopySuccess(true);
          setTimeout(() => {
            setCopySuccess(false);
          }, 2000);
          return;
        } else {
          throw new Error('execCommand copy failed');
        }
      } catch (execError) {
        document.body.removeChild(textarea);
        console.warn('[WORKBENCH] execCommand failed, trying postMessage:', execError);
        // Fall through to postMessage method
      }
      
      // Method 3: Use postMessage to let content script handle copy
      // Set up a one-time listener for the result
      const resultHandler = (event: MessageEvent) => {
        if (event.data && event.data.type === 'COPY_TO_CLIPBOARD_RESULT') {
          window.removeEventListener('message', resultHandler);
          if (event.data.success) {
            setCopySuccess(true);
            setTimeout(() => {
              setCopySuccess(false);
            }, 2000);
          } else {
            console.error('[WORKBENCH] Copy via content script failed:', event.data.error);
            alert('复制失败，请手动复制内容');
          }
        }
      };
      
      window.addEventListener('message', resultHandler);
      
      // Send copy request to parent window (content script)
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'COPY_TO_CLIPBOARD',
          text: structuredOutput
        }, '*');
        
        // Set timeout to clean up listener if no response
        setTimeout(() => {
          window.removeEventListener('message', resultHandler);
        }, 5000);
      } else {
        window.removeEventListener('message', resultHandler);
        throw new Error('Cannot access parent window');
      }
    } catch (error) {
      console.error('[WORKBENCH] All copy methods failed:', error);
      alert('复制失败，请手动复制内容');
    }
  }, [structuredOutput]);

  // Selection Helpers
  const toggleDataSelection = (id: string) => {
      const newSet = new Set(selectedDataIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedDataIds(newSet);
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

  // Render conversation preview with diff highlighting
  const renderConversationPreview = (conversation: ChatLLMConversation, oldConversation?: ChatLLMConversation) => {
    // Create a map of old messages by messageId for comparison
    const oldMessageMap = new Map<string, ChatLLMMessage>();
    if (oldConversation) {
      oldConversation.messages.forEach(msg => {
        if (msg.messageId) {
          oldMessageMap.set(msg.messageId, msg);
        }
      });
    }

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
            {oldConversation && (
              <div className="mt-1 text-orange-600">
                Showing differences from synced version
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {conversation.messages.map((message, index) => {
            // Check if this message differs from the old version
            const oldMessage = message.messageId ? oldMessageMap.get(message.messageId) : null;
            const isDifferent = oldMessage 
              ? (oldMessage.content !== message.content || (message.messageId && !oldMessageMap.has(message.messageId)))
              : (!oldConversation ? false : true); // New message if old version exists
            
            // Check if message is new (not in old version)
            const isNew = oldConversation && !oldMessage;
            
            return (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  isDifferent || isNew
                    ? message.role === 'user'
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-yellow-50 border-yellow-300'
                    : message.role === 'user'
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
                  <div className="flex items-center gap-2">
                    {isNew && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                        New
                      </span>
                    )}
                    {isDifferent && !isNew && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                        Modified
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500">
                      {new Date(message.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render page content preview with diff highlighting
  const renderPageContentPreview = (content: GeneralPageContent, oldContent?: GeneralPageContent) => {
    const isDifferent = oldContent 
      ? (oldContent.messageId !== content.messageId || oldContent.content !== content.content)
      : false;
    const isNew = oldContent && !oldContent.messageId;

    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-xs text-green-600">
            <div>Type: General Page Content</div>
            <div>Characters: {content.content.length.toLocaleString()}</div>
            <div>Captured: {new Date(content.capturedAt).toLocaleString()}</div>
            {oldContent && (
              <div className="mt-1 text-orange-600">
                {isDifferent ? 'Content differs from synced version' : 'Content matches synced version'}
              </div>
            )}
          </div>
        </div>

        <div className={`border rounded-lg p-4 ${
          isDifferent || isNew
            ? 'bg-yellow-50 border-yellow-300'
            : 'bg-white border-slate-200'
        }`}>
          {isNew && (
            <div className="mb-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                New Content
              </span>
            </div>
          )}
          {isDifferent && !isNew && (
            <div className="mb-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                Modified Content
              </span>
            </div>
          )}
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
      const oldConv = previewContentOld && 'messages' in previewContentOld 
        ? previewContentOld as ChatLLMConversation 
        : undefined;
      return renderConversationPreview(previewContent as ChatLLMConversation, oldConv);
    } else {
      const oldPage = previewContentOld && !('messages' in previewContentOld)
        ? previewContentOld as GeneralPageContent
        : undefined;
      return renderPageContentPreview(previewContent as GeneralPageContent, oldPage);
    }
  };

  // --- Handlers ---
  
  const handleTabChange = useCallback((tab: 'chat' | 'data' | 'history') => {
    setActivePrimaryTab(tab);
  }, []);

  const DataView = () => {
    const handleUploadStart = useCallback((ids: string[]) => {
      setUploadStatuses(prev => {
        const newStatuses = new Map(prev);
        ids.forEach(id => {
          newStatuses.set(id, { status: 'uploading', progress: 0 });
        });
        return newStatuses;
      });
    }, []);
    
    const handleUploadProgress = useCallback((id: string, progress: number) => {
      setUploadStatuses(prev => {
        const newStatuses = new Map(prev);
        const current = newStatuses.get(id);
        if (current) {
          newStatuses.set(id, { ...current, progress });
        }
        return newStatuses;
      });
    }, []);
    
    const handleUploadComplete = useCallback(async (ids: string[], success: boolean) => {
      setUploadStatuses(prev => {
        const newStatuses = new Map(prev);
        ids.forEach(id => {
          newStatuses.set(id, { 
            status: success ? 'success' : 'failed',
            progress: success ? 100 : 0
          });
        });
        return newStatuses;
      });
      
      // 更新 dataSources 的 isUploaded 状态
      setDataSources(prev => prev.map(ds => {
        if (ids.includes(ds.id)) {
          return { ...ds, isUploaded: success };
        }
        return ds;
      }));
      
      // 如果上传成功，持久化 isUploaded 状态到本地存储，并获取服务器时间
      if (success) {
        for (const id of ids) {
          try {
            // 获取服务器时间（通过 getSessions API）
            let serverUpdateTime: string | undefined;
            try {
              const { apiService } = await import('../../services/api');
              const response = await apiService.getSessions({
                page: 1,
                page_size: 100
              });
              
              if (response.success) {
                // 查找匹配的会话
                const matchingSession = response.sessions.find(s => s.session_id === id);
                if (matchingSession && matchingSession.update_time) {
                  // 将 UTC 时间转换为本地时区
                  const serverTime = new Date(matchingSession.update_time);
                  serverUpdateTime = serverTime.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                    // 不指定 timeZone，使用浏览器本地时区
                  });
                }
              }
            } catch (error) {
              console.warn(`[UPLOAD] Failed to get server time for ${id}:`, error);
              // 继续执行，即使获取服务器时间失败
            }
            
            await StorageService.markDataSourceAsUploaded(id, serverUpdateTime);
          } catch (error) {
            console.error(`[UPLOAD] Failed to mark ${id} as uploaded in storage:`, error);
          }
        }
      }
      
      // 刷新数据源列表
      refreshDataSources();
      
      // 3秒后清除临时状态
      setTimeout(() => {
        setUploadStatuses(prev => {
          const newStatuses = new Map(prev);
          ids.forEach(id => newStatuses.delete(id));
          return newStatuses;
        });
      }, 3000);
    }, [refreshDataSources]);

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
                                id="data-search-input"
                                name="data-search-input"
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
                                           // 新的状态判断逻辑：
                                           // 1. LOCAL: 从未上传过服务器
                                           // 2. SYNCED: 最新数据已上传到服务器（没有本地新版本）
                                           // 3. Outdated: 服务器上有更新，但本地数据有更新（两个版本的情况）
                                           
                                           if (!ds.isUploaded) {
                                             // 从未上传过服务器
                                             return (
                                               <div className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 bg-blue-100 text-blue-700">
                                                 LOCAL
                                               </div>
                                             );
                                           } else if (ds.versions.length === 1) {
                                             // 只有一个版本且已上传
                                             return (
                                               <div className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 bg-green-100 text-green-700">
                                                 SYNCED
                                               </div>
                                             );
                                           } else if (ds.versions.length === 2) {
                                             // 有两个版本
                                             const hasLocalNewVersion = ds.versions.some(v => !v.status || v.status === 'local' || v.isOutdated);
                                             if (hasLocalNewVersion) {
                                               // 有本地新版本需要同步
                                               return (
                                                 <div className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 bg-orange-100 text-orange-700">
                                                   Outdated
                                                 </div>
                                               );
                                             } else {
                                               // 两个版本都已上传
                                               return (
                                                 <div className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 bg-green-100 text-green-700">
                                                   SYNCED
                                                 </div>
                                               );
                                             }
                                           } else {
                                             // 默认情况（不应该发生）
                                             return (
                                               <div className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 bg-blue-100 text-blue-700">
                                                 LOCAL
                                               </div>
                                             );
                                           }
                                         })()}
                                    </div>
                                    <div className="ml-6 mt-1 flex items-center gap-2 flex-wrap">
                                        {ds.platform && (
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${getPlatformBadgeColor(ds.platform)}`}>
                                                {getPlatformDisplayName(ds.platform)}
                                            </span>
                                        )}
                                        {ds.isServerOnly && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 bg-orange-100 text-orange-700">
                                                Only In Server
                                            </span>
                                        )}
                                        <div className="text-[10px] text-slate-400 truncate">{ds.url}</div>
                                    </div>
                                    {/* Time display based on status - Two rows */}
                                    {(() => {
                                      // 根据状态显示时间（两行显示）
                                      if (!ds.isUploaded) {
                                        // LOCAL 状态：只显示存储时间
                                        return (
                                          <div className="ml-6 mt-1 flex flex-col gap-0.5 text-[10px] text-slate-500">
                                            <div>Saved: {ds.lastSaved}</div>
                                          </div>
                                        );
                                      } else if (ds.versions.length === 1) {
                                        // SYNCED 状态（单个版本）：显示存储时间和上传时间
                                        return (
                                          <div className="ml-6 mt-1 flex flex-col gap-0.5 text-[10px] text-slate-500">
                                            <div>Saved: {ds.lastSaved}</div>
                                            {ds.serverUpdateTime && (
                                              <div>Synced: {ds.serverUpdateTime}</div>
                                            )}
                                          </div>
                                        );
                                      } else if (ds.versions.length === 2) {
                                        // Outdated 或 SYNCED 状态（两个版本）：显示存储时间和上传时间
                                        // ds.lastSaved 是最新本地版本的保存时间
                                        return (
                                          <div className="ml-6 mt-1 flex flex-col gap-0.5 text-[10px] text-slate-500">
                                            <div>Saved: {ds.lastSaved}</div>
                                            {ds.serverUpdateTime && (
                                              <div>Synced: {ds.serverUpdateTime}</div>
                                            )}
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-end mt-3 pt-2 border-t border-slate-50 pl-7">
                                {/* Item Actions - Always on the right */}
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
                                      <div title="Upload successful">
                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                      </div>
                                    )}
                                    {uploadStatuses.get(ds.id)?.status === 'failed' && (
                                      <div title={uploadStatuses.get(ds.id)?.error || "Upload failed"}>
                                        <XCircle className="w-4 h-4 text-red-600" />
                                      </div>
                                    )}
                                    {(!uploadStatuses.get(ds.id) || uploadStatuses.get(ds.id)?.status === 'idle') && (
                                      <button 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const ids = [ds.id];
                                          handleUploadStart(ids);
                                          try {
                                            const { uploadDataSources } = await import('../../services/upload-service');
                                            const result = await uploadDataSources(
                                              ids,
                                              undefined, // Overall progress not needed for single item
                                              (id, itemProgress) => {
                                                handleUploadProgress(id, itemProgress);
                                              }
                                            );
                                            handleUploadComplete(ids, result.success);
                                          } catch (error) {
                                            console.error('[UPLOAD] Failed to upload:', error);
                                            handleUploadComplete(ids, false);
                                          }
                                        }}
                                        disabled={ds.versions.length === 1 && ds.isUploaded && !ds.versions.some(v => !v.status || v.status === 'local') || uploadStatuses.get(ds.id)?.status === 'uploading'}
                                        className={`p-1 rounded transition-colors ${(ds.versions.length === 1 && ds.isUploaded && !ds.versions.some(v => !v.status || v.status === 'local')) ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'}`}
                                        title={(ds.versions.length === 1 && ds.isUploaded && !ds.versions.some(v => !v.status || v.status === 'local')) ? "Already Synced" : "Upload to Server"}
                                      >
                                          <Cloud size={14} />
                                      </button>
                                    )}
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
                         <button 
                           onClick={async () => {
                             const ids = Array.from(selectedDataIds);
                             handleUploadStart(ids);
                             try {
                               const { uploadDataSources } = await import('../../services/upload-service');
                               const result = await uploadDataSources(
                                 ids,
                                 undefined, // Overall progress not needed
                                 (id, itemProgress) => {
                                   handleUploadProgress(id, itemProgress);
                                 }
                               );
                               handleUploadComplete(ids, result.success);
                             } catch (error) {
                               console.error('[UPLOAD] Failed to upload:', error);
                               handleUploadComplete(ids, false);
                             }
                           }}
                           className="px-2 py-1 hover:bg-white/20 rounded text-xs flex items-center gap-1"
                         >
                             <Cloud size={12} /> Upload
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
                <div className="absolute inset-0 bg-black/50 z-50 flex justify-end" style={{ pointerEvents: 'auto' }}>
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
                                 setPreviewContentOld(null);
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

  const HistoryView = () => (
      <div className="h-full bg-slate-50 p-4 overflow-y-auto">
          <div className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Previous Sessions</div>
          <div className="space-y-3">
              {/* No history available - mock data removed */}
              <div className="text-center py-8 text-slate-400 text-sm">
                No previous sessions. Start a conversation to see history here.
              </div>
          </div>
      </div>
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-slate-50 relative overflow-hidden group" style={{ pointerEvents: 'auto' }}>
      {/* Toast Notification - Positioned at bottom to ensure visibility */}
      {toastMessage && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 max-w-md">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-blue-500 hover:text-blue-700 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      
      {/* --- Top Panel (Primary) --- */}
      <div 
        className="flex flex-col flex-1 overflow-hidden min-h-0"
        style={{ pointerEvents: 'auto' }}
      >
         <PrimaryHeader 
           activeTab={activePrimaryTab}
           onTabChange={handleTabChange}
           onAuthChange={setAuthState}
         />
         <div className="flex-1 overflow-hidden relative flex flex-col" style={{ pointerEvents: 'auto' }}>
            {activePrimaryTab === 'chat' ? (
              <ChatView
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
              />
            ) : activePrimaryTab === 'data' ? (
              <DataView />
            ) : (
              <HistoryView />
            )}
         </div>
      </div>

      {/* --- Bottom Panel (Secondary Content) - Fixed at bottom, default collapsed --- */}
      <div 
        className="bg-white border-t border-slate-200 flex flex-col shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] transition-[height] duration-200 ease-out shrink-0"
        style={{ 
          height: secondaryHeight > 0 ? `${secondaryHeight}%` : '48px',
          minHeight: '48px',
          maxHeight: '90%'
        }}
      >
          {/* --- Top Control Bar: Resize Handle + Collapse Button --- */}
          {secondaryHeight > 0 && (
            <div className="h-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 z-10">
              {/* Resize Handle Area - Left side, takes most space */}
              <div 
                onMouseDown={handleResizeStart}
                className="flex-1 h-full cursor-row-resize flex items-center justify-center transition-colors hover:bg-slate-100"
              >
                <div className="w-16 h-1 rounded-full bg-slate-300"></div>
              </div>
              {/* Collapse Button - Right side */}
              <button
                onClick={() => setSecondaryHeight(0)}
                className="h-full w-8 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Collapse panel"
              >
                <ChevronDown size={16} className="m-0" />
              </button>
            </div>
          )}

          {/* --- Persistent Bottom Tab Bar (Inside panel, above content, always visible) --- */}
          <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-around shrink-0 z-20">
            <button onClick={() => switchSecondaryTab('mvg')} className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${activeSecondaryTab === 'mvg' && secondaryHeight > 0 ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                <Network size={18} /><span className="text-[10px] font-medium">Graph</span>
            </button>
            <button onClick={() => switchSecondaryTab('data')} className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${activeSecondaryTab === 'data' && secondaryHeight > 0 ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                <Database size={18} /><span className="text-[10px] font-medium">Smart Data</span>
            </button>
            <button onClick={() => switchSecondaryTab('resources')} className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${activeSecondaryTab === 'resources' && secondaryHeight > 0 ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                <FileText size={18} /><span className="text-[10px] font-medium">Resources</span>
            </button>
          </div>

          {/* Secondary Header (Collapsible) - Only show when expanded */}
          {secondaryHeight > 0 && (
          <div className="h-8 border-b border-slate-100 flex items-center justify-between px-2 bg-slate-50 shrink-0">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2">
                 {activeSecondaryTab === 'mvg' && "Knowledge Graph"}
                 {activeSecondaryTab === 'data' && "Structured Output"}
                 {activeSecondaryTab === 'resources' && "Resources"}
             </div>
             {/* Copy button for Structured Output */}
             {activeSecondaryTab === 'data' && structuredOutput && (
               <div className="flex items-center gap-2">
                 {copySuccess && (
                   <span className="text-xs text-green-600 font-medium animate-fade-in">
                     复制成功
                   </span>
                 )}
                 <button
                   onClick={handleCopyStructuredOutput}
                   className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                   title="Copy to clipboard"
                 >
                   {copySuccess ? (
                     <Check size={14} className="text-green-600" />
                   ) : (
                     <Copy size={14} />
                   )}
                 </button>
               </div>
             )}
          </div>
          )}

          {/* Secondary Content Area - Only show when expanded */}
          {secondaryHeight > 0 && (
          <div className="flex-1 overflow-hidden relative">
             {activeSecondaryTab === 'mvg' && (
                 <div className="w-full h-full p-2 bg-slate-50">
                     {mvgData ? (
                         <GraphView 
                            mvgData={mvgData}
                            activeNodeId={highlightedNode}
                            onNodeClick={handleGraphNodeClick} 
                         />
                     ) : (
                         <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                           No graph data available. Use the chat feature to generate a knowledge graph.
                         </div>
                     )}
                 </div>
             )}

             {activeSecondaryTab === 'data' && (
                 <div className="flex flex-col h-full">
                     {structuredOutput ? (
                         <StructuredOutput data={structuredOutput} />
                     ) : (
                         <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                             No structured output available. Use the chat feature to generate structured output.
                         </div>
                     )}
                 </div>
             )}

             {activeSecondaryTab === 'resources' && (
                 <div className="w-full h-full">
                     {relevantSessions.length > 0 ? (
                         <RelevantSessionsList 
                             sessions={relevantSessions}
                             onSessionClick={(session) => {
                                 if (session.url) {
                                     window.open(session.url, '_blank');
                                 }
                             }}
                         />
                     ) : (
                         <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                             No relevant sessions found. Use the chat feature to generate resources.
                         </div>
                     )}
                 </div>
             )}
          </div>
          )}
      </div>

    </div>
  );
};