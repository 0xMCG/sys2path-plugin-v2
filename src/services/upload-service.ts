// 上传服务 - 实现数据上传功能
import { apiService } from './api';
import {
  convertConversationToRequest,
  convertPageContentToRequest,
  convertConversationsToRequests,
  convertPageContentsToRequests,
} from './data-converter';
import type { ChatLLMConversation, GeneralPageContent } from '../types/capture';
import type { AddSessionResponse } from '../types/api';
import { StorageService } from './storage';

export interface UploadProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
}

export interface UploadResult {
  success: boolean;
  message: string;
  uploadedCount: number;
  failedCount: number;
  lastMessageIds?: Record<string, string>;
  processingTime?: number;
}

/**
 * 上传单个会话
 */
export async function uploadSession(
  conversation: ChatLLMConversation,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  try {
    onProgress?.({
      total: 1,
      completed: 0,
      failed: 0,
      current: conversation.title,
    });

    const request = convertConversationToRequest(conversation);
    const response: AddSessionResponse = await apiService.addSessions([request]);

    onProgress?.({
      total: 1,
      completed: 1,
      failed: 0,
    });

    return {
      success: response.success,
      message: response.message,
      uploadedCount: 1,
      failedCount: 0,
      lastMessageIds: response.last_message_id,
      processingTime: response.processing_time_seconds,
    };
  } catch (error) {
    console.error('[UPLOAD] Failed to upload session:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Upload failed',
      uploadedCount: 0,
      failedCount: 1,
    };
  }
}

/**
 * 上传单个页面内容
 */
export async function uploadPageContent(
  content: GeneralPageContent,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  try {
    onProgress?.({
      total: 1,
      completed: 0,
      failed: 0,
      current: content.title,
    });

    const request = convertPageContentToRequest(content);
    const response: AddSessionResponse = await apiService.addSessions([request]);

    onProgress?.({
      total: 1,
      completed: 1,
      failed: 0,
    });

    return {
      success: response.success,
      message: response.message,
      uploadedCount: 1,
      failedCount: 0,
      lastMessageIds: response.last_message_id,
      processingTime: response.processing_time_seconds,
    };
  } catch (error) {
    console.error('[UPLOAD] Failed to upload page content:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Upload failed',
      uploadedCount: 0,
      failedCount: 1,
    };
  }
}

/**
 * 批量上传多个会话
 */
export async function uploadSessions(
  conversations: ChatLLMConversation[],
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  if (conversations.length === 0) {
    return {
      success: false,
      message: 'No conversations to upload',
      uploadedCount: 0,
      failedCount: 0,
    };
  }

  try {
    onProgress?.({
      total: conversations.length,
      completed: 0,
      failed: 0,
    });

    const requests = convertConversationsToRequests(conversations);
    const response: AddSessionResponse = await apiService.addSessions(requests);

    onProgress?.({
      total: conversations.length,
      completed: conversations.length,
      failed: 0,
    });

    return {
      success: response.success,
      message: response.message,
      uploadedCount: conversations.length,
      failedCount: 0,
      lastMessageIds: response.last_message_id,
      processingTime: response.processing_time_seconds,
    };
  } catch (error) {
    console.error('[UPLOAD] Failed to upload sessions:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Upload failed',
      uploadedCount: 0,
      failedCount: conversations.length,
    };
  }
}

/**
 * 批量上传多个页面内容
 */
export async function uploadPageContents(
  contents: GeneralPageContent[],
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  if (contents.length === 0) {
    return {
      success: false,
      message: 'No page contents to upload',
      uploadedCount: 0,
      failedCount: 0,
    };
  }

  try {
    onProgress?.({
      total: contents.length,
      completed: 0,
      failed: 0,
    });

    const requests = convertPageContentsToRequests(contents);
    const response: AddSessionResponse = await apiService.addSessions(requests);

    onProgress?.({
      total: contents.length,
      completed: contents.length,
      failed: 0,
    });

    return {
      success: response.success,
      message: response.message,
      uploadedCount: contents.length,
      failedCount: 0,
      lastMessageIds: response.last_message_id,
      processingTime: response.processing_time_seconds,
    };
  } catch (error) {
    console.error('[UPLOAD] Failed to upload page contents:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Upload failed',
      uploadedCount: 0,
      failedCount: contents.length,
    };
  }
}

/**
 * 上传选中的数据源（根据类型自动判断）
 */
export async function uploadDataSources(
  dataSourceIds: string[],
  onProgress?: (progress: UploadProgress) => void,
  onItemProgress?: (id: string, progress: number) => void
): Promise<UploadResult> {
  if (dataSourceIds.length === 0) {
    return {
      success: false,
      message: 'No data sources selected',
      uploadedCount: 0,
      failedCount: 0,
    };
  }

  try {
    // 获取所有conversations和page contents
    const allConversations = await StorageService.getAllConversations();
    const allPageContents = await StorageService.getAllPageContents();

    // 根据ID筛选需要上传的数据
    const conversationsToUpload: ChatLLMConversation[] = [];
    const contentsToUpload: GeneralPageContent[] = [];

    for (const id of dataSourceIds) {
      // 查找所有匹配的conversations（可能有多个版本）
      const matchingConvs = allConversations.filter(c => {
        const baseId = c.id.split('-').slice(0, -1).join('-') || c.id;
        return baseId === id || c.id === id;
      });
      
      if (matchingConvs.length > 0) {
        // 如果有多个版本，只上传最新的本地版本（未上传的版本）
        const localVersions = matchingConvs.filter(c => !c.isUploaded);
        if (localVersions.length > 0) {
          // 找到最新的本地版本
          const newestLocal = localVersions.reduce((newest, current) => 
            current.capturedAt > newest.capturedAt ? current : newest
          );
          conversationsToUpload.push(newestLocal);
        } else {
          // 如果没有本地版本，上传最新的已上传版本（这种情况不应该发生，但为了安全）
          const newest = matchingConvs.reduce((newest, current) => 
            current.capturedAt > newest.capturedAt ? current : newest
          );
          conversationsToUpload.push(newest);
        }
        continue;
      }

      // 查找所有匹配的page contents（可能有多个版本）
      const matchingContents = allPageContents.filter(p => {
        const baseId = p.id.split('-').slice(0, -1).join('-') || p.id;
        return baseId === id || p.id === id;
      });
      
      if (matchingContents.length > 0) {
        // 如果有多个版本，只上传最新的本地版本（未上传的版本）
        const localVersions = matchingContents.filter(c => !c.isUploaded);
        if (localVersions.length > 0) {
          // 找到最新的本地版本
          const newestLocal = localVersions.reduce((newest, current) => 
            current.capturedAt > newest.capturedAt ? current : newest
          );
          contentsToUpload.push(newestLocal);
        } else {
          // 如果没有本地版本，上传最新的已上传版本（这种情况不应该发生，但为了安全）
          const newest = matchingContents.reduce((newest, current) => 
            current.capturedAt > newest.capturedAt ? current : newest
          );
          contentsToUpload.push(newest);
        }
      }
    }

    const total = conversationsToUpload.length + contentsToUpload.length;
    let completed = 0;
    let failed = 0;

    onProgress?.({
      total,
      completed: 0,
      failed: 0,
    });

    // 上传conversations
    if (conversationsToUpload.length > 0) {
      for (let i = 0; i < conversationsToUpload.length; i++) {
        const conv = conversationsToUpload[i];
        const baseId = conv.id.split('-').slice(0, -1).join('-') || conv.id;
        const matchingId = dataSourceIds.find(id => {
          const idBase = id.split('-').slice(0, -1).join('-') || id;
          return baseId === idBase || conv.id === id;
        });
        
        if (matchingId) {
          onItemProgress?.(matchingId, 10); // 开始上传
        }
      }
      
      const convResult = await uploadSessions(conversationsToUpload, (progress) => {
        completed = progress.completed;
        failed = progress.failed;
        onProgress?.({
          total,
          completed,
          failed,
        });
        
        // 更新每个 item 的进度
        conversationsToUpload.forEach((conv, idx) => {
          const baseId = conv.id.split('-').slice(0, -1).join('-') || conv.id;
          const matchingId = dataSourceIds.find(id => {
            const idBase = id.split('-').slice(0, -1).join('-') || id;
            return baseId === idBase || conv.id === id;
          });
          if (matchingId) {
            const itemProgress = Math.min(90, 10 + (idx + 1) * 80 / conversationsToUpload.length);
            onItemProgress?.(matchingId, itemProgress);
          }
        });
      });
      
      // 标记完成
      conversationsToUpload.forEach((conv) => {
        const baseId = conv.id.split('-').slice(0, -1).join('-') || conv.id;
        const matchingId = dataSourceIds.find(id => {
          const idBase = id.split('-').slice(0, -1).join('-') || id;
          return baseId === idBase || conv.id === id;
        });
        if (matchingId) {
          onItemProgress?.(matchingId, convResult.success ? 100 : 0);
        }
      });
      
      if (!convResult.success) {
        failed += convResult.failedCount;
      }
    }

    // 上传page contents
    if (contentsToUpload.length > 0) {
      for (let i = 0; i < contentsToUpload.length; i++) {
        const content = contentsToUpload[i];
        const baseId = content.id.split('-').slice(0, -1).join('-') || content.id;
        const matchingId = dataSourceIds.find(id => {
          const idBase = id.split('-').slice(0, -1).join('-') || id;
          return baseId === idBase || content.id === id;
        });
        
        if (matchingId) {
          onItemProgress?.(matchingId, 10); // 开始上传
        }
      }
      
      const contentResult = await uploadPageContents(contentsToUpload, (progress) => {
        completed += progress.completed;
        failed += progress.failed;
        onProgress?.({
          total,
          completed,
          failed,
        });
        
        // 更新每个 item 的进度
        contentsToUpload.forEach((content, idx) => {
          const baseId = content.id.split('-').slice(0, -1).join('-') || content.id;
          const matchingId = dataSourceIds.find(id => {
            const idBase = id.split('-').slice(0, -1).join('-') || id;
            return baseId === idBase || content.id === id;
          });
          if (matchingId) {
            const itemProgress = Math.min(90, 10 + (idx + 1) * 80 / contentsToUpload.length);
            onItemProgress?.(matchingId, itemProgress);
          }
        });
      });
      
      // 标记完成
      contentsToUpload.forEach((content) => {
        const baseId = content.id.split('-').slice(0, -1).join('-') || content.id;
        const matchingId = dataSourceIds.find(id => {
          const idBase = id.split('-').slice(0, -1).join('-') || id;
          return baseId === idBase || content.id === id;
        });
        if (matchingId) {
          onItemProgress?.(matchingId, contentResult.success ? 100 : 0);
        }
      });
      
      if (!contentResult.success) {
        failed += contentResult.failedCount;
      }
    }

    return {
      success: failed === 0,
      message: `Uploaded ${completed} items, ${failed} failed`,
      uploadedCount: completed,
      failedCount: failed,
    };
  } catch (error) {
    console.error('[UPLOAD] Failed to upload data sources:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Upload failed',
      uploadedCount: 0,
      failedCount: dataSourceIds.length,
    };
  }
}

