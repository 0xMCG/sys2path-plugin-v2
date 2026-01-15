// 连接状态检测Hook
import { useState, useEffect, useRef } from 'react';
import { configService } from '../../services/config-service';
import { API_CONFIG } from '../../config/api';

export type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const consecutiveFailuresRef = useRef(0);
  const isCheckingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef<string>('');

  useEffect(() => {
    const checkConnection = async () => {
      // 防止并发请求
      if (isCheckingRef.current) {
        return;
      }

      isCheckingRef.current = true;
      
      try {
        const config = await configService.getConfig();
        const apiUrl = config.apiUrl;
        configRef.current = apiUrl;
        
        const pingUrl = `${apiUrl}${API_CONFIG.API_PREFIX}/ping`;
        console.log('[CONNECTION] Starting ping check...', pingUrl);

        // 使用 AbortController 实现超时，缩短超时时间到1秒
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const response = await fetch(pingUrl, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-cache',
          mode: 'cors',
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'ok') {
            setStatus('connected');
            consecutiveFailuresRef.current = 0;
          } else {
            setStatus('disconnected');
            consecutiveFailuresRef.current++;
          }
        } else {
          setStatus('disconnected');
          consecutiveFailuresRef.current++;
        }
      } catch (error: any) {
        console.log('[CONNECTION] Ping check failed:', error?.message || error);
        setStatus('disconnected');
        consecutiveFailuresRef.current++;
      } finally {
        isCheckingRef.current = false;
      }
    };

    // 固定检查间隔为5秒
    const getCheckInterval = () => {
      return 5000; // 每5秒检查一次
    };

    // 递归调度的检查函数
    const scheduleCheck = () => {
      const executeCheck = () => {
        checkConnection().then(() => {
          const interval = getCheckInterval();
          timeoutRef.current = setTimeout(scheduleCheck, interval);
        }).catch(() => {
          const interval = getCheckInterval();
          timeoutRef.current = setTimeout(scheduleCheck, interval);
        });
      };

      setTimeout(executeCheck, 200);
    };

    // 立即进行一次检查
    checkConnection().then(() => {
      scheduleCheck();
    }).catch(() => {
      scheduleCheck();
    });

    // 监听配置变更，立即重新检查
    const removeListener = configService.addListener((config) => {
      if (config.apiUrl !== configRef.current) {
        configRef.current = config.apiUrl;
        checkConnection();
      }
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      removeListener();
    };
  }, []);

  return status;
}
