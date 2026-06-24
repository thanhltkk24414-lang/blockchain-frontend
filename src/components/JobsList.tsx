import { useJobs } from '@/hooks/useJobs';
import { JobCard } from '@/components/shared/JobCard';

export function JobsList() {
  const { jobs, loading, error } = useJobs();

  if (loading) return <p className="muted">Loading jobs…</p>;
  if (error) return <p className="error">{error}</p>;
  if (jobs.length === 0) return <p className="muted">No jobs yet.</p>;

  return (
    <ul className="jobs-list">
      {jobs.map((job) => (
        <JobCard key={job._id} job={job} />
      ))}
    </ul>
  );
}
