import { parseApiDate } from '@/lib/utils/dates';
import type { Bid, Job } from './types';

function normalizeJobDates<T extends { createdAt?: unknown; updatedAt?: unknown }>(
  item: T,
): T & { createdAt?: string; updatedAt?: string } {
  return {
    ...item,
    createdAt: parseApiDate(item.createdAt),
    updatedAt: parseApiDate(item.updatedAt),
  };
}

export function normalizeJob(job: Job): Job {
  return normalizeJobDates(job);
}

export function normalizeJobs(jobs: Job[]): Job[] {
  return jobs.map(normalizeJob);
}

export function normalizeBid(bid: Bid): Bid {
  const normalized = normalizeJobDates(bid);
  if (normalized.jobId && typeof normalized.jobId === 'object' && !Array.isArray(normalized.jobId)) {
    return {
      ...normalized,
      jobId: normalizeJobDates(normalized.jobId as Job & { createdAt?: unknown }),
    };
  }
  return normalized;
}

export function normalizeBids(bids: Bid[]): Bid[] {
  return bids.map(normalizeBid);
}
