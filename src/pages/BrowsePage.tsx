import { useCallback, useEffect, useState } from 'react';
import { fetchJobs, searchJobs, type Job } from '@/lib/api';
import { JobCard } from '@/components/shared/JobCard';
import { JobFilters, type JobFilterState, DEFAULT_JOB_FILTERS } from '@/components/shared/JobFilters';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

function sortJobs(jobs: Job[], sortBy: JobFilterState['sortBy']): Job[] {
  const copy = [...jobs];
  if (sortBy === 'budget-high') {
    return copy.sort((a, b) => (b.contractValue ?? 0) - (a.contractValue ?? 0));
  }
  if (sortBy === 'budget-low') {
    return copy.sort((a, b) => (a.contractValue ?? 0) - (b.contractValue ?? 0));
  }
  return copy.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

function filterBySkill(jobs: Job[], skill: string): Job[] {
  const needle = skill.trim().toLowerCase();
  if (!needle) return jobs;
  return jobs.filter((job) =>
    (job.skills || []).some((s) => s.toLowerCase().includes(needle)),
  );
}

export function BrowsePage() {
  const [filters, setFilters] = useState<JobFilterState>(DEFAULT_JOB_FILTERS);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onFiltersChange = useCallback((next: JobFilterState) => {
    setFilters(next);
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const hasSearch = Boolean(filters.search.trim());
    const minBudget = filters.minBudget ? parseInt(filters.minBudget, 10) : undefined;
    const maxBudget = filters.maxBudget ? parseInt(filters.maxBudget, 10) : undefined;

    try {
      const res = await (hasSearch || minBudget || maxBudget
        ? searchJobs({
            q: filters.search.trim() || undefined,
            category: filters.category || undefined,
            minBudget,
            maxBudget,
          })
        : fetchJobs({
            status: filters.status || undefined,
            category: filters.category || undefined,
            limit: 50,
          }));

      if (res.success) {
        let list = res.jobs || [];
        if (!hasSearch && !minBudget && !maxBudget && filters.status) {
          list = list.filter((j) => j.status === filters.status);
        }
        list = filterBySkill(list, filters.skill);
        setJobs(sortJobs(list, filters.sortBy));
      } else {
        setError('Failed to load jobs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useAutoRefresh(loadJobs);

  return (
    <main className="page">
      <div className="page-header">
        <h2>Browse jobs</h2>
        <p className="muted">Filter by skill, budget, and category — open jobs from the Fapex API.</p>
      </div>

      <JobFilters onChange={onFiltersChange} />

      {loading && <p className="muted">Loading jobs…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && jobs.length === 0 && <p className="muted">No jobs match your filters.</p>}
      <ul className="jobs-list">
        {jobs.map((job) => (
          <JobCard key={job._id} job={job} />
        ))}
      </ul>
    </main>
  );
}
