// API服务层 - 封装所有后端API调用
import { API_CONFIG, STORAGE_KEYS } from '../config/api';
import type {
  AddSessionsRequest,
  AddSessionResponse,
  VisualizeMVGRequest,
  VisualizeMVGResponse,
  GetSessionsRequest,
  GetSessionsResponse,
  OAuthProvider,
  ApiError,
  ResponseBase
} from '../types/api';

class ApiService {
  private baseUrl: string;
  private apiPrefix: string;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.apiPrefix = API_CONFIG.API_PREFIX;
  }

  /**
   * 获取存储的认证token
   */
  async getAuthToken(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH_TOKEN);
      const token = result[STORAGE_KEYS.AUTH_TOKEN];
      return typeof token === 'string' ? token : null;
    } catch (error) {
      console.error('[API] Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * 存储认证token
   */
  async setAuthToken(token: string): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_TOKEN]: token });
    } catch (error) {
      console.error('[API] Failed to set auth token:', error);
      throw error;
    }
  }

  /**
   * 清除认证信息
   */
  async clearAuth(): Promise<void> {
    try {
      await chrome.storage.local.remove([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_INFO]);
    } catch (error) {
      console.error('[API] Failed to clear auth:', error);
      throw error;
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(): Promise<any | null> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.USER_INFO);
      return result[STORAGE_KEYS.USER_INFO] || null;
    } catch (error) {
      console.error('[API] Failed to get user info:', error);
      return null;
    }
  }

  /**
   * 存储用户信息
   */
  async setUserInfo(userInfo: any): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.USER_INFO]: userInfo });
    } catch (error) {
      console.error('[API] Failed to set user info:', error);
      throw error;
    }
  }

  /**
   * 构建完整的API URL
   */
  private getApiUrl(endpoint: string): string {
    return `${this.baseUrl}${this.apiPrefix}${endpoint}`;
  }

  /**
   * 通用API请求方法
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 合并已有的headers
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    // 如果有token，添加到header
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = this.getApiUrl(endpoint);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // 处理401未授权错误
      if (response.status === 401) {
        await this.clearAuth();
        throw new Error('Unauthorized. Please login again.');
      }

      // 处理其他HTTP错误
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData: ApiError = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // 如果响应不是JSON，使用默认错误消息
        }
        throw new Error(errorMessage);
      }

      // 解析JSON响应
      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        // 网络错误或其他错误
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error('Network error. Please check your connection and ensure the backend server is running.');
        }
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  /**
   * OAuth登录 - 返回登录URL
   */
  getOAuthLoginUrl(provider: OAuthProvider): string {
    return this.getApiUrl(`${API_CONFIG.ENDPOINTS.AUTH.LOGIN}/${provider}`);
  }

  /**
   * 添加会话到CKG
   */
  async addSessions(sessions: AddSessionsRequest[]): Promise<AddSessionResponse> {
    return this.request<AddSessionResponse>(
      API_CONFIG.ENDPOINTS.CKG.ADD_SESSIONS,
      {
        method: 'POST',
        body: JSON.stringify(sessions),
      }
    );
  }

  /**
   * 可视化MVG
   */
  async visualizeMVG(request: VisualizeMVGRequest): Promise<VisualizeMVGResponse> {
    return this.request<VisualizeMVGResponse>(
      API_CONFIG.ENDPOINTS.CKG.VISUALIZE_MVG,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * 获取会话列表
   */
  async getSessions(request: GetSessionsRequest): Promise<GetSessionsResponse> {
    const params = new URLSearchParams({
      page: request.page.toString(),
      page_size: request.page_size.toString(),
    });
    
    if (request.platform) {
      params.append('platform', request.platform);
    }

    return this.request<GetSessionsResponse>(
      `${API_CONFIG.ENDPOINTS.CKG.GET_SESSIONS}?${params.toString()}`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * 删除整个用户的 CKG
   */
  async deleteUserCKG(): Promise<ResponseBase> {
    return this.request<ResponseBase>(
      API_CONFIG.ENDPOINTS.CKG.DELETE_USER_CKG,
      {
        method: 'POST',
      }
    );
  }

  /**
   * 删除单个 session 的 CKG
   */
  async deleteSessionCKG(sessionId: string): Promise<ResponseBase> {
    return this.request<ResponseBase>(
      `${API_CONFIG.ENDPOINTS.CKG.DELETE_SESSION_CKG}?session_id=${encodeURIComponent(sessionId)}`,
      {
        method: 'POST',
      }
    );
  }
}

// 导出单例
export const apiService = new ApiService();

