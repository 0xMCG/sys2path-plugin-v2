// 配置服务 - 管理应用配置（模式、API URL、悬浮弹窗状态等）
export type AppMode = 'user' | 'dev';

export interface AppConfig {
  mode: AppMode;
  apiUrl: string;
  overlayWidgetEnabled: boolean;
}

const STORAGE_KEY = 'sys2path_app_config';

// 默认配置
const DEFAULT_CONFIG: AppConfig = {
  mode: 'user',
  apiUrl: 'https://ai-town.mcglobal.ai:9019',
  overlayWidgetEnabled: true,
};

// 开发模式默认URL
const DEV_DEFAULT_URL = 'http://localhost:8000';

class ConfigService {
  private config: AppConfig = DEFAULT_CONFIG;
  private listeners: Set<(config: AppConfig) => void> = new Set();

  constructor() {
    this.loadConfig();
    // 监听存储变化
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        this.loadConfig();
      }
    });
  }

  /**
   * 从存储加载配置
   */
  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        this.config = { ...DEFAULT_CONFIG, ...result[STORAGE_KEY] };
      } else {
        this.config = { ...DEFAULT_CONFIG };
      }
      this.notifyListeners();
    } catch (error) {
      console.error('[CONFIG] Failed to load config:', error);
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  /**
   * 保存配置到存储
   */
  private async saveConfig(): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: this.config });
      this.notifyListeners();
    } catch (error) {
      console.error('[CONFIG] Failed to save config:', error);
      throw error;
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (error) {
        console.error('[CONFIG] Listener error:', error);
      }
    });
  }

  /**
   * 获取当前配置
   */
  async getConfig(): Promise<AppConfig> {
    await this.loadConfig();
    return { ...this.config };
  }

  /**
   * 获取当前模式
   */
  async getMode(): Promise<AppMode> {
    const config = await this.getConfig();
    return config.mode;
  }

  /**
   * 获取当前API URL
   */
  async getApiUrl(): Promise<string> {
    const config = await this.getConfig();
    return config.apiUrl;
  }

  /**
   * 获取悬浮弹窗状态
   */
  async getOverlayWidgetEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.overlayWidgetEnabled;
  }

  /**
   * 设置模式
   */
  async setMode(mode: AppMode): Promise<void> {
    this.config.mode = mode;
    // 如果切换到开发模式且URL是用户模式的默认URL，则更新为开发模式默认URL
    if (mode === 'dev' && this.config.apiUrl === DEFAULT_CONFIG.apiUrl) {
      this.config.apiUrl = DEV_DEFAULT_URL;
    } else if (mode === 'user' && this.config.apiUrl === DEV_DEFAULT_URL) {
      // 如果切换到用户模式且URL是开发模式的默认URL，则更新为用户模式默认URL
      this.config.apiUrl = DEFAULT_CONFIG.apiUrl;
    }
    await this.saveConfig();
  }

  /**
   * 设置API URL（仅开发模式）
   */
  async setApiUrl(url: string): Promise<void> {
    // 验证URL格式
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }
    
    this.config.apiUrl = url;
    await this.saveConfig();
  }

  /**
   * 设置悬浮弹窗状态
   */
  async setOverlayWidgetEnabled(enabled: boolean): Promise<void> {
    this.config.overlayWidgetEnabled = enabled;
    await this.saveConfig();
  }

  /**
   * 更新整个配置
   */
  async updateConfig(updates: Partial<AppConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
  }

  /**
   * 重置为默认配置
   */
  async resetConfig(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.saveConfig();
  }

  /**
   * 添加配置变更监听器
   */
  addListener(listener: (config: AppConfig) => void): () => void {
    this.listeners.add(listener);
    // 返回移除函数
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// 导出单例
export const configService = new ConfigService();
