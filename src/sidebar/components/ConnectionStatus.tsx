// 后端连接状态组件
import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { API_CONFIG } from '../../config/api';
import { configService } from '../../services/config-service';

type ConnectionStatus = 'connected' | 'disconnected';

export const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const consecutiveFailuresRef = useRef(0);
  const isCheckingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef<string>('');

  useEffect(() => {
    const checkConnection = async () => {
      // 防止并发请求
      if (isCheckingRef.current) {
        console.log('[CONNECTION] Check already in progress, skipping...');
        return;
      }

      isCheckingRef.current = true;
      
      try {
        const config = await configService.getConfig();
        const apiUrl = config.apiUrl;
        configRef.current = apiUrl;
        const pingUrl = `${apiUrl}${API_CONFIG.API_PREFIX}/ping`;
        console.log('[CONNECTION] Starting ping check...', pingUrl);

        // 使用 AbortController 实现超时，增加到5秒以适应网络延迟和服务器负载
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(pingUrl, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-cache',
          mode: 'cors',
        });
        
        clearTimeout(timeoutId);
        
        console.log('[CONNECTION] Response received - status:', response.status, 'ok:', response.ok, 'statusText:', response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[CONNECTION] Response data:', data);
          console.log('[CONNECTION] Data status field:', data.status);
          
          if (data.status === 'ok') {
            console.log('[CONNECTION] Setting status to: connected');
            setStatus('connected');
            consecutiveFailuresRef.current = 0; // 成功即重置失败计数
            console.log('[CONNECTION] Status updated successfully to connected');
          } else {
            // 服务器返回非ok状态，计入失败计数
            console.log('[CONNECTION] Data status is not "ok", incrementing failure count. Status value:', data.status);
            consecutiveFailuresRef.current++;
            // 只有连续失败5次（25秒）才标记为disconnected
            if (consecutiveFailuresRef.current >= 5) {
              setStatus('disconnected');
            }
          }
        } else {
          // HTTP错误，计入失败计数
          console.log('[CONNECTION] Response not ok, incrementing failure count. Status:', response.status);
          consecutiveFailuresRef.current++;
          // 只有连续失败5次（25秒）才标记为disconnected
          if (consecutiveFailuresRef.current >= 5) {
            setStatus('disconnected');
          }
        }
      } catch (error: any) {
        // 详细记录错误信息
        console.log('[CONNECTION] Ping check failed:', error?.message || error);
        console.log('[CONNECTION] Error type:', error?.name, 'Error details:', error);
        if (error.name === 'AbortError') {
          console.log('[CONNECTION] Request was aborted (timeout) - this may be due to network delay or server load');
        }
        // 所有错误都计入失败计数，但不立即标记为disconnected
        consecutiveFailuresRef.current++;
        // 只有连续失败5次（25秒）才标记为disconnected
        if (consecutiveFailuresRef.current >= 5) {
          setStatus('disconnected');
        }
      } finally {
        isCheckingRef.current = false;
        console.log('[CONNECTION] Check completed. Current status:', status, 'Consecutive failures:', consecutiveFailuresRef.current);
      }
    };

    // 固定检查间隔为5秒
    const getCheckInterval = () => {
      return 5000; // 每5秒检查一次
    };

    // 递归调度的检查函数
    const scheduleCheck = () => {
      // 使用直接的 setTimeout，确保状态更新及时
      const executeCheck = () => {
        checkConnection().then(() => {
          const interval = getCheckInterval();
          console.log('[CONNECTION] Scheduling next check in', interval, 'ms');
          timeoutRef.current = setTimeout(scheduleCheck, interval);
        }).catch((error) => {
          // 即使出错也继续调度
          console.log('[CONNECTION] Check failed but continuing schedule:', error);
          const interval = getCheckInterval();
          timeoutRef.current = setTimeout(scheduleCheck, interval);
        });
      };

      // 使用 setTimeout 延迟执行，确保不阻塞 UI，但比 requestIdleCallback 更可靠
      setTimeout(executeCheck, 200);
    };

    // 立即进行一次检查（延迟1秒，确保不阻塞初始渲染）
    timeoutRef.current = setTimeout(() => {
      checkConnection().then(() => {
        // 首次检查后，开始定期检查
        scheduleCheck();
      }).catch(() => {
        // 即使首次检查失败，也继续定期检查
        scheduleCheck();
      });
    }, 1000);

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

  const getStatusDisplay = () => {
    switch (status) {
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
    <div className="flex items-center justify-start">
      {getStatusDisplay()}
    </div>
  );
};

