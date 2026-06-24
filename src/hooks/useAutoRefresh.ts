import { useEffect } from 'react';

const DEFAULT_INTERVAL_MS = 30_000;

/** Refetch when the tab regains focus and on a fixed interval. */
export function useAutoRefresh(refetch: () => void, intervalMs = DEFAULT_INTERVAL_MS) {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refetch();
    }, intervalMs);

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refetch, intervalMs]);
}
