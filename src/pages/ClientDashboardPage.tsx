import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchJobsByClient, type Job } from '@/lib/api';
import { JobCard } from '@/components/shared/JobCard';
import { CreateJobForm } from '@/components/client/CreateJobForm';
import { StatusDonutChart } from '@/components/shared/StatusDonutChart';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { buildClientJobStatusSlices } from '@/lib/utils/jobStatusChart';

function isUnfundedAssigned(job: Job): boolean {
  const status = job.status?.toUpperCase() ?? '';
  if (status !== 'ASSIGNED') return false;
  return !job.totalDeposit || job.totalDeposit <= 0;
}

export function ClientDashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const clientWallet = user?.walletAddress;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadJobs = useCallback(async () => {
    if (!clientWallet) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJobsByClient(clientWallet);
      if (res.success) setJobs((res.jobs || []).filter(Boolean));
      else setError('Failed to load client jobs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [clientWallet]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useAutoRefresh(loadJobs);

  const safeJobs = useMemo(() => jobs.filter(Boolean), [jobs]);

  const escrowTotal = useMemo(
    () =>
      safeJobs
        .filter((j) =>
          ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'DISPUTED'].includes(j.status?.toUpperCase() ?? ''),
        )
        .reduce((sum, j) => sum + (j.totalDeposit ?? j.contractValue ?? 0), 0),
    [safeJobs],
  );

  const unfundedJobs = useMemo(() => safeJobs.filter(isUnfundedAssigned), [safeJobs]);
  const statusSlices = useMemo(() => buildClientJobStatusSlices(safeJobs), [safeJobs]);

  function handleJobCreated(job: Job) {
    setShowCreate(false);
    if (!job?._id) {
      void loadJobs();
      return;
    }
    setJobs((prev) => [job, ...prev.filter((j) => j?._id && j._id !== job._id)]);
    void loadJobs();
    navigate(`/client/jobs/${job._id}`);
  }

  const firstUnfunded = unfundedJobs.find((j) => j?._id);

  return (
    <main className="page">
      <section className="panel">
        <div className="page-header panel-header-row">
          <div>
            <h2>Client dashboard</h2>
            <p className="muted">Post jobs, fund escrow, and track status.</p>
          </div>
          {isAuthenticated && (
            <button
              className="btn primary"
              type="button"
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? 'Close form' : 'Create job'}
            </button>
          )}
        </div>

        {!isAuthenticated && (
          <p className="muted">Connect wallet and sign in to see your posted jobs.</p>
        )}

        {isAuthenticated && safeJobs.length > 0 && (
          <>
            <div className="stats-row client-stats">
              <div className="stat-card stat-card-escrow">
                <span className="stat-label">Escrow in flight</span>
                <strong className="stat-escrow-value">${escrowTotal.toLocaleString()} USDC</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total jobs</span>
                <strong>{safeJobs.length}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Open</span>
                <strong>{safeJobs.filter((j) => j.status === 'OPEN').length}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">In progress</span>
                <strong>
                  {safeJobs.filter((j) =>
                    ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(j.status?.toUpperCase() ?? ''),
                  ).length}
                </strong>
              </div>
            </div>

            <StatusDonutChart title="Jobs by status" data={statusSlices} />
          </>
        )}

        {firstUnfunded && (
          <div className="fund-escrow-banner" role="status">
            <div>
              <strong>Fund escrow required</strong>
              <p className="muted">
                {unfundedJobs.length} assigned job{unfundedJobs.length === 1 ? '' : 's'} waiting for
                on-chain USDC deposit.
              </p>
            </div>
            <Link to={`/client/jobs/${firstUnfunded._id}`} className="btn primary">
              Fund escrow →
            </Link>
          </div>
        )}

        {showCreate && isAuthenticated && (
          <div className="create-job-panel">
            <CreateJobForm onCreated={handleJobCreated} onCancel={() => setShowCreate(false)} />
          </div>
        )}

        {loading && <p className="muted">Loading…</p>}
        {error && <p className="error">{error}</p>}
        {isAuthenticated && !loading && safeJobs.length === 0 && !showCreate && (
          <p className="muted">No posted jobs yet. Create your first job above.</p>
        )}
        <ul className="jobs-list">
          {safeJobs.map((job) => (
            <JobCard
              key={job._id ?? String(job.onchainJobId)}
              job={job}
              detailPath={job._id ? `/client/jobs/${job._id}` : undefined}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}
