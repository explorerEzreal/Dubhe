import { useCallback, useEffect, useRef } from 'react';
import { useRequest } from 'ahooks';
import { DASHBOARD_POLL_INTERVAL } from '../constants';

export type CloudQueryResult<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: boolean;
  reload: () => Promise<void>;
};

export function useCloudQuery<T>(
  loader: () => Promise<T>,
  options: { queryKey?: string; poll?: boolean; enabled?: boolean } = {},
): CloudQueryResult<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const { data, loading, error, run, runAsync } = useRequest(
    useCallback(() => loaderRef.current(), []),
    {
      manual: true,
      pollingInterval: options.poll ? DASHBOARD_POLL_INTERVAL : undefined,
      pollingWhenHidden: false,
      refreshOnWindowFocus: false,
    },
  );

  useEffect(() => {
    if (options.enabled === false) return;
    run();
  }, [options.enabled, options.queryKey, run]);

  const reload = useCallback(async () => {
    await runAsync();
  }, [runAsync]);

  return {
    data: data ?? null,
    loading,
    refreshing: loading && data !== undefined,
    error: Boolean(error),
    reload,
  };
}
