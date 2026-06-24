import { Link } from 'react-router-dom';
import type { Job } from '@/lib/api';
import { StatusBadge } from './StatusBadge';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';

interface JobCardProps {
  job: Job;
  detailPath?: string;
}

function resolveClientAddress(job: Job): string | null {
  if (typeof job.client === 'object' && job.client?.walletAddress) return job.client.walletAddress;
  if (typeof job.client === 'string') return job.client;
  if (job.clientAddress) return job.clientAddress;
  return null;
}

export function JobCard({ job, detailPath }: JobCardProps) {
  const clientAddr = resolveClientAddress(job);
  const href = detailPath ?? `/jobs/${job._id}`;

  return (
    <li className="job-card">
      <div className="job-header">
        <h3>
          <Link to={href} className="job-title-link">
            {job.title}
          </Link>
        </h3>
        <StatusBadge status={job.status} />
      </div>
      <p className="job-desc">{job.description}</p>
      <div className="job-meta">
        <span className="job-category">{job.category}</span>
        {job.contractValue != null && <span>{job.contractValue} USDC</span>}
        {isValidOnchainJobId(job.onchainJobId) && <span>On-chain #{job.onchainJobId}</span>}
        {job.skills && job.skills.length > 0 && (
          <span>{job.skills.slice(0, 3).join(', ')}</span>
        )}
        {clientAddr && (
          <span>
            Client: {clientAddr.slice(0, 6)}…{clientAddr.slice(-4)}
          </span>
        )}
      </div>
      <Link to={href} className="btn ghost job-card-cta">
        View details
      </Link>
    </li>
  );
}
