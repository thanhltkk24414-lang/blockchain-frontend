import { useCallback, useEffect, useState } from 'react';
import { fetchJobs, type Job } from '@/lib/api';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    refetch().then(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [refetch]);

  return { jobs, loading, error, refetch };
}
