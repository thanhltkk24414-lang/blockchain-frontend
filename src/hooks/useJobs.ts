import { useCallback, useEffect, useState } from 'react';
import { fetchJobs, type Job } from '@/lib/api';
import { useAutoRefresh, type RefreshOptions } from './useAutoRefresh';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (opts?: RefreshOptions) => {
    if (!opts?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetchJobs();
      if (res.success) {
        setJobs(res.jobs || []);
      } else {
        setError(res.error || 'Failed to load jobs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useAutoRefresh(refetch);

  return { jobs, loading, error, refetch };
}
