import type { Job } from '@/lib/api';

const STATUS_CLASS: Record<string, string> = {
  OPEN: 'status-open',
  ASSIGNED: 'status-assigned',
  IN_PROGRESS: 'status-progress',
  SUBMITTED: 'status-submitted',
  COMPLETED: 'status-completed',
  CANCELLED: 'status-cancelled',
  DISPUTED: 'status-disputed',
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const key = status?.toUpperCase() || 'UNKNOWN';
  return <span className={`status ${STATUS_CLASS[key] || ''}`}>{key}</span>;
}

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const clientAddr =
    typeof job.client === 'object' && job.client?.walletAddress
      ? job.client.walletAddress
      : typeof job.client === 'string'
        ? job.client
        : null;

  return (
    <li className="job-card">
      <div className="job-header">
        <h3>{job.title}</h3>
        <StatusBadge status={job.status} />
      </div>
      <p className="job-desc">{job.description}</p>
      <div className="job-meta">
        <span>{job.category}</span>
        {job.contractValue != null && <span>{job.contractValue} USDC</span>}
        {job.onchainJobId != null && <span>On-chain #{job.onchainJobId}</span>}
        {clientAddr && (
          <span>
            Client: {clientAddr.slice(0, 6)}…{clientAddr.slice(-4)}
          </span>
        )}
      </div>
    </li>
  );
}
