import { useCallback, useEffect, useState } from 'react';
import type { Job } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import {
  isAssignedArbitrator,
  readChosenArbitrators,
  readOnchainDispute,
  useDisputeActions,
  VOTE_CHOICES,
} from '@/hooks/useDisputeActions';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { ONCHAIN_JOB_STATUS } from '@/lib/utils/onchainJob';
import { formatCountdown, getDisputePhaseInfo } from '@/lib/utils/disputePhase';

const SALT_STORAGE_PREFIX = 'fapex-arb-salt-';

interface ArbitratorDisputePanelProps {
  job: Job;
  onActionComplete?: () => void;
}

export function ArbitratorDisputePanel({ job, onActionComplete }: ArbitratorDisputePanelProps) {
  const { address, isAuthenticated } = useAuth();
  const { onchainStatus } = useOnChainJob(job.onchainJobId, job.status);
  const {
    commitVote,
    revealVote,
    finalizeDisputeVoting,
    executeArbitrationResult,
    txStatus,
    txHash,
    txLabel,
    txError,
    resetTx,
  } = useDisputeActions();

  const [chosenArbs, setChosenArbs] = useState<string[]>([]);
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [createdAtSec, setCreatedAtSec] = useState(0);
  const [resultAtSec, setResultAtSec] = useState(0);
  const [isResolved, setIsResolved] = useState(false);
  const [commitCount, setCommitCount] = useState(0);
  const [revealCount, setRevealCount] = useState(0);
  const [countdown, setCountdown] = useState('');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [currentPhase, setCurrentPhase] = useState<string>('evidence');
  const [voteChoice, setVoteChoice] = useState(String(VOTE_CHOICES.FREELANCER_WIN));
  const [voteSalt, setVoteSalt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isDisputed =
    onchainStatus === ONCHAIN_JOB_STATUS.DISPUTED || job.status?.toUpperCase() === 'DISPUTED';

  const isAssigned = isAssignedArbitrator(chosenArbs, address);
  const saltStorageKey =
    job.onchainJobId != null ? `${SALT_STORAGE_PREFIX}${job.onchainJobId}` : null;

  const loadDisputeData = useCallback(async () => {
    if (!isValidOnchainJobId(job.onchainJobId)) return;
    setDisputeLoading(true);
    try {
      const [arbs, dispute] = await Promise.all([
        readChosenArbitrators(job.onchainJobId!),
        readOnchainDispute(BigInt(job.onchainJobId!)),
      ]);
      setChosenArbs(arbs);
      setCreatedAtSec(Number(dispute.createdAt));
      setResultAtSec(Number(dispute.resultAt));
      setIsResolved(dispute.isResolved);
      setCommitCount(dispute.commitCount);
      setRevealCount(dispute.revealCount);
    } catch {
      setChosenArbs([]);
    } finally {
      setDisputeLoading(false);
    }
  }, [job.onchainJobId]);

  useEffect(() => {
    if (!isDisputed) return;
    void loadDisputeData();
  }, [isDisputed, loadDisputeData]);

  useEffect(() => {
    if (!saltStorageKey) return;
    const stored = localStorage.getItem(saltStorageKey);
    if (stored) setVoteSalt(stored);
    else setVoteSalt(`salt-job-${job.onchainJobId}-${Date.now()}`);
  }, [saltStorageKey, job.onchainJobId]);

  useEffect(() => {
    if (!createdAtSec) return;

    const tick = () => {
      const info = getDisputePhaseInfo(createdAtSec, resultAtSec, isResolved);
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
  }, [createdAtSec, resultAtSec, isResolved]);

  if (!isDisputed || !isValidOnchainJobId(job.onchainJobId)) return null;

  async function runAction(action: 'commit' | 'reveal' | 'finalize' | 'execute') {
    if (!job.onchainJobId) return;
    setFormError(null);
    setActionLoading(true);
    try {
      const choice = Number(voteChoice);
      if (action === 'commit') {
        if (!voteSalt.trim()) throw new Error('Nhập salt — giữ bí mật đến giai đoạn reveal.');
        await commitVote(job.onchainJobId, choice, voteSalt.trim());
        if (saltStorageKey) localStorage.setItem(saltStorageKey, voteSalt.trim());
      } else if (action === 'reveal') {
        if (!voteSalt.trim()) throw new Error('Salt không khớp — dùng đúng salt lúc commit.');
        await revealVote(job.onchainJobId, choice, voteSalt.trim());
      } else if (action === 'finalize') {
        await finalizeDisputeVoting(job.onchainJobId);
      } else {
        await executeArbitrationResult(job.onchainJobId);
      }
      await loadDisputeData();
      onActionComplete?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Giao dịch thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  const canCommit = currentPhase === 'commit' && isAssigned;
  const canReveal = currentPhase === 'reveal' && isAssigned;
  const canFinalize = currentPhase === 'finalize' && !isResolved && resultAtSec === 0;
  const canExecute = currentPhase === 'execute' && !isResolved && resultAtSec > 0;

  return (
    <section className="panel dispute-arbitrator-panel">
      <h3>Tranh chấp — hội đồng arbitrator</h3>

      {disputeLoading && <p className="muted">Đang đọc dữ liệu on-chain…</p>}

      <div className="dispute-phase-banner">
        <span className="badge warning">Giai đoạn: {phaseLabel}</span>
        {countdown !== '—' && countdown !== '00:00' && (
          <span className="badge countdown">Còn lại: {countdown}</span>
        )}
      </div>

      <ul className="muted phase-note">
        <li>
          <strong>0–{DISPUTE_PHASES.evidenceRebuttalEndMin} phút:</strong> Nộp bằng chứng
        </li>
        <li>
          <strong>
            {DISPUTE_PHASES.commitStartMin}–{DISPUTE_PHASES.commitEndMin} phút:
          </strong>{' '}
          Commit vote
        </li>
        <li>
          <strong>
            {DISPUTE_PHASES.revealStartMin}–{DISPUTE_PHASES.revealEndMin} phút:
          </strong>{' '}
          Reveal vote
        </li>
        <li>
          <strong>Sau {DISPUTE_PHASES.revealEndMin} phút:</strong> Finalize → kháng cáo{' '}
          {DISPUTE_PHASES.appealWindowHours}h → Execute
        </li>
      </ul>

      <p className="muted phase-note">
        Hội đồng: {chosenArbs.length}/5 arbitrator · Commit {commitCount} · Reveal {revealCount}{' '}
        (cần ≥3 vote hợp lệ)
      </p>

      {address && isAssigned && (
        <p className="badge success">Bạn được chọn làm arbitrator cho job #{job.onchainJobId}</p>
      )}

      {address && !isAssigned && chosenArbs.length > 0 && (
        <p className="muted">
          Đang dùng ví <code>{address.slice(0, 6)}…{address.slice(-4)}</code> — không nằm hội
          đồng job này. Chuyển sang một trong các ví arbitrator:{' '}
          {chosenArbs.map((a) => (
            <code key={a} style={{ marginRight: '0.5rem' }}>
              {a.slice(0, 6)}…{a.slice(-4)}
            </code>
          ))}{' '}
          (import từ <code>deployments/sepolia-arbitrators.json</code>).
        </p>
      )}

      {isAssigned && !isResolved && (
        <div className="arbitrator-vote-form">
          <h4>Biểu quyết (commit-reveal)</h4>
          <p className="muted phase-note">
            Hash = keccak256(choice, salt). Giữ salt an toàn — cần lại khi reveal.
          </p>

          <label className="field">
            Lựa chọn
            <select
              className="input full"
              value={voteChoice}
              onChange={(e) => setVoteChoice(e.target.value)}
              disabled={!canCommit && !canReveal}
            >
              <option value={VOTE_CHOICES.FREELANCER_WIN}>Freelancer thắng</option>
              <option value={VOTE_CHOICES.CLIENT_WIN}>Client thắng</option>
              <option value={VOTE_CHOICES.SPLIT}>Chia 50/50</option>
            </select>
          </label>

          <label className="field">
            Salt (bí mật)
            <input
              className="input full mono"
              value={voteSalt}
              onChange={(e) => setVoteSalt(e.target.value)}
              disabled={!canCommit && !canReveal}
              placeholder="demo-salt-1"
            />
          </label>

          {canReveal && voteSalt && (
            <p className="muted phase-note">
              Nhắc salt: <code className="mono">{voteSalt}</code>
            </p>
          )}

          <div className="form-actions">
            <button
              className="btn primary"
              type="button"
              disabled={!canCommit || actionLoading || txStatus === 'pending' || !isAuthenticated}
              onClick={() => runAction('commit')}
            >
              Commit vote
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={!canReveal || actionLoading || txStatus === 'pending' || !isAuthenticated}
              onClick={() => runAction('reveal')}
            >
              Reveal vote
            </button>
          </div>
        </div>
      )}

      {!isResolved && (
        <div className="form-actions dispute-admin-actions">
          <button
            className="btn ghost"
            type="button"
            disabled={!canFinalize || actionLoading || txStatus === 'pending' || !isAuthenticated}
            onClick={() => runAction('finalize')}
            title="Bất kỳ ai cũng gọi được sau khi hết giai đoạn reveal"
          >
            Finalize voting
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={!canExecute || actionLoading || txStatus === 'pending' || !isAuthenticated}
            onClick={() => runAction('execute')}
            title={`Sau ${DISPUTE_PHASES.appealWindowHours}h kháng cáo kể từ finalize`}
          >
            Thực thi kết quả
          </button>
        </div>
      )}

      {isResolved && <p className="badge success">Tranh chấp đã giải quyết on-chain.</p>}

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
