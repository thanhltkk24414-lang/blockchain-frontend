import { useState } from 'react';
import type { Job } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useClientJobActions } from '@/hooks/useJobActions';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';

interface ClientJobActionsPanelProps {
  job: Job;
  onActionComplete?: () => void;
}

function resolveClientAddress(job: Job): string | null {
  if (job.clientAddress) return job.clientAddress.toLowerCase();
  if (typeof job.client === 'object' && job.client?.walletAddress) {
    return job.client.walletAddress.toLowerCase();
  }
  return null;
}

export function ClientJobActionsPanel({ job, onActionComplete }: ClientJobActionsPanelProps) {
  const { address, user } = useAuth();
  const { approveAndRelease, raiseDispute, txStatus, txHash, txLabel, txError, resetTx } =
    useClientJobActions();
  const [busy, setBusy] = useState<'approve' | 'dispute' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientAddr = resolveClientAddress(job);
  const isClient =
    user?.role === 'client' &&
    Boolean(address && clientAddr && address.toLowerCase() === clientAddr);

  if (!isClient || !isValidOnchainJobId(job.onchainJobId)) return null;

  const canReview = job.status === 'SUBMITTED' || job.status === 'IN_PROGRESS';
  const canDispute = job.status === 'SUBMITTED';

  if (!canReview && !canDispute) return null;

  async function handleApprove() {
    if (!job.onchainJobId) return;
    setBusy('approve');
    setError(null);
    try {
      await approveAndRelease(job.onchainJobId);
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleDispute() {
    if (!job.onchainJobId || !job.contractValue) return;
    setBusy('dispute');
    setError(null);
    try {
      await raiseDispute(job.onchainJobId, job.contractValue);
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispute failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel client-actions-panel">
      <h3>Review deliverable</h3>
      <p className="muted">
        Approve work to release USDC to the freelancer, or raise a dispute to freeze escrow and
        start arbitrator voting.
      </p>
      <div className="form-actions">
        {canReview && (
          <button
            className="btn primary"
            type="button"
            onClick={handleApprove}
            disabled={busy !== null || txStatus === 'pending'}
          >
            {busy === 'approve' ? 'Approving…' : 'Approve & release funds'}
          </button>
        )}
        {canDispute && (
          <button
            className="btn ghost"
            type="button"
            onClick={handleDispute}
            disabled={busy !== null || txStatus === 'pending'}
          >
            {busy === 'dispute' ? 'Raising…' : 'Raise dispute'}
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <TxStatusModal
        open={txStatus !== 'idle'}
        status={txStatus}
        label={txLabel}
        hash={txHash}
        error={txError}
        onClose={resetTx}
      />
    </section>
  );
}
