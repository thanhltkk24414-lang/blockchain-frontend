import { useEffect, useState } from 'react';
import type { Job } from '@/lib/api';
import {
  fetchDisputeByJob,
  submitDisputeEvidence,
  uploadIpfsFile,
  uploadIpfsMetadata,
} from '@/lib/api';
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
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeInfo, setDisputeInfo] = useState<string | null>(null);
  const [disputeId, setDisputeId] = useState<string | null>(null);

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
          setDisputeId(res.dispute._id);
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

    const trimmedNotes = notes.trim();
    const trimmedUrl = evidenceUrl.trim();
    const hasContent = trimmedNotes.length >= 10 || Boolean(imageFile) || trimmedUrl.length > 0;

    if (!hasContent) {
      setError('Thêm mô tả (≥10 ký tự), URL hoặc ảnh đính kèm.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let imageCid: string | undefined;
      if (imageFile) {
        const imageUpload = await uploadIpfsFile(imageFile);
        imageCid = imageUpload.cid;
      }

      const upload = await uploadIpfsMetadata({
        type: 'dispute_evidence',
        jobId: job._id,
        onchainJobId: job.onchainJobId,
        submitter: address,
        description: trimmedNotes || undefined,
        evidenceUrl: trimmedUrl || undefined,
        imageCid,
        submittedAt: new Date().toISOString(),
      });

      if (!upload.cid?.trim()) {
        throw new Error('IPFS không trả về CID — thử lại upload.');
      }

      await submitEvidence(job.onchainJobId, upload.cid);

      if (disputeId) {
        try {
          await submitDisputeEvidence(disputeId, {
            ipfsHash: upload.cid,
            description: trimmedNotes || trimmedUrl || undefined,
          });
        } catch {
          /* on-chain submit succeeded; off-chain backup is optional */
        }
      }

      setNotes('');
      setEvidenceUrl('');
      setImageFile(null);
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
              placeholder="Giải thích lý do tranh chấp, tóm tắt nội dung đính kèm…"
            />
          </label>

          <label className="field">
            Link bằng chứng (tùy chọn)
            <input
              className="input full"
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://drive.google.com/… hoặc link demo/screenshot"
            />
          </label>

          <label className="field">
            Ảnh đính kèm (tùy chọn)
            <input
              className="input full"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            {imageFile && <span className="muted phase-note">{imageFile.name}</span>}
          </label>

          <button
            className="btn primary"
            type="submit"
            disabled={loading || txStatus === 'pending' || !isAuthenticated}
          >
            {loading || txStatus === 'pending'
              ? txLabel || 'Đang gửi…'
              : 'Upload IPFS + nộp on-chain'}
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
