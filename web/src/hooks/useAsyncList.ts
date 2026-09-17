import { useCallback, useRef } from 'react';
import { useRequest } from 'ahooks';
import { DASHBOARD_POLL_INTERVAL } from '../constants';

export function useAsyncList<T>(loader: () => Promise<T>, options: { poll?: boolean } = {}) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const {
    data,
    loading,
    error,
    run,
  } = useRequest(
    useCallback(async () => {
      const result = await loaderRef.current();
      return result;
    }, []),
    {
      pollingInterval: options.poll ? DASHBOARD_POLL_INTERVAL : undefined,
      pollingWhenHidden: false,
      refreshDeps: [],
      refreshOnWindowFocus: false,
    },
  );

  const reload = useCallback(() => {
    run();
  }, [run]);

  return {
    data: data ?? null,
    loading,
    error: !!error,
    reload,
  };
}

