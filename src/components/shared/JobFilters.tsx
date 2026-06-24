import { useCallback, useState } from 'react';

export interface JobFilterState {
  search: string;
  category: string;
  skill: string;
  minBudget: string;
  maxBudget: string;
  status: string;
  sortBy: 'newest' | 'budget-high' | 'budget-low';
}

export const DEFAULT_JOB_FILTERS: JobFilterState = {
  search: '',
  category: '',
  skill: '',
  minBudget: '',
  maxBudget: '',
  status: 'OPEN',
  sortBy: 'newest',
};

interface JobFiltersProps {
  onChange: (filters: JobFilterState) => void;
}

export function JobFilters({ onChange }: JobFiltersProps) {
  const [filters, setFilters] = useState<JobFilterState>(DEFAULT_JOB_FILTERS);

  const update = useCallback(
    (patch: Partial<JobFilterState>) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch };
        onChange(next);
        return next;
      });
    },
    [onChange],
  );

  return (
    <section className="panel job-filters">
      <h3>Search &amp; filter</h3>
      <div className="filters-grid">
        <label className="field">
          Keywords
          <input
            className="input"
            placeholder="Title, description…"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </label>
        <label className="field">
          Skill
          <input
            className="input"
            placeholder="e.g. Solidity"
            value={filters.skill}
            onChange={(e) => update({ skill: e.target.value })}
          />
        </label>
        <label className="field">
          Category
          <select className="input" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            <option value="development">Development</option>
            <option value="design">Design</option>
            <option value="writing">Writing</option>
            <option value="marketing">Marketing</option>
          </select>
        </label>
        <label className="field">
          Status
          <select className="input" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </label>
        <label className="field">
          Min budget (USDC)
          <input
            className="input"
            type="number"
            min={0}
            placeholder="0"
            value={filters.minBudget}
            onChange={(e) => update({ minBudget: e.target.value })}
          />
        </label>
        <label className="field">
          Max budget (USDC)
          <input
            className="input"
            type="number"
            min={0}
            placeholder="Any"
            value={filters.maxBudget}
            onChange={(e) => update({ maxBudget: e.target.value })}
          />
        </label>
        <label className="field">
          Sort by
          <select
            className="input"
            value={filters.sortBy}
            onChange={(e) => update({ sortBy: e.target.value as JobFilterState['sortBy'] })}
          >
            <option value="newest">Newest first</option>
            <option value="budget-high">Highest budget</option>
            <option value="budget-low">Lowest budget</option>
          </select>
        </label>
      </div>
    </section>
  );
}
