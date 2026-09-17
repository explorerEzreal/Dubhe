import { useCallback, useEffect, useRef, useState } from 'react';
import { DASHBOARD_POLL_INTERVAL } from '../constants';

export function useAsyncList<T>(loader: () => Promise<T>, options: { poll?: boolean } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await loader();
      if (mounted.current) setData(result);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    if (!options.poll) return () => { mounted.current = false; };
    const timer = window.setInterval(() => void reload(), DASHBOARD_POLL_INTERVAL);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, [options.poll, reload]);

  return { data, loading, error, reload };
}

