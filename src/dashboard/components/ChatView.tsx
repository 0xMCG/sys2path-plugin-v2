import React, { useEffect, useRef } from 'react';
import { Network, Send, HelpCircle, CheckSquare } from 'lucide-react';
import type { Message } from '../../types';

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
  isWaitingResponse?: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
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
}) => {
  const isHeroMode = messages.length === 0;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isWaitingResponse]);
  
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
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0"
          >
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-slate-900 flex-shrink-0 flex items-center justify-center mt-1 shadow-sm">
                    <Network size={14} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}`}>
                  {msg.promptResponse ? (
                    <div className="space-y-4">
                      {/* Expanded Query - Main Content */}
                      <div className="text-slate-700">
                        {msg.promptResponse.expanded_query.split(/(\[.*?\])/g).map((part, idx) => {
                          if (part.startsWith('[') && part.endsWith(']')) {
                            const name = part.slice(1, -1);
                            return (
                              <button key={idx} onClick={onChatEntityLinkClick} className="mx-1 px-1.5 py-0.5 rounded text-sm font-medium transition-colors inline-flex items-center text-blue-600 bg-blue-50 hover:bg-blue-100">
                                {name}
                              </button>
                            );
                          }
                          return <span key={idx}>{part}</span>;
                        })}
                      </div>
                      
                      {/* Right Questions List */}
                      {msg.promptResponse.right_questions && msg.promptResponse.right_questions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="flex items-center gap-2 mb-3">
                            <HelpCircle size={16} className="text-blue-600" />
                            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Related Questions</span>
                          </div>
                          <ul className="space-y-2 ml-6">
                            {msg.promptResponse.right_questions.map((question, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-slate-600">
                                <span className="text-blue-500 mt-1">•</span>
                                <span>{question}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Action Items List */}
                      {msg.promptResponse.action_items && msg.promptResponse.action_items.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckSquare size={16} className="text-green-600" />
                            <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Action Items</span>
                          </div>
                          <ul className="space-y-2 ml-6">
                            {msg.promptResponse.action_items.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-slate-600">
                                <span className="text-green-500 mt-1">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Fallback to original content rendering
                    msg.content.split(/(\[.*?\])/g).map((part, idx) => {
                      if (part.startsWith('[') && part.endsWith(']')) {
                        const name = part.slice(1, -1);
                        return (
                          <button key={idx} onClick={onChatEntityLinkClick} className={`mx-1 px-1.5 py-0.5 rounded text-sm font-medium transition-colors inline-flex items-center ${msg.role === 'user' ? 'bg-blue-500 text-white hover:bg-blue-400' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}>
                            {name}
                          </button>
                        );
                      }
                      return <span key={idx}>{part}</span>;
                    })
                  )}
                </div>
              </div>
            ))}
            {isWaitingResponse && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-slate-900 flex-shrink-0 flex items-center justify-center mt-1 shadow-sm">
                  <Network size={14} className="text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-sm text-slate-500 ml-2">正在思考...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4"></div>
          </div>
          <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex-shrink-0">
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
              <button onClick={onSendClick} className="absolute right-2 top-2 p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors">
                <Send size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
