import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchJobsByClient, type Job } from '@/lib/api';
import { JobCard } from '@/components/shared/JobCard';
import { LiveFeed } from '@/components/LiveFeed';

export function ClientDashboardPage() {
  const { address, isAuthenticated, token } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);

    fetchJobsByClient(address)
      .then((res) => {
        if (cancelled) return;
        if (res.success) setJobs(res.jobs || []);
        else setError('Failed to load client jobs');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load jobs');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <main className="page two-col">
      <section className="panel">
        <div className="page-header">
          <h2>Client dashboard</h2>
          <p className="muted">Jobs you posted — create job & escrow flows coming in Phase 2.</p>
        </div>
        {!isAuthenticated && <p className="muted">Connect wallet and sign in to see your posted jobs.</p>}
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="error">{error}</p>}
        {isAuthenticated && !loading && jobs.length === 0 && <p className="muted">No posted jobs yet.</p>}
        <ul className="jobs-list">
          {jobs.map((job) => (
            <JobCard key={job._id} job={job} />
          ))}
        </ul>
      </section>
      <LiveFeed token={token} />
    </main>
  );
}
