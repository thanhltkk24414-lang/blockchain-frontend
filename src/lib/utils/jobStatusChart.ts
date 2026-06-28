import type { StatusSlice } from '@/components/shared/StatusDonutChart';
import type { Bid, Job } from '@/lib/api';

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
    const status = bid.status ?? 'pending';
    if (status in counts) {
      counts[status as keyof typeof counts] += 1;
    }
  }

  return (['pending', 'accepted', 'rejected'] as const).map((status) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: counts[status],
    color: BID_STATUS_COLORS[status],
  }));
}

export function buildEarningsByMonth(jobs: Job[]): { label: string; earned: number }[] {
  const buckets = new Map<string, number>();

  for (const job of jobs) {
    if (!job || (job.status ?? '').toUpperCase() !== 'COMPLETED') continue;
    const raw = job.createdAt;
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    const label = date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    buckets.set(label, (buckets.get(label) ?? 0) + (job.contractValue ?? 0));
  }

  return [...buckets.entries()]
    .map(([label, earned]) => ({ label, earned }))
    .slice(-6);
}
