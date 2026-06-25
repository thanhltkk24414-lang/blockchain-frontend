import { useState } from 'react';
import type { Job } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useClientJobActions } from '@/hooks/useJobActions';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { ONCHAIN_JOB_STATUS } from '@/lib/utils/onchainJob';

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
  const { onchainStatus, onchainJob, onchainStatusLabel, loading: chainLoading, refetch } =
    useOnChainJob(job.onchainJobId, job.status);
  const [busy, setBusy] = useState<'approve' | 'dispute' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientAddr = resolveClientAddress(job);
  const isClient =
    user?.role === 'client' &&
    Boolean(address && clientAddr && address.toLowerCase() === clientAddr);

  if (!isClient || !isValidOnchainJobId(job.onchainJobId)) return null;

  const canApprove = !chainLoading && onchainStatus === ONCHAIN_JOB_STATUS.SUBMITTED;
  const canDispute = !chainLoading && onchainStatus === ONCHAIN_JOB_STATUS.SUBMITTED;

  if (chainLoading) {
    return (
      <section className="panel client-actions-panel">
        <h3>Phê duyệt bàn giao</h3>
        <p className="muted">Đang đọc trạng thái on-chain…</p>
      </section>
    );
  }

  if (!canApprove && !canDispute) return null;

  async function handleApprove() {
    if (!job.onchainJobId) return;
    setBusy('approve');
    setError(null);
    try {
      await approveAndRelease(job.onchainJobId);
      await refetch();
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Phê duyệt thất bại');
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
      await refetch();
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Khiếu nại thất bại');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel client-actions-panel">
      <h3>Phê duyệt bàn giao</h3>
      <p className="muted">
        Freelancer đã nộp bàn giao on-chain ({onchainStatusLabel ?? 'SUBMITTED'}). Xem CID, phê
        duyệt để giải phóng USDC cho freelancer, hoặc khiếu nại để đóng băng escrow.
      </p>
      {onchainJob?.deliverableCID && (
        <p className="muted mono">
          CID:{' '}
          <a
            className="etherscan-link"
            href={`https://gateway.pinata.cloud/ipfs/${onchainJob.deliverableCID}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {onchainJob.deliverableCID} ↗
          </a>
        </p>
      )}
      <div className="form-actions">
        {canApprove && (
          <button
            className="btn primary"
            type="button"
            onClick={handleApprove}
            disabled={busy !== null || txStatus === 'pending'}
          >
            {busy === 'approve' ? 'Đang phê duyệt…' : 'Phê duyệt & giải phóng USDC'}
          </button>
        )}
        {canDispute && (
          <button
            className="btn ghost"
            type="button"
            onClick={handleDispute}
            disabled={busy !== null || txStatus === 'pending'}
          >
            {busy === 'dispute' ? 'Đang gửi…' : 'Khiếu nại'}
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
