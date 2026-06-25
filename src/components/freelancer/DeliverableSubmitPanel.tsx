import { useEffect, useState } from 'react';
import { readContract } from 'wagmi/actions';
import type { Address } from 'viem';
import type { Job } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDeliverableSubmit } from '@/hooks/useJobActions';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import {
  ONCHAIN_JOB_STATUS,
  onchainStatusLabel,
  shortAddress,
  type OnChainJob,
} from '@/lib/utils/onchainJob';

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
  const [onchainFreelancer, setOnchainFreelancer] = useState<Address | null>(null);
  const [onchainStatus, setOnchainStatus] = useState<number | null>(null);

  const isAssignedFreelancer =
    user?.role === 'freelancer' &&
    address &&
    job.freelancerAddress?.toLowerCase() === address.toLowerCase();

  useEffect(() => {
    if (!isValidOnchainJobId(job.onchainJobId)) return;
    let cancelled = false;

    readContract(wagmiConfig, {
      ...contracts.jobRegistry,
      functionName: 'getJob',
      args: [BigInt(job.onchainJobId!)],
    })
      .then((raw) => {
        if (cancelled) return;
        const chainJob = raw as OnChainJob;
        setOnchainFreelancer(chainJob.freelancer);
        setOnchainStatus(chainJob.status);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [job.onchainJobId, job.status]);

  if (!isAssignedFreelancer || !isValidOnchainJobId(job.onchainJobId)) return null;

  const walletMismatch =
    address &&
    onchainFreelancer &&
    onchainFreelancer.toLowerCase() !== address.toLowerCase();

  const canSubmit = ['ASSIGNED', 'IN_PROGRESS'].includes(job.status);

  if (!canSubmit && job.status !== 'SUBMITTED') {
    return (
      <section className="panel deliverable-panel">
        <h3>Nộp bàn giao</h3>
        <p className="muted">Chờ client nạp escrow trước khi bạn có thể bắt đầu làm việc on-chain.</p>
      </section>
    );
  }

  if (job.status === 'SUBMITTED' || successCid) {
    return (
      <section className="panel deliverable-panel">
        <h3>Bàn giao</h3>
        <p className="badge success">Đã nộp bàn giao on-chain.</p>
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
        Upload lên IPFS qua backend, sau đó gọi <code>EscrowVault.submitWork</code> từ ví
        freelancer. Nếu job còn ASSIGNED, hệ thống tự gọi <code>startWork</code> trước.
      </p>

      {onchainFreelancer && address && (
        <p className="muted">
          Freelancer on-chain: <code>{shortAddress(onchainFreelancer)}</code>
          {onchainStatus != null && (
            <>
              {' '}
              · Trạng thái: <strong>{onchainStatusLabel(onchainStatus)}</strong>
            </>
          )}
        </p>
      )}

      {walletMismatch && (
        <p className="error">
          Ví MetaMask ({shortAddress(address!)}) không trùng freelancer on-chain (
          {shortAddress(onchainFreelancer!)}). Đổi sang đúng ví đã được gán khi client nạp escrow.
        </p>
      )}

      {onchainStatus === ONCHAIN_JOB_STATUS.ASSIGNED && !walletMismatch && (
        <p className="muted">
          Job đang ASSIGNED — lần nộp đầu sẽ gửi 2 giao dịch: <code>startWork</code> rồi{' '}
          <code>submitWork</code>.
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
        disabled={loading || txStatus === 'pending' || !isAuthenticated || Boolean(walletMismatch)}
      >
        {loading || txStatus === 'pending' ? 'Đang nộp…' : 'Upload & nộp on-chain'}
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
