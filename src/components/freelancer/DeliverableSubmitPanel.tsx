import { useState } from 'react';
import type { Job } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDeliverableSubmit } from '@/hooks/useJobActions';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { addressesEqual, tryChecksumAddress } from '@/lib/utils/address';
import {
  isNonZeroAddress,
  ONCHAIN_JOB_STATUS,
  onchainStatusLabel,
} from '@/lib/utils/onchainJob';

interface DeliverableSubmitPanelProps {
  job: Job;
  onSubmitted?: () => void;
}

export function DeliverableSubmitPanel({ job, onSubmitted }: DeliverableSubmitPanelProps) {
  const { address, user, isAuthenticated } = useAuth();
  const { submit, txStatus, txHash, txLabel, txError, resetTx } = useDeliverableSubmit();
  const {
    onchainJob,
    onchainStatus,
    onchainFreelancer,
    onchainStatusLabel: chainLabel,
    loading: chainLoading,
    refetch,
  } = useOnChainJob(job.onchainJobId, job.status);

  const [notes, setNotes] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletCs = tryChecksumAddress(address);
  const rawOnchainFreelancer =
    (isNonZeroAddress(job.onchainFreelancerAddress) && job.onchainFreelancerAddress) ||
    (isNonZeroAddress(onchainFreelancer) && onchainFreelancer) ||
    (isNonZeroAddress(job.freelancerAddress) && job.freelancerAddress) ||
    null;
  const onchainFreelancerCs = rawOnchainFreelancer
    ? tryChecksumAddress(rawOnchainFreelancer)
    : null;

  const isAssignedFreelancer =
    user?.role === 'freelancer' &&
    walletCs &&
    job.freelancerAddress &&
    addressesEqual(walletCs, job.freelancerAddress);

  const walletMismatch = Boolean(
    walletCs && onchainFreelancerCs && !addressesEqual(walletCs, onchainFreelancerCs),
  );

  const onchainSubmitted = !chainLoading && onchainStatus === ONCHAIN_JOB_STATUS.SUBMITTED;

  if (!isAssignedFreelancer || !isValidOnchainJobId(job.onchainJobId)) return null;

  const isOnchainAssigned = onchainStatus === ONCHAIN_JOB_STATUS.ASSIGNED;
  const isOnchainInProgress = onchainStatus === ONCHAIN_JOB_STATUS.IN_PROGRESS;
  const twoStepFlow = isOnchainAssigned && !walletMismatch;

  const canSubmit =
    !chainLoading &&
    (isOnchainAssigned || isOnchainInProgress);

  if (chainLoading) {
    return (
      <section className="panel deliverable-panel">
        <h3>Submit deliverable</h3>
        <p className="muted">Reading on-chain status…</p>
      </section>
    );
  }

  if (!canSubmit && !onchainSubmitted) {
    const terminal =
      onchainStatus === ONCHAIN_JOB_STATUS.COMPLETED ||
      onchainStatus === ONCHAIN_JOB_STATUS.REFUNDED ||
      onchainStatus === ONCHAIN_JOB_STATUS.CANCELLED ||
      onchainStatus === ONCHAIN_JOB_STATUS.DISPUTED;

    if (terminal) {
      if (onchainStatus === ONCHAIN_JOB_STATUS.COMPLETED) {
        return (
          <section className="panel deliverable-panel">
            <h3>Deliverable</h3>
            <p className="badge success">Job completed on-chain (COMPLETED).</p>
          </section>
        );
      }
      if (onchainStatus === ONCHAIN_JOB_STATUS.DISPUTED) {
        return null;
      }
      return (
        <section className="panel deliverable-panel">
          <h3>Submit deliverable</h3>
          <p className="muted">
            On-chain job: <strong>{chainLabel ?? onchainStatusLabel(onchainStatus!)}</strong> — cannot
            submit a deliverable.
          </p>
        </section>
      );
    }

    return (
      <section className="panel deliverable-panel">
        <h3>Submit deliverable</h3>
        <p className="muted">Wait for the client to fund escrow before you can start work on-chain.</p>
      </section>
    );
  }

  if (onchainSubmitted) {
    return (
      <section className="panel deliverable-panel">
        <h3>Deliverable</h3>
        <p className="badge success">Deliverable submitted on-chain ({chainLabel ?? 'SUBMITTED'}).</p>
        {onchainJob?.deliverableCID && (
          <p className="muted mono">CID: {onchainJob.deliverableCID}</p>
        )}
        {onchainJob?.deliverableCID && (
          <a
            className="etherscan-link"
            href={`https://gateway.pinata.cloud/ipfs/${onchainJob.deliverableCID}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on IPFS ↗
          </a>
        )}
        <p className="muted phase-note">Awaiting client approval and escrow release.</p>
      </section>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job.onchainJobId) return;
    if (walletMismatch) return;
    if (!file && notes.trim().length < 10) {
      setError('Add a file or deliverable notes of at least 10 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const cid = await submit({
        onchainJobId: job.onchainJobId,
        jobTitle: job.title,
        file,
        notes: notes.trim(),
        repoUrl: repoUrl.trim() || undefined,
      });
      void cid;
      await refetch();
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit deliverable');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel deliverable-panel" onSubmit={handleSubmit}>
      <h3>Submit deliverable</h3>
      <p className="muted">
        The system simulates the on-chain transaction before sending to your wallet. When the job is
        ASSIGNED, submission is a <strong>2-step</strong> flow: <code>startWork</code> (await
        confirmation) → IPFS upload → <code>submitWork</code>.
      </p>

      {chainLoading && <p className="muted">Reading on-chain status…</p>}

      {onchainFreelancerCs && walletCs && (
        <dl className="detail-grid wallet-compare">
          <dt>On-chain freelancer</dt>
          <dd className="mono">{onchainFreelancerCs}</dd>
          <dt>MetaMask wallet</dt>
          <dd className={walletMismatch ? 'error mono' : 'mono'}>{walletCs}</dd>
          {onchainStatus != null && (
            <>
              <dt>On-chain status</dt>
              <dd>
                <strong>{chainLabel ?? onchainStatusLabel(onchainStatus)}</strong>
              </dd>
            </>
          )}
        </dl>
      )}

      {walletMismatch && onchainFreelancerCs && walletCs && (
        <p className="error">
          Wallet mismatch — only <code className="mono">{onchainFreelancerCs}</code> can call{' '}
          <code>submitWork</code>. Your address: <code className="mono">{walletCs}</code> (different
          bytes, not just different casing).
        </p>
      )}

      {twoStepFlow && (
        <p className="badge info">
          <strong>Step 1/2:</strong> <code>startWork</code> (ASSIGNED → IN_PROGRESS) —{' '}
          <strong>Step 2/2:</strong> <code>submitWork</code>. MetaMask will prompt twice; do not skip
          step 1.
        </p>
      )}

      {isOnchainAssigned && walletMismatch && (
        <p className="error muted">
          Job is ASSIGNED — <code>startWork</code> is required before <code>submitWork</code>, but
          your wallet does not match the on-chain freelancer.
        </p>
      )}

      {!isAuthenticated && <p className="muted">Sign in with SIWE to upload files.</p>}

      <label className="field">
        Deliverable notes
        <textarea
          className="input textarea"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Summary of what was delivered, links, or instructions…"
        />
      </label>

      <label className="field">
        Repository / demo URL (optional)
        <input
          className="input full"
          type="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/…"
        />
      </label>

      <label className="field">
        Attach file (optional)
        <input
          className="input full"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <button
        className="btn primary"
        type="submit"
        disabled={
          loading ||
          txStatus === 'pending' ||
          chainLoading ||
          !isAuthenticated ||
          Boolean(walletMismatch) ||
          (isOnchainAssigned && chainLoading)
        }
      >
        {loading || txStatus === 'pending'
          ? txLabel || 'Submitting…'
          : twoStepFlow
            ? 'Steps 1–2: startWork + submit deliverable'
            : 'Verify & submit on-chain'}
      </button>

      {error && <p className="error">{error}</p>}

      <TxStatusModal
        open={txStatus !== 'idle'}
        status={txStatus}
        label={txLabel}
        hash={txHash}
        error={txError}
        onClose={resetTx}
      />
    </form>
  );
}
