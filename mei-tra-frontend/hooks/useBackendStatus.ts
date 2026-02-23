import { useState, useEffect, useCallback } from 'react';

interface BackendStatus {
  status: 'ok' | 'degraded' | 'error';
  isIdle: boolean;
  isStarting: boolean;
  lastActivityAgo?: number;
  activeConnections?: number;
}

const POLLING_INTERVAL = 10000; // 10秒ごとにチェック
const RETRY_INTERVAL = 3000; // エラー時は3秒後にリトライ

export const useBackendStatus = () => {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    status: 'ok',
    isIdle: false,
    isStarting: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const checkBackendStatus = useCallback(async () => {
    try {
      const response = await fetch('/backend-status', {
        cache: 'no-store',
      });

      if (!response.ok) {
        let errorData: { isStarting?: boolean } = {};
        try {
          errorData = await response.json();
        } catch {
          // Response is not JSON (e.g. HTML error page)
        }
        setBackendStatus({
          status: 'error',
          isIdle: false,
          isStarting: errorData.isStarting ?? true,
        });
        return;
      }

      let data: {
        status?: string;
        isIdle?: boolean;
        isStarting?: boolean;
        lastActivityAgo?: number;
        activeConnections?: number;
      };
      try {
        data = await response.json();
      } catch {
        setBackendStatus({
          status: 'error',
          isIdle: false,
          isStarting: true,
        });
        return;
      }
      setBackendStatus({
        status: (data.status as BackendStatus['status']) ?? 'error',
        isIdle: data.isIdle ?? false,
        isStarting: data.isStarting ?? false,
        lastActivityAgo: data.lastActivityAgo,
        activeConnections: data.activeConnections,
      });
    } catch (error) {
      console.error('Backend status check failed:', error);
      setBackendStatus({
        status: 'error',
        isIdle: false,
        isStarting: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkBackendStatus();

    const interval = setInterval(() => {
      checkBackendStatus();
    }, backendStatus.status === 'error' ? RETRY_INTERVAL : POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [checkBackendStatus, backendStatus.status]);

  return {
    backendStatus,
    isLoading,
    refresh: checkBackendStatus,
  };
};
