import { useJobs } from '../hooks/useJobs';

export function JobsList() {
  const { jobs, loading, error } = useJobs();

  if (loading) return <p className="muted">Loading jobs…</p>;
  if (error) return <p className="error">{error}</p>;
  if (jobs.length === 0) return <p className="muted">No jobs yet.</p>;

  return (
    <ul className="jobs-list">
      {jobs.map((job) => (
        <li key={job._id} className="job-card">
          <div className="job-header">
            <h3>{job.title}</h3>
            <span className={`status status-${job.status?.toLowerCase()}`}>{job.status}</span>
          </div>
          <p className="job-desc">{job.description}</p>
          <div className="job-meta">
            <span>{job.category}</span>
            {job.contractValue != null && <span>{job.contractValue} USDC</span>}
            {job.onchainJobId != null && <span>On-chain #{job.onchainJobId}</span>}
            {job.client?.walletAddress && (
              <span>Client: {job.client.walletAddress.slice(0, 6)}…{job.client.walletAddress.slice(-4)}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
