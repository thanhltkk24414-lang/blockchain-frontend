import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchJobsByFreelancer, fetchUserStats, type Job } from '@/lib/api';
import { JobCard } from '@/components/shared/JobCard';
import { useJobCounter } from '@/hooks/contracts/useContracts';

export function FreelancerDashboardPage() {
  const { address, isAuthenticated } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<{ jobsCompleted?: number; totalEarned?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: jobCounter } = useJobCounter();

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([fetchJobsByFreelancer(address), fetchUserStats(address)])
      .then(([jobsRes, statsRes]) => {
        if (cancelled) return;
        if (jobsRes.success) setJobs(jobsRes.jobs || []);
        else setError('Failed to load freelancer jobs');
        if (statsRes.success) setStats(statsRes.stats || null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <main className="page">
      <div className="page-header">
        <h2>Freelancer dashboard</h2>
        <p className="muted">Active jobs, history, reputation — bid & deliverable flows in Phase 2.</p>
      </div>
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">On-chain jobs</span>
          <strong>{jobCounter != null ? String(jobCounter) : '—'}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Completed</span>
          <strong>{stats?.jobsCompleted ?? '—'}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total earned</span>
          <strong>{stats?.totalEarned != null ? `${stats.totalEarned} USDC` : '—'}</strong>
        </div>
      </div>
      {!isAuthenticated && <p className="muted">Connect wallet and sign in to see your assignments.</p>}
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {isAuthenticated && !loading && jobs.length === 0 && <p className="muted">No active jobs yet.</p>}
      <ul className="jobs-list">
        {jobs.map((job) => (
          <JobCard key={job._id} job={job} />
        ))}
      </ul>
    </main>
  );
}
