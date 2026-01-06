// OAuth登录服务
import { apiService } from './api';
import type { OAuthProvider } from '../types/api';

export interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  token: string | null;
}

class AuthService {
  private popup: Window | null = null;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * 打开OAuth登录popup窗口
   */
  async login(provider: OAuthProvider): Promise<AuthState> {
    return new Promise((resolve, reject) => {
      // 获取登录URL
      const loginUrl = apiService.getOAuthLoginUrl(provider);

      // 打开popup窗口
      this.popup = window.open(
        loginUrl,
        'oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!this.popup) {
        reject(new Error('Failed to open popup window. Please allow popups for this site.'));
        return;
      }

      let resolved = false;

      // 添加 postMessage 监听器（主要方式）
      const messageHandler = async (event: MessageEvent) => {
        // 验证消息类型
        if (event.data && event.data.type === 'OAUTH_CALLBACK') {
          try {
            const { access_token, user } = event.data;
            
            if (!access_token) {
              throw new Error('No access token received');
            }
            
            // 检测用户切换
            const oldUserInfo = await apiService.getUserInfo();
            const newUserId = user.id;
            
            if (oldUserInfo && oldUserInfo.id && oldUserInfo.id !== newUserId) {
              console.log('[AUTH] User switched from', oldUserInfo.id, 'to', newUserId);
              // 不清理旧用户数据，保留多用户数据
            }
            
            // 存储token和用户信息
            await apiService.setAuthToken(access_token);
            await apiService.setUserInfo(user);
            
            const authState: AuthState = {
              isAuthenticated: true,
              user: user,
              token: access_token,
            };
            
            // 清理
            window.removeEventListener('message', messageHandler);
            this.cleanup();
            
            if (!resolved) {
              resolved = true;
              resolve(authState);
            }
          } catch (error: any) {
            window.removeEventListener('message', messageHandler);
            this.cleanup();
            if (!resolved) {
              resolved = true;
              reject(error);
            }
          }
        } else if (event.data && event.data.type === 'OAUTH_ERROR') {
          window.removeEventListener('message', messageHandler);
          this.cleanup();
          if (!resolved) {
            resolved = true;
            reject(new Error(event.data.error || 'OAuth error'));
          }
        }
      };
      
      // 注册消息监听器
      window.addEventListener('message', messageHandler);

      // 监听popup窗口的URL变化（备用方案，用于检测窗口关闭）
      this.checkInterval = setInterval(() => {
        if (this.popup?.closed) {
          this.cleanup();
          window.removeEventListener('message', messageHandler);
          if (!resolved) {
            resolved = true;
            reject(new Error('Login cancelled or popup closed'));
          }
          return;
        }
      }, 500);

      // 设置超时
      setTimeout(() => {
        if (!resolved && this.popup && !this.popup.closed) {
          window.removeEventListener('message', messageHandler);
          resolved = true;
          this.cleanup();
          reject(new Error('Login timeout'));
        }
      }, 5 * 60 * 1000); // 5分钟超时
    });
  }


  /**
   * 登出
   */
  async logout(): Promise<void> {
    await apiService.clearAuth();
  }

  /**
   * 获取当前认证状态
   */
  async getAuthState(): Promise<AuthState> {
    const token = await apiService.getAuthToken();
    const user = await apiService.getUserInfo();

    return {
      isAuthenticated: !!token,
      user,
      token,
    };
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.popup = null;
  }
}

// 导出单例
export const authService = new AuthService();

