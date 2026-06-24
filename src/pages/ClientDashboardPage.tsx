import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchJobsByClient, type Job } from '@/lib/api';
import { JobCard } from '@/components/shared/JobCard';
import { LiveFeed } from '@/components/LiveFeed';
import { CreateJobForm } from '@/components/client/CreateJobForm';

export function ClientDashboardPage() {
  const navigate = useNavigate();
  const { address, isAuthenticated, token } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadJobs = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJobsByClient(address);
      if (res.success) setJobs(res.jobs || []);
      else setError('Failed to load client jobs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  function handleJobCreated(job: Job) {
    setShowCreate(false);
    setJobs((prev) => [job, ...prev.filter((j) => j._id !== job._id)]);
    loadJobs();
    navigate(`/client/jobs/${job._id}`);
  }

  return (
    <main className="page two-col">
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
      <LiveFeed token={token} />
    </main>
  );
}
