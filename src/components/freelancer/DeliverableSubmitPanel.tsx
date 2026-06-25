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
  const [successCid, setSuccessCid] = useState<string | null>(null);

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

  const onchainSubmitted =
    onchainStatus === ONCHAIN_JOB_STATUS.SUBMITTED ||
    job.onchainStatus === 'SUBMITTED' ||
    job.status === 'SUBMITTED';

  if (!isAssignedFreelancer || !isValidOnchainJobId(job.onchainJobId)) return null;

  const isOnchainAssigned = onchainStatus === ONCHAIN_JOB_STATUS.ASSIGNED;
  const isOnchainInProgress = onchainStatus === ONCHAIN_JOB_STATUS.IN_PROGRESS;
  const twoStepFlow = isOnchainAssigned && !walletMismatch;

  const canSubmit =
    isOnchainAssigned ||
    isOnchainInProgress ||
    ['ASSIGNED', 'IN_PROGRESS'].includes(job.status);

  if (!canSubmit && !onchainSubmitted && !successCid) {
    return (
      <section className="panel deliverable-panel">
        <h3>Nộp bàn giao</h3>
        <p className="muted">Chờ client nạp escrow trước khi bạn có thể bắt đầu làm việc on-chain.</p>
      </section>
    );
  }

  if (onchainSubmitted || successCid) {
    return (
      <section className="panel deliverable-panel">
        <h3>Bàn giao</h3>
        <p className="badge success">Đã nộp bàn giao on-chain ({chainLabel ?? 'SUBMITTED'}).</p>
        {onchainJob?.deliverableCID && (
          <p className="muted mono">CID: {onchainJob.deliverableCID}</p>
        )}
        {successCid && (
          <a
            className="etherscan-link"
            href={`https://gateway.pinata.cloud/ipfs/${successCid}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Xem trên IPFS ↗
          </a>
        )}
      </section>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job.onchainJobId) return;
    if (walletMismatch) return;
    if (!file && notes.trim().length < 10) {
      setError('Thêm file hoặc ghi chú bàn giao ít nhất 10 ký tự.');
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
      await refetch();
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nộp bàn giao thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel deliverable-panel" onSubmit={handleSubmit}>
      <h3>Nộp bàn giao</h3>
      <p className="muted">
        Hệ thống mô phỏng giao dịch on-chain trước khi gửi ví. Khi job còn ASSIGNED, luồng nộp gồm{' '}
        <strong>2 bước</strong>: <code>startWork</code> (chờ xác nhận) → upload IPFS →{' '}
        <code>submitWork</code>.
      </p>

      {chainLoading && <p className="muted">Đang đọc trạng thái on-chain…</p>}

      {onchainFreelancerCs && walletCs && (
        <dl className="detail-grid wallet-compare">
          <dt>Freelancer on-chain</dt>
          <dd className="mono">{onchainFreelancerCs}</dd>
          <dt>Ví MetaMask</dt>
          <dd className={walletMismatch ? 'error mono' : 'mono'}>{walletCs}</dd>
          {onchainStatus != null && (
            <>
              <dt>Trạng thái on-chain</dt>
              <dd>
                <strong>{chainLabel ?? onchainStatusLabel(onchainStatus)}</strong>
              </dd>
            </>
          )}
        </dl>
      )}

      {walletMismatch && onchainFreelancerCs && walletCs && (
        <p className="error">
          Ví không khớp — chỉ <code className="mono">{onchainFreelancerCs}</code> mới gọi được{' '}
          <code>submitWork</code>. Địa chỉ bạn đang dùng: <code className="mono">{walletCs}</code>{' '}
          (khác byte, không chỉ khác chữ hoa).
        </p>
      )}

      {twoStepFlow && (
        <p className="badge info">
          <strong>Bước 1/2:</strong> <code>startWork</code> (ASSIGNED → IN_PROGRESS) —{' '}
          <strong>Bước 2/2:</strong> <code>submitWork</code>. MetaMask sẽ hỏi 2 lần; đừng bỏ qua bước
          1.
        </p>
      )}

      {isOnchainAssigned && walletMismatch && (
        <p className="error muted">
          Job đang ASSIGNED — cần <code>startWork</code> trước <code>submitWork</code>, nhưng ví không
          khớp freelancer on-chain.
        </p>
      )}

      {!isAuthenticated && <p className="muted">Đăng nhập SIWE để upload file.</p>}

      <label className="field">
        Ghi chú bàn giao
        <textarea
          className="input textarea"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tóm tắt nội dung đã giao, link hoặc hướng dẫn…"
        />
      </label>

      <label className="field">
        Repository / demo URL (tùy chọn)
        <input
          className="input full"
          type="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/…"
        />
      </label>

      <label className="field">
        Đính kèm file (tùy chọn)
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
          ? txLabel || 'Đang nộp…'
          : twoStepFlow
            ? 'Bước 1–2: startWork + nộp bàn giao'
            : 'Kiểm tra & nộp on-chain'}
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
