// 设置对话框组件
import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, Loader2, Wifi, WifiOff, Settings, ExternalLink } from 'lucide-react';
import { authService, type AuthState } from '../../services/auth-service';
import { configService, type AppMode } from '../../services/config-service';
import type { OAuthProvider } from '../../types/api';
import { useConnectionStatus } from '../hooks/useConnectionStatus';

export const SettingsDialog: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [mode, setMode] = useState<AppMode>('user');
  const [apiUrl, setApiUrl] = useState('');
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const connectionStatus = useConnectionStatus();

  // 加载初始状态
  useEffect(() => {
    loadInitialState();
  }, []);

  const loadInitialState = async () => {
    try {
      // 加载认证状态
      const auth = await authService.getAuthState();
      setAuthState(auth);

      // 加载配置
      const config = await configService.getConfig();
      setMode(config.mode);
      setApiUrl(config.apiUrl);
      setOverlayEnabled(config.overlayWidgetEnabled);
    } catch (error) {
      console.error('[SETTINGS] Failed to load initial state:', error);
    }
  };

  const handleLogin = async (provider: OAuthProvider) => {
    setIsLoading(true);
    setShowLoginMenu(false);
    
    try {
      const newState = await authService.login(provider);
      setAuthState(newState);
    } catch (error) {
      console.error('[SETTINGS] Login failed:', error);
      alert(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      const newState = await authService.getAuthState();
      setAuthState(newState);
    } catch (error) {
      console.error('[SETTINGS] Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = async (newMode: AppMode) => {
    setIsSaving(true);
    try {
      await configService.setMode(newMode);
      const config = await configService.getConfig();
      setMode(config.mode);
      setApiUrl(config.apiUrl);
    } catch (error) {
      console.error('[SETTINGS] Failed to change mode:', error);
      alert('Failed to change mode. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApiUrlChange = async (newUrl: string) => {
    setApiUrl(newUrl);
    if (mode === 'dev') {
      setIsSaving(true);
      try {
        await configService.setApiUrl(newUrl);
      } catch (error) {
        console.error('[SETTINGS] Failed to update API URL:', error);
        alert('Invalid URL format. Please enter a valid URL.');
        // 恢复原值
        const config = await configService.getConfig();
        setApiUrl(config.apiUrl);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleOverlayToggle = async () => {
    const newValue = !overlayEnabled;
    setIsSaving(true);
    try {
      await configService.setOverlayWidgetEnabled(newValue);
      setOverlayEnabled(newValue);
      
      // 通知所有标签页更新悬浮弹窗状态
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'TOGGLE_OVERLAY_WIDGET',
              enabled: newValue
            }).catch(() => {
              // 忽略错误（某些标签页可能没有content script）
            });
          }
        });
      });
    } catch (error) {
      console.error('[SETTINGS] Failed to toggle overlay:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDashboard = () => {
    const url = chrome.runtime.getURL('dashboard.html');
    chrome.tabs.create({ url });
  };

  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case 'checking':
        return (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Checking...</span>
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <Wifi className="w-3 h-3" />
            <span>Connected</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center gap-1.5 text-xs text-red-600">
            <WifiOff className="w-3 h-3" />
            <span>Disconnected</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden" style={{ width: '420px', minWidth: '420px' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-white" />
          <h2 className="text-white font-semibold text-sm">Sys2Path Settings</h2>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 登录/注销区域 */}
        <div className="border-b border-gray-200 pb-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : authState.isAuthenticated && authState.user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {authState.user.avatar_url ? (
                  <img
                    src={authState.user.avatar_url}
                    alt={authState.user.username || authState.user.email}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                    {(authState.user.full_name || authState.user.username || authState.user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {authState.user.full_name || authState.user.username}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {authState.user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowLoginMenu(!showLoginMenu)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </button>

              {showLoginMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowLoginMenu(false)}
                    style={{ pointerEvents: 'auto' }}
                  />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-md shadow-lg border border-gray-200 z-50" style={{ pointerEvents: 'auto' }}>
                    <div className="p-2">
                      <p className="text-xs text-gray-500 mb-2 px-2">Login with:</p>
                      <button
                        onClick={() => handleLogin('google')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors mb-1"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        <span>Google</span>
                      </button>
                      <button
                        onClick={() => handleLogin('github')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors mb-1"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        <span>GitHub</span>
                      </button>
                      <button
                        onClick={() => handleLogin('twitter')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <svg className="w-5 h-5" fill="#1DA1F2" viewBox="0 0 24 24">
                          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                        </svg>
                        <span>Twitter</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 功能按钮区域 */}
        <div className="space-y-2 border-b border-gray-200 pb-4">
          {/* 悬浮弹窗开关 */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Floating Widget</p>
              <p className="text-xs text-gray-500">Show/hide the floating save button</p>
            </div>
            <button
              onClick={handleOverlayToggle}
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                overlayEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  overlayEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 全局页面按钮 */}
          <button
            onClick={handleOpenDashboard}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Dashboard</span>
          </button>
        </div>

        {/* 模式切换区域 */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Mode</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange('user')}
                disabled={isSaving || mode === 'user'}
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  mode === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                User
              </button>
              <button
                onClick={() => handleModeChange('dev')}
                disabled={isSaving || mode === 'dev'}
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  mode === 'dev'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Dev
              </button>
            </div>
          </div>

          {/* API URL输入（仅开发模式） */}
          {mode === 'dev' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API URL
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => handleApiUrlChange(e.target.value)}
                disabled={isSaving}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="http://localhost:8000"
              />
            </div>
          )}

          {/* 连接状态 */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-gray-700">Connection Status</span>
            {getConnectionStatusDisplay()}
          </div>
        </div>
      </div>
    </div>
  );
};
