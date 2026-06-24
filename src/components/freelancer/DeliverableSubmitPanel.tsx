import { useState } from 'react';
import type { Job } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDeliverableSubmit } from '@/hooks/useJobActions';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';

interface DeliverableSubmitPanelProps {
  job: Job;
  onSubmitted?: () => void;
}

export function DeliverableSubmitPanel({ job, onSubmitted }: DeliverableSubmitPanelProps) {
  const { address, user, isAuthenticated } = useAuth();
  const { submit, txStatus, txHash, txLabel, txError, resetTx } = useDeliverableSubmit();
  const [notes, setNotes] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCid, setSuccessCid] = useState<string | null>(null);

  const isAssignedFreelancer =
    user?.role === 'freelancer' &&
    address &&
    job.freelancerAddress?.toLowerCase() === address.toLowerCase();

  if (!isAssignedFreelancer || !isValidOnchainJobId(job.onchainJobId)) return null;

  const canSubmit = ['ASSIGNED', 'IN_PROGRESS'].includes(job.status);

  if (!canSubmit && job.status !== 'SUBMITTED') {
    return (
      <section className="panel deliverable-panel">
        <h3>Submit deliverable</h3>
        <p className="muted">Waiting for escrow funding before you can start work on-chain.</p>
      </section>
    );
  }

  if (job.status === 'SUBMITTED' || successCid) {
    return (
      <section className="panel deliverable-panel">
        <h3>Deliverable</h3>
        <p className="badge success">Work submitted on-chain.</p>
        {successCid && (
          <a
            className="etherscan-link"
            href={`https://gateway.pinata.cloud/ipfs/${successCid}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on IPFS ↗
          </a>
        )}
      </section>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job.onchainJobId) return;
    if (!file && notes.trim().length < 10) {
      setError('Add a file or at least 10 characters of delivery notes.');
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
      setSuccessCid(cid);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel deliverable-panel" onSubmit={handleSubmit}>
      <h3>Submit deliverable</h3>
      <p className="muted">
        Upload to IPFS via the backend, then call <code>EscrowVault.submitWork</code> from your
        wallet. Work is auto-started if the job is still in ASSIGNED status.
      </p>

      {!isAuthenticated && <p className="muted">Sign in with SIWE to upload.</p>}

      <label className="field">
        Delivery notes
        <textarea
          className="input textarea"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Summary of what you delivered, links, or instructions…"
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
        disabled={loading || txStatus === 'pending' || !isAuthenticated}
      >
        {loading || txStatus === 'pending' ? 'Submitting…' : 'Upload & submit on-chain'}
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
