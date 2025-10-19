import { useState, useEffect, useCallback } from 'react';
import { apiEndpoints } from '../config/env';

export interface ModelStatusData {
  model_alias: string;
  model_status: 'unloaded' | 'loading' | 'loaded' | 'unknown';
  model_status_code: number;
  dynamic_loading: boolean;
  ready_for_search: boolean;
}

export const useModelStatus = (pollInterval: number = 60000) => {
  const [status, setStatus] = useState<ModelStatusData | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(apiEndpoints.searchStatus, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setError(null);
      } else {
        setError(`Failed to fetch status: ${response.status}`);
      }
    } catch (err) {
      setError(`Network error: ${(err as Error).message}`);
      console.warn('Failed to fetch model status:', err);
    }
  }, []);

  useEffect(() => {
    if (!isPolling) return;

    // Initial fetch
    fetchStatus();

    // Set up polling
    const interval = setInterval(fetchStatus, pollInterval);

    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval, isPolling]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  const refetch = useCallback(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    error,
    isPolling,
    startPolling,
    stopPolling,
    refetch,
  };
};
