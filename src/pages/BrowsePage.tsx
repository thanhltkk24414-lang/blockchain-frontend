import { useEffect, useState } from 'react';
import { fetchJobs, searchJobs, type Job } from '@/lib/api';
import { JobCard } from '@/components/shared/JobCard';

export function BrowsePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('OPEN');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = search.trim()
      ? searchJobs(search.trim())
      : fetchJobs({ status: status || undefined, limit: 30 });

    load
      .then((res) => {
        if (cancelled) return;
        if (res.success) setJobs(res.jobs || []);
        else setError('Failed to load jobs');
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
  }, [search, status]);

  return (
    <main className="page">
      <div className="page-header">
        <h2>Browse jobs</h2>
        <p className="muted">Filter and search open jobs from the Fapex API.</p>
      </div>
      <div className="filters">
        <input
          className="input"
          placeholder="Search jobs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>
      {loading && <p className="muted">Loading jobs…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && jobs.length === 0 && <p className="muted">No jobs found.</p>}
      <ul className="jobs-list">
        {jobs.map((job) => (
          <JobCard key={job._id} job={job} />
        ))}
      </ul>
    </main>
  );
}
