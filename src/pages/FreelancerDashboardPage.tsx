import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchJobsByFreelancer, fetchMyBids, fetchUserStats, type Bid, type Job } from '@/lib/api';
import { JobCard } from '@/components/shared/JobCard';
import { DashboardErrorBoundary } from '@/components/shared/DashboardErrorBoundary';
import { StatusDonutChart } from '@/components/shared/StatusDonutChart';
import { EarningsBarChart } from '@/components/shared/EarningsBarChart';
import { useJobCounter } from '@/hooks/contracts/useContracts';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { sortByDateDesc } from '@/lib/utils/dates';
import { buildBidStatusSlices, buildEarningsByMonth } from '@/lib/utils/jobStatusChart';

export function FreelancerDashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const freelancerWallet = user?.walletAddress;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [stats, setStats] = useState<{
    jobsCompleted?: number;
    totalEarned?: number;
    earningsByMonth?: Array<{ label: string; earned: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: jobCounter } = useJobCounter();

  const loadData = useCallback(async () => {
    if (!freelancerWallet) return;
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, statsRes, bidsRes] = await Promise.all([
        fetchJobsByFreelancer(freelancerWallet),
        fetchUserStats(freelancerWallet),
        fetchMyBids(freelancerWallet),
      ]);
      if (jobsRes.success) setJobs((jobsRes.jobs || []).filter(Boolean));
      else setError(jobsRes.error || 'Failed to load freelancer jobs');
      if (statsRes.success) setStats(statsRes.stats || null);
      if (bidsRes.success) setBids((bidsRes.bids || []).filter(Boolean));
      else setError(bidsRes.error || 'Failed to load your proposals');
      if (jobsRes.success && bidsRes.success) setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [freelancerWallet]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useAutoRefresh(loadData);

  const safeJobs = useMemo(() => jobs.filter(Boolean), [jobs]);
  const safeBids = useMemo(() => bids.filter(Boolean), [bids]);

  const recentBids = useMemo(
    () => sortByDateDesc(safeBids, (bid) => bid.createdAt).slice(0, 5),
    [safeBids],
  );

  const assignedJobs = useMemo(
    () => sortByDateDesc(safeJobs, (job) => job.createdAt),
    [safeJobs],
  );

  const bidSlices = useMemo(() => buildBidStatusSlices(safeBids), [safeBids]);
  const earningsPoints = useMemo(() => {
    if (stats?.earningsByMonth?.some((point) => point.earned > 0)) {
      return stats.earningsByMonth;
    }
    return buildEarningsByMonth(safeJobs);
  }, [stats?.earningsByMonth, safeJobs]);

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
          <strong>{safeBids.length}</strong>
        </div>
      </div>

      {isAuthenticated &&
        (safeBids.length > 0 ||
          (stats?.jobsCompleted ?? 0) > 0 ||
          safeJobs.some((j) => j.status === 'COMPLETED')) && (
        <div className="dashboard-charts-grid">
          <StatusDonutChart title="Proposals by status" data={bidSlices} emptyLabel="No proposals yet" />
          <EarningsBarChart title="Earnings over time" data={earningsPoints} />
        </div>
      )}

      {!isAuthenticated && <p className="muted">Connect wallet and sign in to see your assignments.</p>}
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {recentBids.length > 0 && (
        <DashboardErrorBoundary section="recent proposals">
          <section className="panel">
            <h3>Recent proposals</h3>
            <ul className="bids-list">
              {recentBids.map((bid) => {
                const jobLinkId =
                  typeof bid.jobId === 'object' && bid.jobId && '_id' in bid.jobId
                    ? (bid.jobId as { _id: string })._id
                    : typeof (bid as Bid & { job?: { _id?: string } }).job === 'object' &&
                        (bid as Bid & { job?: { _id?: string } }).job?._id
                      ? (bid as Bid & { job: { _id: string } }).job._id
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
        </DashboardErrorBoundary>
      )}

      <h3>Assigned jobs</h3>
      {isAuthenticated && !loading && assignedJobs.length === 0 && (
        <p className="muted">No active assignments yet — submit bids on open jobs.</p>
      )}
      <DashboardErrorBoundary section="assigned jobs">
        <ul className="jobs-list">
          {assignedJobs.map((job) => (
            <JobCard key={job._id ?? String(job.onchainJobId)} job={job} />
          ))}
        </ul>
      </DashboardErrorBoundary>
    </main>
  );
}
