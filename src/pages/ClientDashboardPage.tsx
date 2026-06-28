import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchJobsByClient, type Job } from '@/lib/api';
import { JobCard } from '@/components/shared/JobCard';
import { CreateJobForm } from '@/components/client/CreateJobForm';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

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
      if (res.success) setJobs(res.jobs || []);
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

  const escrowTotal = useMemo(
    () =>
      jobs
        .filter((j) =>
          ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'DISPUTED'].includes(j.status?.toUpperCase() ?? ''),
        )
        .reduce((sum, j) => sum + (j.totalDeposit ?? j.contractValue ?? 0), 0),
    [jobs],
  );

  const unfundedJobs = useMemo(() => jobs.filter(isUnfundedAssigned), [jobs]);

  function handleJobCreated(job: Job) {
    setShowCreate(false);
    setJobs((prev) => [job, ...prev.filter((j) => j._id !== job._id)]);
    loadJobs();
    navigate(`/client/jobs/${job._id}`);
  }

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

        {isAuthenticated && jobs.length > 0 && (
          <div className="stats-row client-stats">
            <div className="stat-card stat-card-escrow">
              <span className="stat-label">Escrow in flight</span>
              <strong className="stat-escrow-value">${escrowTotal.toLocaleString()} USDC</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total jobs</span>
              <strong>{jobs.length}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Open</span>
              <strong>{jobs.filter((j) => j.status === 'OPEN').length}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">In progress</span>
              <strong>
                {jobs.filter((j) =>
                  ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(j.status?.toUpperCase() ?? ''),
                ).length}
              </strong>
            </div>
          </div>
        )}

        {unfundedJobs.length > 0 && (
          <div className="fund-escrow-banner" role="status">
            <div>
              <strong>Fund escrow required</strong>
              <p className="muted">
                {unfundedJobs.length} assigned job{unfundedJobs.length === 1 ? '' : 's'} waiting for
                on-chain USDC deposit.
              </p>
            </div>
            <Link to={`/client/jobs/${unfundedJobs[0]._id}`} className="btn primary">
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
        {isAuthenticated && !loading && jobs.length === 0 && !showCreate && (
          <p className="muted">No posted jobs yet. Create your first job above.</p>
        )}
        <ul className="jobs-list">
          {jobs.map((job) => (
            <JobCard key={job._id} job={job} detailPath={`/client/jobs/${job._id}`} />
          ))}
        </ul>
      </section>
    </main>
  );
}
