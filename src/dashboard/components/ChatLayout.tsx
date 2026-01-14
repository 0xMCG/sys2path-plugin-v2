import React, { useState, useCallback, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import GraphView from '../../sidebar/components/GraphView';
import { StructuredOutput } from '../../sidebar/components/StructuredOutput';
import { RelevantSessionsList } from '../../sidebar/components/RelevantSessionsList';
import { ChatView } from './ChatView';
import { ResizableDivider } from './ResizableDivider';
import type { Message } from '../../types';
import type { MVGResponse, RelevantSessionsResponse } from '../../types/api';

interface ChatLayoutProps {
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
  isWaitingResponse?: boolean;
  mvgData: MVGResponse | null;
  structuredOutput: string | null;
  relevantSessions: RelevantSessionsResponse[];
  highlightedNode: string | null;
  onGraphNodeClick: (nodeId: string) => void;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({
  messages,
  inputText,
  onInputChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onSendClick,
  onChatEntityLinkClick,
  heroInputRef,
  replyInputRef,
  isWaitingResponse = false,
  mvgData,
  structuredOutput,
  relevantSessions,
  highlightedNode,
  onGraphNodeClick,
}) => {
  // Resizable state
  const [middleWidth, setMiddleWidth] = useState(70); // Percentage
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Copy state
  const [copySuccess, setCopySuccess] = useState(false);

  // Transform structured output (similar to Workbench)
  const transformedStructuredOutput = useMemo(() => {
    if (!structuredOutput || !mvgData?.nodes) return structuredOutput;
    
    try {
      const parsedData = JSON.parse(structuredOutput);
      const entityIdToName = new Map<string, string>();
      mvgData.nodes.forEach(node => {
        entityIdToName.set(node.id, node.label);
      });

      const transformed: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsedData)) {
        let newKey = key;
        if (key.includes('_')) {
          const underscoreIndex = key.indexOf('_');
          if (underscoreIndex > 0) {
            const part1 = key.substring(0, underscoreIndex);
            const part2 = key.substring(underscoreIndex + 1);
            
            if (part1.includes('-') && part2.includes('-') && 
                part1.length > 20 && part2.length > 20) {
              const name1 = entityIdToName.get(part1) || part1;
              const name2 = entityIdToName.get(part2) || part2;
              newKey = `${name1} → ${name2}`;
            }
          }
        }

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const valueObj = value as Record<string, any>;
          const transformedValue: Record<string, any> = {};
          
          for (const [propKey, propValue] of Object.entries(valueObj)) {
            transformedValue[propKey] = propValue;
          }
          
          if (Array.isArray(transformedValue.path)) {
            transformedValue.path = transformedValue.path.map((id: string) => {
              return entityIdToName.get(id) || id;
            });
          }
          
          transformed[newKey] = transformedValue;
        } else {
          transformed[newKey] = value;
        }
      }

      return JSON.stringify(transformed, null, 2);
    } catch (error) {
      console.error('[CHAT_LAYOUT] Failed to transform structured output:', error);
      return structuredOutput;
    }
  }, [structuredOutput, mvgData]);

  // Handle resize
  const handleResize = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const deltaPercent = (delta / containerWidth) * 100;
    setMiddleWidth(prev => {
      const newWidth = prev + deltaPercent;
      return Math.min(Math.max(newWidth, 30), 85);
    });
  }, []);

  // Copy handler
  const handleCopyStructuredOutput = useCallback(async () => {
    const dataToCopy = transformedStructuredOutput || structuredOutput;
    if (!dataToCopy) return;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(dataToCopy);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
        return;
      }
      
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = dataToCopy;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } else {
        alert('复制失败，请手动复制内容');
      }
    } catch (error) {
      console.error('[CHAT_LAYOUT] Copy failed:', error);
      alert('复制失败，请手动复制内容');
    }
  }, [transformedStructuredOutput, structuredOutput]);

  return (
    <div ref={containerRef} className="flex h-full">
      {/* Middle Area */}
      <div 
        className="flex flex-col gap-4 p-4 overflow-hidden"
        style={{ width: `${middleWidth}%` }}
      >
        {/* Top: Graph (70%) */}
        <div 
          className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
          style={{ height: '70%' }}
        >
          {mvgData ? (
            <GraphView
              mvgData={mvgData}
              activeNodeId={highlightedNode}
              onNodeClick={onGraphNodeClick}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              No graph data available. Use the chat feature to generate a knowledge graph.
            </div>
          )}
        </div>
        
        {/* Bottom: Smart Data and Resources (30%) */}
        <div 
          className="grid grid-cols-2 gap-4 overflow-hidden"
          style={{ height: '30%' }}
        >
          {/* Smart Data */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="h-8 border-b border-slate-100 flex items-center justify-between px-3 bg-slate-50 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Structured Output
              </span>
              {structuredOutput && (
                <div className="flex items-center gap-2">
                  {copySuccess && (
                    <span className="text-xs text-green-600 font-medium">
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
            <div className="flex-1 overflow-auto">
              {structuredOutput ? (
                <StructuredOutput data={structuredOutput} mvgData={mvgData} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm p-4">
                  No structured output available. Use the chat feature to generate structured output.
                </div>
              )}
            </div>
          </div>
          
          {/* Resources */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="h-8 border-b border-slate-100 flex items-center px-3 bg-slate-50 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Resources
              </span>
            </div>
            <div className="flex-1 overflow-auto">
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
                <div className="flex items-center justify-center h-full text-slate-400 text-sm p-4">
                  No relevant sessions found. Use the chat feature to generate resources.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Resizable Divider */}
      <ResizableDivider direction="vertical" onResize={handleResize} />
      
      {/* Right: Chatbox */}
      <div 
        className="border-l border-slate-200 bg-white overflow-hidden"
        style={{ width: `${100 - middleWidth}%` }}
      >
        <ChatView
          messages={messages}
          inputText={inputText}
          onInputChange={onInputChange}
          onKeyDown={onKeyDown}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onSendClick={onSendClick}
          onChatEntityLinkClick={onChatEntityLinkClick}
          heroInputRef={heroInputRef}
          replyInputRef={replyInputRef}
          isWaitingResponse={isWaitingResponse}
        />
      </div>
    </div>
  );
};
