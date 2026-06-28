import { useEffect } from 'react';

const DEFAULT_INTERVAL_MS = 30_000;

export type RefreshOptions = { silent?: boolean };

/** Refetch when the tab regains focus and on a fixed interval (silent — no loading flash). */
export function useAutoRefresh(
  refetch: (opts?: RefreshOptions) => void | Promise<void>,
  intervalMs = DEFAULT_INTERVAL_MS,
) {
  useEffect(() => {
    const silentRefresh = () => {
      if (document.visibilityState === 'visible') {
        void refetch({ silent: true });
      }
    };

    const interval = window.setInterval(silentRefresh, intervalMs);

    document.addEventListener('visibilitychange', silentRefresh);
    window.addEventListener('focus', silentRefresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', silentRefresh);
      window.removeEventListener('focus', silentRefresh);
    };
  }, [refetch, intervalMs]);
}
