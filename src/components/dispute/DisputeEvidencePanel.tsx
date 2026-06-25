import { useEffect, useState } from 'react';
import type { Job } from '@/lib/api';
import { fetchDisputeByJob, uploadIpfsMetadata } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDisputeActions } from '@/hooks/useDisputeActions';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { addressesEqual } from '@/lib/utils/address';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';
import { ONCHAIN_JOB_STATUS } from '@/lib/utils/onchainJob';

interface DisputeEvidencePanelProps {
  job: Job;
}

export function DisputeEvidencePanel({ job }: DisputeEvidencePanelProps) {
  const { address, isAuthenticated } = useAuth();
  const { onchainStatus } = useOnChainJob(job.onchainJobId, job.status);
  const { submitEvidence, txStatus, txHash, txLabel, txError, resetTx } = useDisputeActions();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeInfo, setDisputeInfo] = useState<string | null>(null);

  const isDisputed =
    onchainStatus === ONCHAIN_JOB_STATUS.DISPUTED || job.status?.toUpperCase() === 'DISPUTED';

  const isParty = Boolean(
    address &&
      (addressesEqual(address, job.clientAddress) ||
        addressesEqual(address, job.freelancerAddress)),
  );

  useEffect(() => {
    if (!job._id || !isDisputed) return;
    fetchDisputeByJob(job._id)
      .then((res) => {
        if (res.success && res.dispute) {
          const count = res.dispute.evidence?.length ?? 0;
          setDisputeInfo(`${count} bằng chứng đã lưu off-chain`);
        }
      })
      .catch(() => {});
  }, [job._id, isDisputed]);

  if (!isDisputed || !isValidOnchainJobId(job.onchainJobId)) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job.onchainJobId || !address) return;
    if (notes.trim().length < 10) {
      setError('Mô tả bằng chứng ít nhất 10 ký tự.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const upload = await uploadIpfsMetadata({
        type: 'dispute_evidence',
        jobId: job._id,
        onchainJobId: job.onchainJobId,
        submitter: address,
        description: notes.trim(),
        submittedAt: new Date().toISOString(),
      });
      await submitEvidence(job.onchainJobId, upload.cid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nộp bằng chứng thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel dispute-panel">
      <h3>Tranh chấp — nộp bằng chứng</h3>
      <p className="muted">
        Job đang <strong>DISPUTED</strong>. Client hoặc freelancer có thể nộp bằng chứng trong{' '}
        <strong>{DISPUTE_PHASES.evidenceRebuttalEndMin} phút</strong> đầu (on-chain{' '}
        <code>submitEvidence</code>).
      </p>
      {disputeInfo && <p className="muted phase-note">{disputeInfo}</p>}

      {!isParty && (
        <p className="muted">Chỉ client/freelancer của job mới nộp được bằng chứng.</p>
      )}

      {isParty && (
        <form onSubmit={handleSubmit}>
          <label className="field">
            Mô tả bằng chứng
            <textarea
              className="input textarea"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Giải thích lý do tranh chấp, link file, screenshot…"
            />
          </label>
          <button
            className="btn primary"
            type="submit"
            disabled={loading || txStatus === 'pending' || !isAuthenticated}
          >
            {loading || txStatus === 'pending' ? txLabel || 'Đang gửi…' : 'Upload IPFS + nộp on-chain'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}

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
