import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchJobsByFreelancer, fetchMyBids, fetchUserStats, type Bid, type Job } from '@/lib/api';
import { JobCard } from '@/components/shared/JobCard';
import { useJobCounter } from '@/hooks/contracts/useContracts';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { compareByDateDesc } from '@/lib/utils/dates';

export function FreelancerDashboardPage() {
  const { address, isAuthenticated } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [stats, setStats] = useState<{ jobsCompleted?: number; totalEarned?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: jobCounter } = useJobCounter();

  const loadData = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [jobsRes, statsRes, bidsRes] = await Promise.all([
        fetchJobsByFreelancer(address),
        fetchUserStats(address),
        fetchMyBids(address),
      ]);
      if (jobsRes.success) setJobs(jobsRes.jobs || []);
      else setError(jobsRes.error || 'Failed to load freelancer jobs');
      if (statsRes.success) setStats(statsRes.stats || null);
      if (bidsRes.success) setBids(bidsRes.bids || []);
      else setError(bidsRes.error || 'Failed to load your proposals');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useAutoRefresh(loadData);

  const recentBids = useMemo(
    () => [...bids].sort((a, b) => compareByDateDesc(a.createdAt, b.createdAt)).slice(0, 5),
    [bids],
  );

  const assignedJobs = useMemo(
    () => [...jobs].sort((a, b) => compareByDateDesc(a.createdAt, b.createdAt)),
    [jobs],
  );

  return (
    <main className="page">
      <div className="page-header">
        <h2>Freelancer dashboard</h2>
        <p className="muted">
          Your assignments and submitted bids. Browse open jobs to propose on{' '}
          <Link to="/browse">Browse</Link>.
        </p>
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
        <div className="stat-card">
          <span className="stat-label">My bids</span>
          <strong>{bids.length}</strong>
        </div>
      </div>
      {!isAuthenticated && <p className="muted">Connect wallet and sign in to see your assignments.</p>}
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {recentBids.length > 0 && (
        <section className="panel">
          <h3>Recent proposals</h3>
          <ul className="bids-list">
            {recentBids.map((bid) => {
              const jobLinkId =
                typeof bid.jobId === 'object' && bid.jobId && '_id' in bid.jobId
                  ? (bid.jobId as { _id: string })._id
                  : bid.jobId;
              return (
              <li key={bid._id} className="bid-item">
                <strong>{bid.title || 'Proposal'}</strong>
                <span className="muted">
                  {bid.bidAmount} USDC · {bid.status}
                </span>
                <Link to={`/jobs/${jobLinkId}`} className="btn ghost">
                  View job
                </Link>
              </li>
              );
            })}
          </ul>
        </section>
      )}

      <h3>Assigned jobs</h3>
      {isAuthenticated && !loading && assignedJobs.length === 0 && (
        <p className="muted">No active assignments yet — submit bids on open jobs.</p>
      )}
      <ul className="jobs-list">
        {assignedJobs.map((job) => (
          <JobCard key={job._id} job={job} />
        ))}
      </ul>
    </main>
  );
}
