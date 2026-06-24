import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchBidsByJob, fetchJobById, type Bid, type Job, type JobMetadata } from '@/lib/api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MilestoneProgress } from '@/components/shared/MilestoneProgress';
import { EscrowDepositPanel } from '@/components/client/EscrowDepositPanel';
import { BidForm } from '@/components/freelancer/BidForm';
import { DeliverableSubmitPanel } from '@/components/freelancer/DeliverableSubmitPanel';
import { useAuth } from '@/context/AuthContext';
import {
  etherscanAddressUrl,
  isValidOnchainJobId,
} from '@/lib/utils/etherscan';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const days = Math.round(seconds / 86400);
  return days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${seconds} sec`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [metadata, setMetadata] = useState<JobMetadata | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBids = () => {
    if (!id) return;
    fetchBidsByJob(id)
      .then((res) => {
        if (res.success) setBids(res.bids || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchJobById(id)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.job) {
          setJob(res.job);
          setMetadata(res.metadata ?? null);
        } else {
          setError('Job not found');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load job');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    loadBids();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="page">
        <p className="muted">Loading job…</p>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="page">
        <p className="error">{error ?? 'Job not found'}</p>
        <Link to="/browse" className="btn ghost">
          Back to browse
        </Link>
      </main>
    );
  }

  const deliverables = metadata?.deliverables ?? job.deliverables;
  const acceptance = metadata?.acceptanceCriteria ?? job.acceptanceCriteria;
  const skills = metadata?.skills ?? job.skills;
  const isClientView = user?.role === 'client';
  const showBidForm = job.status === 'OPEN' && user?.role === 'freelancer';

  return (
    <main className="page job-detail">
      <div className="page-header">
        <Link to={isClientView ? '/client' : '/browse'} className="muted back-link">
          ← {isClientView ? 'Client dashboard' : 'Browse jobs'}
        </Link>
        <div className="job-detail-header">
          <h2>{job.title}</h2>
          <StatusBadge status={job.status} />
        </div>
        <p className="muted">{job.description}</p>
      </div>

      <div className="job-detail-grid">
        <section className="panel">
          <h3>Details</h3>
          <dl className="detail-grid">
            <dt>Category</dt>
            <dd>{job.category}</dd>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={job.status} />
            </dd>
            <dt>Budget</dt>
            <dd>{job.contractValue != null ? `${job.contractValue} USDC` : '—'}</dd>
            <dt>Duration</dt>
            <dd>{formatDuration(job.duration)}</dd>
            <dt>Created</dt>
            <dd>{formatDate(job.createdAt)}</dd>
            {skills && skills.length > 0 && (
              <>
                <dt>Skills</dt>
                <dd>{skills.join(', ')}</dd>
              </>
            )}
            {deliverables && (
              <>
                <dt>Deliverables</dt>
                <dd>{deliverables}</dd>
              </>
            )}
            {acceptance && (
              <>
                <dt>Acceptance criteria</dt>
                <dd>{acceptance}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="panel">
          <h3>On-chain</h3>
          <dl className="detail-grid">
            <dt>On-chain job ID</dt>
            <dd>
              {isValidOnchainJobId(job.onchainJobId) ? (
                <a
                  href={etherscanAddressUrl(CONTRACT_ADDRESSES.JobRegistry)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="etherscan-link"
                >
                  #{job.onchainJobId} on JobRegistry ↗
                </a>
              ) : (
                <span className="muted">
                  {job.onchainJobId != null
                    ? `#${job.onchainJobId} (off-chain fallback — contract may have failed)`
                    : 'Not registered on-chain'}
                </span>
              )}
            </dd>
            {job.metadataCID && (
              <>
                <dt>Metadata CID</dt>
                <dd>
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${job.metadataCID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="etherscan-link"
                  >
                    {job.metadataCID.slice(0, 18)}… ↗
                  </a>
                </dd>
              </>
            )}
            {job.totalDeposit != null && (
              <>
                <dt>Total deposit</dt>
                <dd>{job.totalDeposit} USDC</dd>
              </>
            )}
          </dl>
          <MilestoneProgress status={job.status} />
        </section>
      </div>

      {showBidForm && (
        <BidForm
          jobId={job._id}
          jobTitle={job.title}
          suggestedBudget={job.contractValue}
          onSubmitted={loadBids}
        />
      )}

      <DeliverableSubmitPanel job={job} />

      {isClientView && bids.length > 0 && (
        <section className="panel">
          <h3>Proposals ({bids.length})</h3>
          <ul className="bids-list">
            {bids.map((bid) => (
              <li key={bid._id} className="bid-item">
                <strong>{bid.title || 'Proposal'}</strong>
                <span className="muted">
                  {bid.bidAmount} USDC · {bid.timeline} days · {bid.status}
                </span>
                <p>{bid.description}</p>
                <span className="muted mono">{bid.freelancerAddress}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isClientView && <EscrowDepositPanel job={job} />}
    </main>
  );
}
