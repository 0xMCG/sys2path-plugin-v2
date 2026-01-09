// 相关会话列表组件
import React, { useState } from 'react';
import { ExternalLink, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import type { RelevantSessionsResponse } from '../../types/api';

interface RelevantSessionsListProps {
  sessions: RelevantSessionsResponse[];
  onSessionClick?: (session: RelevantSessionsResponse) => void;
}

export const RelevantSessionsList: React.FC<RelevantSessionsListProps> = ({
  sessions,
  onSessionClick,
}) => {
  // 跟踪哪些 session 的 chunks 已展开
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  // 跟踪哪些 chunk 的内容已展开（显示完整内容）
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  const toggleSessionExpansion = (sessionId: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const toggleChunkExpansion = (chunkId: string) => {
    setExpandedChunks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chunkId)) {
        newSet.delete(chunkId);
      } else {
        newSet.add(chunkId);
      }
      return newSet;
    });
  };

  // 高亮实体名称
  const highlightEntities = (content: string, entityNames: string[]): React.ReactNode => {
    if (entityNames.length === 0) {
      return content;
    }

    // 创建实体名称的正则表达式（按长度降序排序，避免短名称覆盖长名称）
    const sortedEntities = [...entityNames].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`(${sortedEntities.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      // 添加匹配前的文本
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      // 添加高亮的实体
      parts.push(
        <span key={match.index} className="bg-yellow-200 font-semibold text-yellow-900 px-0.5 rounded">
          {match[0]}
        </span>
      );
      lastIndex = pattern.lastIndex;
    }
    
    // 添加剩余文本
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : content;
  };

  // 截断文本（200字符）
  const truncateText = (text: string, maxLength: number = 200): string => {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  };
  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No relevant sessions found
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      chatgpt: 'bg-green-100 text-green-700',
      claude: 'bg-orange-100 text-orange-700',
      gemini: 'bg-blue-100 text-blue-700',
      grok: 'bg-black text-white',
      web: 'bg-gray-100 text-gray-700',
    };
    return colors[platform.toLowerCase()] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">
          Relevant Sessions ({sessions.length})
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Sessions ranked by relevance to your query
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.map((session) => (
          <div
            key={session.session_id}
            className="p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => onSessionClick?.(session)}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${getPlatformColor(
                      session.platform
                    )}`}
                  >
                    {session.platform}
                  </span>
                  <span className="text-xs text-gray-500">
                    Rank: {session.rank.toFixed(2)}
                  </span>
                </div>
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {session.title}
                </h4>
              </div>
              {session.url && (
                <a
                  href={session.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock size={12} />
              <span>{formatDate(session.update_time)}</span>
            </div>
            
            {/* Chunks 展示区域 */}
            {session.chunks && session.chunks.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSessionExpansion(session.session_id);
                  }}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors mb-2"
                >
                  {expandedSessions.has(session.session_id) ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                  <span>Related Chunks ({session.chunks.length})</span>
                </button>
                
                {expandedSessions.has(session.session_id) && (
                  <div className="space-y-2 ml-5">
                    {session.chunks.map((chunk, index) => {
                      const isChunkExpanded = expandedChunks.has(chunk.chunk_id);
                      const displayContent = isChunkExpanded 
                        ? chunk.content 
                        : truncateText(chunk.content);
                      const needsTruncation = chunk.content.length > 200;
                      
                      return (
                        <div
                          key={chunk.chunk_id}
                          className="p-2 bg-gray-50 rounded border border-gray-200 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700">
                                Chunk {index + 1}
                              </span>
                              {chunk.position !== undefined && chunk.position !== null && (
                                <span className="text-gray-500">
                                  (Position: {chunk.position})
                                </span>
                              )}
                            </div>
                            {needsTruncation && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleChunkExpansion(chunk.chunk_id);
                                }}
                                className="text-blue-600 hover:text-blue-800 text-xs"
                              >
                                {isChunkExpanded ? 'Show Less' : 'Show More'}
                              </button>
                            )}
                          </div>
                          
                          <div className="text-gray-700 mb-2 leading-relaxed">
                            {highlightEntities(displayContent, chunk.entity_names)}
                          </div>
                          
                          {chunk.entity_names.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              <span className="text-gray-500 text-xs">Entities:</span>
                              {chunk.entity_names.map((entityName, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                                >
                                  {entityName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

