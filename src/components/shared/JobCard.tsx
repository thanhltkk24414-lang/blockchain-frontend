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

function formatPosted(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString();
}

export function JobCard({ job, detailPath }: JobCardProps) {
  const clientAddr = resolveClientAddress(job);
  const href = detailPath ?? `/jobs/${job._id}`;
  const posted = formatPosted(job.createdAt);

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
      <p className="job-desc">{job.description?.slice(0, 200)}{job.description && job.description.length > 200 ? '…' : ''}</p>
      {job.skills && job.skills.length > 0 && (
        <div className="skill-tags">
          {job.skills.slice(0, 5).map((skill) => (
            <span key={skill} className="skill-tag">
              {skill}
            </span>
          ))}
        </div>
      )}
      <div className="job-meta">
        <span className="job-category">{job.category}</span>
        {job.contractValue != null && <span className="job-budget">{job.contractValue} USDC</span>}
        {job.duration != null && <span>{Math.round(job.duration / 86400)}d</span>}
        {isValidOnchainJobId(job.onchainJobId) && <span>On-chain #{job.onchainJobId}</span>}
        {posted && <span>Posted {posted}</span>}
        {clientAddr && (
          <span>
            Client {clientAddr.slice(0, 6)}…{clientAddr.slice(-4)}
          </span>
        )}
      </div>
      <Link to={href} className="btn ghost job-card-cta">
        View details →
      </Link>
    </li>
  );
}
