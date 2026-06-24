import { useEffect, useState } from 'react';
import { fetchJobs, type Job } from '@/lib/api';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchJobs()
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setJobs(res.jobs || []);
        } else {
          setError(res.error || 'Failed to load jobs');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load jobs');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { jobs, loading, error };
}
