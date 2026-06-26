import { useCallback, useEffect, useState } from 'react';
import type { Job } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import {
  readAppealFiled,
  readDisputeRound,
  readOnchainDispute,
  readPendingResult,
  useDisputeActions,
} from '@/hooks/useDisputeActions';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';
import { formatDisputeChoice } from '@/lib/utils/disputeChoice';
import { formatCountdown, getDisputePhaseInfo } from '@/lib/utils/disputePhase';
import { addressesEqual } from '@/lib/utils/address';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { ONCHAIN_JOB_STATUS } from '@/lib/utils/onchainJob';

interface DisputeResultPanelProps {
  job: Job;
  onActionComplete?: () => void;
}

export function DisputeResultPanel({ job, onActionComplete }: DisputeResultPanelProps) {
  const { address, isAuthenticated } = useAuth();
  const { onchainStatus } = useOnChainJob(job.onchainJobId, job.status);
  const { fileAppeal, txStatus, txHash, txLabel, txError, resetTx } = useDisputeActions();

  const [loading, setLoading] = useState(false);
  const [createdAtSec, setCreatedAtSec] = useState(0);
  const [resultAtSec, setResultAtSec] = useState(0);
  const [isVotingDone, setIsVotingDone] = useState(false);
  const [pendingResult, setPendingResult] = useState(0);
  const [round, setRound] = useState(1);
  const [appealFiled, setAppealFiled] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState('');
  const [currentPhase, setCurrentPhase] = useState<string>('evidence');
  const [countdown, setCountdown] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isDisputed =
    onchainStatus === ONCHAIN_JOB_STATUS.DISPUTED || job.status?.toUpperCase() === 'DISPUTED';

  const isParty = Boolean(
    address &&
      (addressesEqual(address, job.clientAddress) ||
        addressesEqual(address, job.freelancerAddress)),
  );

  const loadResult = useCallback(async () => {
    if (!isValidOnchainJobId(job.onchainJobId)) return;
    setLoading(true);
    try {
      const jobId = BigInt(job.onchainJobId!);
      const [dispute, result, disputeRound, appealed] = await Promise.all([
        readOnchainDispute(jobId),
        readPendingResult(jobId),
        readDisputeRound(jobId),
        readAppealFiled(jobId),
      ]);
      setCreatedAtSec(Number(dispute.createdAt));
      setResultAtSec(Number(dispute.resultAt));
      setIsVotingDone(dispute.isResolved);
      setPendingResult(result > 0 ? result : dispute.pendingResult);
      setRound(disputeRound);
      setAppealFiled(appealed);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [job.onchainJobId]);

  useEffect(() => {
    if (!isDisputed) return;
    void loadResult();
  }, [isDisputed, loadResult]);

  useEffect(() => {
    if (!createdAtSec) return;

    const tick = () => {
      const info = getDisputePhaseInfo(createdAtSec, resultAtSec, false);
      setCurrentPhase(info.phase);
      setPhaseLabel(info.label);
      setCountdown(
        info.secondsRemaining > 0
          ? formatCountdown(info.secondsRemaining)
          : info.phase === 'finalize' || info.phase === 'execute'
            ? '—'
            : '00:00',
      );
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [createdAtSec, resultAtSec]);

  if (!isDisputed || !isValidOnchainJobId(job.onchainJobId)) return null;

  const showResult = isVotingDone && pendingResult > 0;
  const canAppeal =
    isParty &&
    isVotingDone &&
    round === 1 &&
    !appealFiled &&
    currentPhase === 'appeal' &&
    pendingResult > 0;

  async function handleAppeal() {
    if (!job.onchainJobId) return;
    setFormError(null);
    setActionLoading(true);
    try {
      await fileAppeal(job.onchainJobId);
      await loadResult();
      onActionComplete?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kháng cáo thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  if (!showResult && !isVotingDone && currentPhase !== 'appeal' && currentPhase !== 'execute') {
    return null;
  }

  return (
    <section className="panel dispute-result-panel">
      <h3>Tranh chấp — kết quả phân xử</h3>

      {loading && <p className="muted">Đang đọc kết quả on-chain…</p>}

      {!isVotingDone && currentPhase === 'finalize' && (
        <p className="muted phase-note">
          Giai đoạn voting đã kết thúc — chờ ai đó gọi <strong>Finalize voting</strong> để công bố
          kết quả (cần ≥3 vote reveal hợp lệ).
        </p>
      )}

      {showResult && (
        <div className="dispute-result-banner">
          <p className="badge success">
            Kết quả vòng {round}: <strong>{formatDisputeChoice(pendingResult)}</strong>
          </p>
          {resultAtSec > 0 && (
            <p className="muted phase-note">
              Finalize lúc {new Date(resultAtSec * 1000).toLocaleString('vi-VN')}
            </p>
          )}
        </div>
      )}

      {isVotingDone && round === 1 && !appealFiled && (
        <div className="dispute-appeal-window">
          <p className="muted">
            Giai đoạn: <strong>{phaseLabel}</strong>
            {currentPhase === 'appeal' && countdown !== '—' && (
              <>
                {' '}
                · Còn lại: <strong>{countdown}</strong>
              </>
            )}
          </p>
          <p className="muted phase-note">
            Client hoặc freelancer có thể kháng cáo trong{' '}
            <strong>{DISPUTE_PHASES.appealWindowHours} giờ</strong> sau finalize (phí ≈ 1.3× dispute
            fee). Sau đó gọi <strong>Thực thi kết quả</strong> để giải ngân escrow.
          </p>
        </div>
      )}

      {appealFiled && (
        <p className="badge warning">
          Đã kháng cáo — vòng 2 đang mở, hội đồng arbitrator mới sẽ vote lại.
        </p>
      )}

      {canAppeal && (
        <div className="form-actions">
          <button
            className="btn primary"
            type="button"
            disabled={actionLoading || txStatus === 'pending' || !isAuthenticated}
            onClick={handleAppeal}
          >
            Kháng cáo (fileAppeal)
          </button>
        </div>
      )}

      {currentPhase === 'execute' && isVotingDone && !appealFiled && (
        <p className="muted phase-note">
          Cửa sổ kháng cáo đã đóng — bất kỳ ai cũng có thể gọi <strong>Thực thi kết quả</strong>{' '}
          trong panel arbitrator.
        </p>
      )}

      {formError && <p className="error">{formError}</p>}

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
