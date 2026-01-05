// 相关会话列表组件
import React from 'react';
import { ExternalLink, Clock } from 'lucide-react';
import type { RelevantSessionsResponse } from '../../types/api';

interface RelevantSessionsListProps {
  sessions: RelevantSessionsResponse[];
  onSessionClick?: (session: RelevantSessionsResponse) => void;
}

export const RelevantSessionsList: React.FC<RelevantSessionsListProps> = ({
  sessions,
  onSessionClick,
}) => {
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
          </div>
        ))}
      </div>
    </div>
  );
};

