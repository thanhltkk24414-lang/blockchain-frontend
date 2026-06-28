import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchJobs, searchJobs, type Job } from '@/lib/api';
import { JobCard } from '@/components/shared/JobCard';
import { JobFilters, type JobFilterState, DEFAULT_JOB_FILTERS } from '@/components/shared/JobFilters';
import { useAutoRefresh, type RefreshOptions } from '@/hooks/useAutoRefresh';
import { sortByDateDesc } from '@/lib/utils/dates';

function sortJobs(jobs: Job[], sortBy: JobFilterState['sortBy']): Job[] {
  if (sortBy === 'budget-high') {
    return [...jobs].sort((a, b) => (b.contractValue ?? 0) - (a.contractValue ?? 0));
  }
  if (sortBy === 'budget-low') {
    return [...jobs].sort((a, b) => (a.contractValue ?? 0) - (b.contractValue ?? 0));
  }
  return sortByDateDesc(jobs, (job) => job.createdAt);
}

function filterBySkill(jobs: Job[], skill: string): Job[] {
  const needle = skill.trim().toLowerCase();
  if (!needle) return jobs;
  return jobs.filter((job) =>
    (job.skills || []).some((s) => s.toLowerCase().includes(needle)),
  );
}

type ViewMode = 'grid' | 'list';

export function BrowsePage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<JobFilterState>(() => ({
    ...DEFAULT_JOB_FILTERS,
    search: searchParams.get('search') ?? searchParams.get('q') ?? '',
  }));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const onFiltersChange = useCallback((next: JobFilterState) => {
    setFilters(next);
  }, []);

  const loadJobs = useCallback(async (opts?: RefreshOptions) => {
    if (!opts?.silent) {
      setLoading(true);
    }
    setError(null);

    const hasSearch = Boolean(filters.search.trim());
    const minBudget = filters.minBudget ? parseInt(filters.minBudget, 10) : undefined;
    const maxBudget = filters.maxBudget ? parseInt(filters.maxBudget, 10) : undefined;

    try {
      const useSearch = hasSearch || minBudget != null || maxBudget != null;
      const res = await (useSearch
        ? searchJobs({
            q: filters.search.trim() || undefined,
            category: filters.category || undefined,
            minBudget,
            maxBudget,
            status: filters.status || undefined,
          })
        : fetchJobs({
            status: filters.status || undefined,
            category: filters.category || undefined,
            limit: 100,
          }));

      if (res.success) {
        let list = res.jobs || [];
        if (filters.status) {
          const want = filters.status.toUpperCase();
          if (want === 'DISPUTED') {
            list = list.filter(
              (j) => j.status?.toUpperCase() === 'DISPUTED' || Boolean(j.isDisputed),
            );
          } else {
            list = list.filter((j) => j.status?.toUpperCase() === want);
          }
        }
        list = filterBySkill(list, filters.skill);
        setJobs(sortJobs(list, filters.sortBy));
      } else {
        setError('Failed to load jobs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    const q = searchParams.get('search') ?? searchParams.get('q') ?? '';
    if (q) {
      setFilters((prev) => (prev.search === q ? prev : { ...prev, search: q }));
    }
  }, [searchParams]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useAutoRefresh(loadJobs);

  return (
    <main className="page">
      <div className="page-header browse-header">
        <div>
          <h2>Browse jobs</h2>
          <p className="muted">Filter by skill, budget, and category — open jobs from the Fapex API.</p>
        </div>
        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={`btn ghost btn-compact${viewMode === 'grid' ? ' active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            Grid
          </button>
          <button
            type="button"
            className={`btn ghost btn-compact${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
        </div>
      </div>

      <JobFilters onChange={onFiltersChange} initialSearch={filters.search} />

      {!loading && !error && (
        <p className="browse-count muted">
          Showing <strong>{jobs.length}</strong> job{jobs.length === 1 ? '' : 's'}
        </p>
      )}

      {loading && <p className="muted">Loading jobs…</p>}
      {error && (
        <div className="panel" role="alert">
          <p className="error" style={{ margin: 0 }}>{error}</p>
          <button type="button" className="btn ghost btn-compact" style={{ marginTop: '0.5rem' }} onClick={() => void loadJobs()}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && jobs.length === 0 && <p className="muted">No jobs match your filters.</p>}
      <ul className={`jobs-list${viewMode === 'grid' ? ' jobs-grid' : ' jobs-list-mode'}`}>
        {jobs.map((job) => (
          <JobCard key={job._id} job={job} />
        ))}
      </ul>
    </main>
  );
}
