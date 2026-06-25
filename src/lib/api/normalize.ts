import { parseApiDate } from '@/lib/utils/dates';
import type { Bid, Job } from './types';

const DATE_FIELDS = ['createdAt', 'updatedAt'] as const;

type DateField = (typeof DATE_FIELDS)[number];

function normalizeDateFields<T extends Record<string, unknown>>(item: T): T {
  const next = { ...item } as T & Partial<Record<DateField, string | undefined>>;
  for (const field of DATE_FIELDS) {
    if (field in next) {
      (next as Record<string, unknown>)[field] = parseApiDate(next[field as keyof T]);
    }
  }
  return next;
}

function normalizeJobDates<T extends { createdAt?: unknown; updatedAt?: unknown }>(
  item: T,
): T & { createdAt?: string; updatedAt?: string } {
  if (item == null || typeof item !== 'object') {
    return item as T & { createdAt?: string; updatedAt?: string };
  }
  return normalizeDateFields(item as T & Record<string, unknown>) as T & {
    createdAt?: string;
    updatedAt?: string;
  };
}

function safeNormalize<T, R>(item: T, normalize: (value: T) => R, fallback: R): R {
  try {
    return normalize(item);
  } catch {
    return fallback;
  }
}

export function normalizeJob(job: Job): Job {
  return safeNormalize(job, normalizeJobDates, job);
}

export function normalizeJobs(jobs: Job[]): Job[] {
  return jobs.map((job) => normalizeJob(job));
}

export function normalizeBid(bid: Bid): Bid {
  return safeNormalize(bid, (raw) => {
    const normalized = normalizeJobDates(raw);
    const withJobId =
      normalized.jobId && typeof normalized.jobId === 'object' && !Array.isArray(normalized.jobId)
        ? {
            ...normalized,
            jobId: normalizeJobDates(normalized.jobId as Job & { createdAt?: unknown }),
          }
        : normalized;

    const populatedJob = (withJobId as Bid & { job?: Job }).job;
    if (populatedJob && typeof populatedJob === 'object' && !Array.isArray(populatedJob)) {
      return {
        ...withJobId,
        job: normalizeJob(populatedJob),
      } as Bid;
    }

    return withJobId;
  }, bid);
}

export function normalizeBids(bids: Bid[]): Bid[] {
  return bids.map((bid) => normalizeBid(bid));
}
