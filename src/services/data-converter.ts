// 数据格式转换服务 - 将前端数据格式转换为后端API格式
import type { ChatLLMConversation, GeneralPageContent } from '../types/capture';
import type { AddSessionsRequest, Message } from '../types/api';

/**
 * 从版本化ID中提取baseId
 * 格式: {baseId}-{timestamp}
 */
function extractBaseId(versionedId: string): string {
  const parts = versionedId.split('-');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    // 检查最后一部分是否是时间戳（全数字且足够长）
    if (/^\d+$/.test(lastPart) && lastPart.length >= 10) {
      return parts.slice(0, -1).join('-');
    }
  }
  return versionedId;
}

/**
 * 生成MessageId
 * 使用消息内容的hash值作为MessageId
 * 注意：只基于 content，不包含 timestamp，确保相同内容总是生成相同的 MessageId
 */
export function generateMessageId(message: { content: string; timestamp: number }): string {
  // 只基于 content 生成 hash，不包含 timestamp
  // 这样相同内容总是生成相同的 MessageId，便于后端去重
  const str = message.content;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // 转换为正数并转为16进制
  return Math.abs(hash).toString(16);
}

/**
 * 将ChatLLMConversation转换为AddSessionsRequest
 */
export function convertConversationToRequest(
  conversation: ChatLLMConversation
): AddSessionsRequest {
  // 1. 提取session_id（从conversation.id中提取baseId）
  const sessionId = extractBaseId(conversation.id);

  // 2. 转换messages格式
  // 前端: { role, content, timestamp, messageId }
  // 后端: { MessageId, Content }
  // 使用已存储的 messageId，如果没有则生成（向后兼容）
  const messages: Message[] = conversation.messages.map(msg => ({
    MessageId: msg.messageId || generateMessageId(msg),
    Content: msg.content,
  }));

  // 3. 构建AddSessionsRequest
  return {
    platform: conversation.platform,
    title: conversation.title,
    session_id: sessionId,
    url: conversation.url,
    messages: messages,
  };
}

/**
 * 将GeneralPageContent转换为AddSessionsRequest
 * 将页面内容转换为一个包含单条system消息的session
 */
export function convertPageContentToRequest(
  content: GeneralPageContent
): AddSessionsRequest {
  // 提取session_id
  const sessionId = extractBaseId(content.id);

  // 将页面内容转换为一条system消息
  // 使用已存储的 messageId，如果没有则生成（向后兼容）
  const messageId = content.messageId || generateMessageId({
    content: content.content,
    timestamp: content.capturedAt,
  });

  return {
    platform: 'web', // 普通网页使用'web'作为平台标识
    title: content.title,
    session_id: sessionId,
    url: content.url,
    messages: [
      {
        MessageId: messageId,
        Content: content.content,
      },
    ],
  };
}

/**
 * 批量转换多个conversations
 */
export function convertConversationsToRequests(
  conversations: ChatLLMConversation[]
): AddSessionsRequest[] {
  return conversations.map(convertConversationToRequest);
}

/**
 * 批量转换多个page contents
 */
export function convertPageContentsToRequests(
  contents: GeneralPageContent[]
): AddSessionsRequest[] {
  return contents.map(convertPageContentToRequest);
}

