import type { StatusSlice } from '@/components/shared/StatusDonutChart';
import type { Bid, Job } from '@/lib/api';
import { normalizeBidStatus } from '@/lib/api/normalize';
import { sortByDateDesc } from '@/lib/utils/dates';

const CLIENT_STATUS_COLORS: Record<string, string> = {
  OPEN: '#22c55e',
  ASSIGNED: '#3b82f6',
  IN_PROGRESS: '#6366f1',
  SUBMITTED: '#f59e0b',
  COMPLETED: '#10b981',
  DISPUTED: '#ef4444',
};

const CLIENT_STATUS_ORDER = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'COMPLETED',
  'DISPUTED',
] as const;

const BID_STATUS_COLORS: Record<string, string> = {
  pending: '#6366f1',
  accepted: '#22c55e',
  rejected: '#ef4444',
};

export function buildClientJobStatusSlices(jobs: Job[]): StatusSlice[] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    if (!job) continue;
    const status = (job.status ?? 'OPEN').toUpperCase();
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return CLIENT_STATUS_ORDER.map((status) => ({
    name: status.replace('_', ' '),
    value: counts.get(status) ?? 0,
    color: CLIENT_STATUS_COLORS[status] ?? '#94a3b8',
  }));
}

export function buildBidStatusSlices(bids: Bid[]): StatusSlice[] {
  const counts = { pending: 0, accepted: 0, rejected: 0 };
  for (const bid of bids) {
    if (!bid) continue;
    const status = normalizeBidStatus(bid.status);
    counts[status] += 1;
  }

  return (['pending', 'accepted', 'rejected'] as const).map((status) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: counts[status],
    color: BID_STATUS_COLORS[status],
  }));
}

/** Recent bids with a mix of statuses when possible (not only the latest rejections). */
export function pickRecentBids(bids: Bid[], limit = 5): Bid[] {
  const sorted = sortByDateDesc(
    bids.filter(Boolean),
    (bid) => bid.createdAt,
  );
  if (sorted.length <= limit) return sorted;

  const buckets: Record<Bid['status'], Bid[]> = {
    accepted: [],
    pending: [],
    rejected: [],
  };

  for (const bid of sorted) {
    buckets[normalizeBidStatus(bid.status)].push(bid);
  }

  const picked: Bid[] = [];
  const seen = new Set<string>();

  const takeFrom = (pool: Bid[], max: number) => {
    for (const bid of pool) {
      if (picked.length >= limit || max <= 0) return;
      if (seen.has(bid._id)) continue;
      picked.push(bid);
      seen.add(bid._id);
      max -= 1;
    }
  };

  takeFrom(buckets.accepted, 2);
  takeFrom(buckets.pending, 2);
  takeFrom(buckets.rejected, 1);

  for (const bid of sorted) {
    if (picked.length >= limit) break;
    if (seen.has(bid._id)) continue;
    picked.push(bid);
    seen.add(bid._id);
  }

  return sortByDateDesc(picked, (bid) => bid.createdAt);
}

export function buildEarningsByMonth(jobs: Job[]): { label: string; earned: number }[] {
  const buckets = new Map<string, number>();

  for (const job of jobs) {
    if (!job || (job.status ?? '').toUpperCase() !== 'COMPLETED') continue;

    const raw =
      job.completedAt != null
        ? job.completedAt * 1000
        : job.updatedAt ?? job.createdAt;
    if (!raw) continue;

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;

    const gross = job.contractValue ?? 0;
    const serviceFee = job.serviceFee;
    const earned =
      serviceFee != null && job.contractValue != null
        ? Math.max(0, job.contractValue - serviceFee)
        : gross * 0.98;

    const label = date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    buckets.set(label, (buckets.get(label) ?? 0) + earned);
  }

  return [...buckets.entries()]
    .map(([label, earned]) => ({ label, earned: Math.round(earned * 100) / 100 }))
    .slice(-6);
}
