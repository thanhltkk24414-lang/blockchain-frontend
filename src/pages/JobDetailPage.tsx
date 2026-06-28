import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { fetchBidsByJob, fetchJobById, type Bid, type Job, type JobMetadata } from '@/lib/api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MilestoneProgress } from '@/components/shared/MilestoneProgress';
import { EscrowDepositPanel } from '@/components/client/EscrowDepositPanel';
import { AcceptBidButton } from '@/components/client/AcceptBidButton';
import { ClientJobActionsPanel } from '@/components/client/ClientJobActionsPanel';
import { BidForm } from '@/components/freelancer/BidForm';
import { DeliverableSubmitPanel } from '@/components/freelancer/DeliverableSubmitPanel';
import { DisputeEvidencePanel } from '@/components/dispute/DisputeEvidencePanel';
import { ArbitratorDisputePanel } from '@/components/dispute/ArbitratorDisputePanel';
import { DisputeResultPanel } from '@/components/dispute/DisputeResultPanel';
import { useAuth } from '@/context/AuthContext';
import {
  etherscanAddressUrl,
  isValidOnchainJobId,
} from '@/lib/utils/etherscan';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { OnchainEscrowStatus } from '@/components/shared/OnchainEscrowStatus';
import { WalletMismatchBanner } from '@/components/shared/WalletMismatchBanner';
import { formatApiDate } from '@/lib/utils/dates';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import { effectiveJobStatus } from '@/lib/utils/onchainJob';

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const days = Math.round(seconds / 86400);
  return days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${seconds} sec`;
}

function resolveClientAddress(job: Job): string | null {
  if (typeof job.client === 'object' && job.client?.walletAddress) {
    return job.client.walletAddress.toLowerCase();
  }
  if (typeof job.client === 'string') return job.client.toLowerCase();
  return null;
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [metadata, setMetadata] = useState<JobMetadata | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    onchainStatus,
    onchainStatusLabel,
    loading: chainLoading,
    refetch: refetchOnChain,
  } = useOnChainJob(job?.onchainJobId, job?.status);

  const displayStatus =
    job != null ? effectiveJobStatus(job.status, onchainStatus) : 'OPEN';

  const loadBids = useCallback(() => {
    if (!id) return;
    fetchBidsByJob(id)
      .then((res) => {
        if (res.success) setBids(res.bids || []);
      })
      .catch(() => {});
  }, [id]);

  const reloadJob = useCallback(() => {
    if (!id) return;
    fetchJobById(id)
      .then((res) => {
        if (res.success && res.job) {
          setJob(res.job);
          setMetadata(res.metadata ?? null);
        }
      })
      .catch(() => {});
    loadBids();
    void refetchOnChain();
  }, [id, loadBids, refetchOnChain]);

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
  }, [id, loadBids]);

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
  const clientAddr =
    job.clientAddress?.toLowerCase() ?? resolveClientAddress(job);
  const isJobOwner = Boolean(
    user?.walletAddress &&
      clientAddr &&
      user.walletAddress.toLowerCase() === clientAddr,
  );
  const canManageJob = isJobOwner && isAuthenticated;
  const isOnPublicJobRoute = /^\/jobs\/[^/]+$/.test(location.pathname);
  const showBidForm =
    job.status === 'OPEN' &&
    user?.role === 'freelancer' &&
    !job.freelancerAddress &&
    !bids.some((b) => b.status?.toLowerCase() === 'accepted');

  const hasAcceptedBid = bids.some((b) => b.status?.toLowerCase() === 'accepted');

  return (
    <main className="page job-detail">
      <div className="page-header">
        <Link to={isJobOwner ? '/client' : '/browse'} className="muted back-link">
          ← {isJobOwner ? 'Client dashboard' : 'Browse jobs'}
        </Link>
        <div className="job-detail-header">
          <h2>{job.title}</h2>
          <StatusBadge status={displayStatus} />
          {chainLoading && onchainStatus == null && (
            <span className="muted phase-note">Reading on-chain…</span>
          )}
        </div>
        <p className="muted">{job.description}</p>
      </div>

      {isJobOwner && isOnPublicJobRoute && (
        <section className="panel client-manage-banner">
          <p>
            You posted this job.{' '}
            <Link to={`/client/jobs/${job._id}`} className="etherscan-link">
              Manage as client →
            </Link>
          </p>
          <p className="muted phase-note">
            Accept proposals, fund escrow, and review deliverables from the client job view.
          </p>
        </section>
      )}

      {isJobOwner && !isAuthenticated && (
        <section className="panel">
          <p className="muted">Connect your wallet and sign in to accept proposals and manage this job.</p>
        </section>
      )}

      <WalletMismatchBanner job={job} isJobOwner={isJobOwner && isAuthenticated} />

      <div className="job-detail-grid">
        <section className="panel">
          <h3>Details</h3>
          <dl className="detail-grid">
            <dt>Category</dt>
            <dd>{job.category}</dd>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={displayStatus} />
              {import.meta.env.DEV && onchainStatusLabel && displayStatus !== job.status?.toUpperCase() && (
                <p className="muted phase-note">
                  DB: {job.status?.toUpperCase()} → on-chain: <strong>{onchainStatusLabel}</strong>
                </p>
              )}
              {(displayStatus === 'ASSIGNED' || job.status?.toUpperCase() === 'ASSIGNED') && (
                <OnchainEscrowStatus
                  onchainJobId={job.onchainJobId}
                  dbStatus={displayStatus}
                />
              )}
            </dd>
            <dt>Budget</dt>
            <dd>{job.contractValue != null ? `${job.contractValue} USDC` : '—'}</dd>
            <dt>Duration</dt>
            <dd>{formatDuration(job.duration)}</dd>
            <dt>Created</dt>
            <dd>{formatApiDate(job.createdAt)}</dd>
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

        <section className="panel panel-onchain">
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
          <MilestoneProgress status={displayStatus} />
        </section>
      </div>

      {showBidForm && (
        <BidForm
          jobId={job._id}
          onchainJobId={job.onchainJobId}
          jobTitle={job.title}
          suggestedBudget={job.contractValue}
          onSubmitted={loadBids}
        />
      )}

      <DeliverableSubmitPanel job={job} onSubmitted={reloadJob} />
      <ArbitratorDisputePanel job={job} onActionComplete={reloadJob} />
      <DisputeResultPanel job={job} onActionComplete={reloadJob} />
      <DisputeEvidencePanel job={job} />

      {canManageJob && bids.length > 0 && (
        <section className="panel">
          <h3>Proposals ({bids.length})</h3>
          {hasAcceptedBid && job.status === 'OPEN' && (
            <p className="muted phase-note">
              One proposal is accepted — fund escrow on-chain to assign the freelancer. Other bids
              are closed.
            </p>
          )}
          {job.status !== 'OPEN' && !hasAcceptedBid && (
            <p className="muted phase-note">
              This job is no longer open — new accepts are disabled.
            </p>
          )}
          <ul className="bids-list">
            {bids.map((bid) => (
              <li key={bid._id} className="bid-item">
                <strong>{bid.title || 'Proposal'}</strong>
                <span className="muted">
                  {bid.bidAmount} USDC · {bid.timeline} days · {bid.status}
                </span>
                <p>{bid.description}</p>
                <span className="muted mono">{bid.freelancerAddress}</span>
                <AcceptBidButton
                  bid={bid}
                  onchainJobId={job.onchainJobId}
                  jobStatus={job.status}
                  hasAcceptedBid={hasAcceptedBid}
                  onAccepted={reloadJob}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManageJob && <ClientJobActionsPanel job={job} onActionComplete={reloadJob} />}
      {canManageJob && <EscrowDepositPanel job={job} bids={bids} />}
    </main>
  );
}
