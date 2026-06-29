import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Job } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import {
  readAppealFiled,
  readArbitratorPoolSize,
  readChosenArbitrators,
  readDisputeRound,
  readOnchainDispute,
  readPendingResult,
  appealPoolShortfall,
  useDisputeActions,
} from '@/hooks/useDisputeActions';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { formatAppealWindow } from '@/lib/contracts/disputeTimings';
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
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const [round1PanelSize, setRound1PanelSize] = useState(0);

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
      const [dispute, result, disputeRound, appealed, chosen, pool] = await Promise.all([
        readOnchainDispute(jobId),
        readPendingResult(jobId),
        readDisputeRound(jobId),
        readAppealFiled(jobId),
        readChosenArbitrators(job.onchainJobId!),
        readArbitratorPoolSize(),
      ]);
      setCreatedAtSec(Number(dispute.createdAt));
      setResultAtSec(Number(dispute.resultAt));
      setIsVotingDone(dispute.isResolved);
      setPendingResult(result > 0 ? result : dispute.pendingResult);
      setRound(disputeRound);
      setAppealFiled(appealed);
      setRound1PanelSize(chosen.length);
      setPoolSize(pool);
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
      const info = getDisputePhaseInfo(createdAtSec, resultAtSec, isVotingDone);
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
  }, [createdAtSec, resultAtSec, isVotingDone]);

  if (!isDisputed || !isValidOnchainJobId(job.onchainJobId)) return null;

  const showResult = isVotingDone && pendingResult > 0;
  const appealPoolBlocked =
    poolSize != null && round === 1 && appealPoolShortfall(poolSize, round1PanelSize) != null;

  const canAppeal =
    isParty &&
    isVotingDone &&
    round === 1 &&
    !appealFiled &&
    currentPhase === 'appeal' &&
    pendingResult > 0 &&
    !appealPoolBlocked;

  async function handleAppeal() {
    if (!job.onchainJobId) return;
    setFormError(null);
    setActionLoading(true);
    try {
      await fileAppeal(job.onchainJobId);
      await loadResult();
      onActionComplete?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Appeal failed');
    } finally {
      setActionLoading(false);
    }
  }

  if (!showResult && !isVotingDone && currentPhase !== 'appeal' && currentPhase !== 'execute') {
    return null;
  }

  return (
    <section className="panel dispute-result-panel">
      <h3>Dispute — arbitration result</h3>

      {loading && <p className="muted">Reading on-chain result…</p>}

      {!isVotingDone && currentPhase === 'finalize' && (
        <p className="muted phase-note">
          Voting phase has ended — waiting for someone to call <strong>Finalize voting</strong> to
          publish the result (requires ≥3 valid vote reveals).
        </p>
      )}

      {showResult && (
        <div className="dispute-result-banner">
          <p className="badge success">
            Round {round} result: <strong>{formatDisputeChoice(pendingResult)}</strong>
          </p>
          {resultAtSec > 0 && (
            <p className="muted phase-note">
              Finalized at {new Date(resultAtSec * 1000).toLocaleString('en-US')}
            </p>
          )}
        </div>
      )}

      {isVotingDone && round === 1 && !appealFiled && (
        <div className="dispute-appeal-window">
          <p className="muted">
            Phase: <strong>{phaseLabel}</strong>
            {currentPhase === 'appeal' && countdown !== '—' && (
              <>
                {' '}
                · Remaining: <strong>{countdown}</strong>
              </>
            )}
          </p>
          <p className="muted phase-note">
            After round 1 is finalized, client or freelancer can pay an appeal fee (~1.3× the
            dispute fee) via <strong>fileAppeal</strong> within{' '}
            <strong>{formatAppealWindow()}</strong>. On-chain this calls{' '}
            <code>EscrowVault.fileAppeal</code> → <code>ArbitratorPanel.startAppealRound</code>:
            a <strong>new panel of 5 arbitrators</strong> is chosen and commit–reveal voting runs
            again (round 2 is final — no third round). The arbitrator pool must have at least{' '}
            <strong>10 members</strong> (5 for round 1 + 5 new for appeal). If no appeal is filed, anyone can{' '}
            <strong>Execute result</strong> to settle escrow.
          </p>
        </div>
      )}

      {appealFiled && (
        <p className="badge warning">
          Appeal filed — round 2 is active. A new arbitrator panel will commit/reveal; round 2
          result is final.
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
            File appeal (fileAppeal)
          </button>
        </div>
      )}

      {isParty &&
        isVotingDone &&
        round === 1 &&
        !appealFiled &&
        currentPhase === 'appeal' &&
        pendingResult > 0 &&
        appealPoolBlocked && (
          <p className="error phase-note">
            Appeal blocked: round 2 needs 5 new arbitrators but only{' '}
            {Math.max(0, poolSize! - round1PanelSize)} remain outside the round 1 panel (pool size{' '}
            {poolSize}). An admin must seed more arbitrators (target pool ≥ 10) in the{' '}
            <Link to="/admin">Admin dashboard</Link> → Arbitrator pool.
          </p>
        )}

      {currentPhase === 'execute' && isVotingDone && !appealFiled && (
        <p className="muted phase-note">
          Appeal window closed — anyone can call <strong>Execute result</strong> in the
          arbitrator panel.
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
