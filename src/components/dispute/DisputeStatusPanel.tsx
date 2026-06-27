import { useCallback, useEffect, useState } from 'react';
import type { Job } from '@/lib/api';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';
import { ONCHAIN_JOB_STATUS } from '@/lib/utils/onchainJob';
import {
  readChosenArbitrators,
  readOnchainDispute,
  readVoteTally,
} from '@/hooks/useDisputeActions';
import { getDisputePhaseInfo } from '@/lib/utils/disputePhase';
import { VoteTallyDisplay } from '@/components/dispute/VoteTallyDisplay';
import type { VoteTally } from '@/lib/utils/disputeChoice';

interface DisputeStatusPanelProps {
  job: Job;
}

export function DisputeStatusPanel({ job }: DisputeStatusPanelProps) {
  const { onchainStatus, onchainStatusLabel, loading } = useOnChainJob(job.onchainJobId, job.status);
  const [createdAtSec, setCreatedAtSec] = useState(0);
  const [resultAtSec, setResultAtSec] = useState(0);
  const [commitCount, setCommitCount] = useState(0);
  const [revealCount, setRevealCount] = useState(0);
  const [voteTally, setVoteTally] = useState<VoteTally | null>(null);
  const [currentPhase, setCurrentPhase] = useState('evidence');

  const isDisputed =
    onchainStatus === ONCHAIN_JOB_STATUS.DISPUTED || job.status?.toUpperCase() === 'DISPUTED';

  const loadPublicVotes = useCallback(async () => {
    if (!isValidOnchainJobId(job.onchainJobId)) return;
    try {
      const jobId = BigInt(job.onchainJobId!);
      const [dispute, arbs] = await Promise.all([
        readOnchainDispute(jobId),
        readChosenArbitrators(job.onchainJobId!),
      ]);
      setCreatedAtSec(Number(dispute.createdAt));
      setResultAtSec(Number(dispute.resultAt));
      setCommitCount(dispute.commitCount);
      setRevealCount(dispute.revealCount);
      const tally = await readVoteTally(jobId, arbs);
      setVoteTally(tally);
    } catch {
      setVoteTally(null);
    }
  }, [job.onchainJobId]);

  useEffect(() => {
    if (!isDisputed) return;
    void loadPublicVotes();
  }, [isDisputed, loadPublicVotes]);

  useEffect(() => {
    if (!createdAtSec) return;
    const tick = () => {
      const info = getDisputePhaseInfo(createdAtSec, resultAtSec, false);
      setCurrentPhase(info.phase);
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [createdAtSec, resultAtSec]);

  if (!isDisputed || !isValidOnchainJobId(job.onchainJobId)) return null;

  const showVoteTally =
    voteTally != null &&
    (currentPhase === 'reveal' ||
      currentPhase === 'finalize' ||
      currentPhase === 'appeal' ||
      currentPhase === 'execute') &&
    (voteTally.total > 0 || revealCount > 0);

  return (
    <section className="panel dispute-status-panel">
      <h3>Trạng thái tranh chấp</h3>
      <p className="badge warning">
        Job #{job.onchainJobId} — {loading ? '…' : onchainStatusLabel ?? 'DISPUTED'}
      </p>
      <ul className="muted phase-note">
        <li>
          <strong>0–{DISPUTE_PHASES.evidenceRebuttalEndMin} phút:</strong> Nộp bằng chứng (
          <code>submitEvidence</code>) — công khai cho mọi người xem
        </li>
        <li>
          <strong>
            {DISPUTE_PHASES.commitStartMin}–{DISPUTE_PHASES.commitEndMin} phút:
          </strong>{' '}
          Arbitrator commit vote
        </li>
        <li>
          <strong>
            {DISPUTE_PHASES.revealStartMin}–{DISPUTE_PHASES.revealEndMin} phút:
          </strong>{' '}
          Arbitrator reveal vote — tally công khai sau reveal
        </li>
        <li>
          <strong>Sau {DISPUTE_PHASES.revealEndMin} phút:</strong>{' '}
          <code>finalizeDisputeVoting</code> → <code>executeArbitrationResult</code>
        </li>
      </ul>
      <p className="muted">
        Hội đồng 5 arbitrator được chọn ngẫu nhiên từ pool. Cần ≥3 vote hợp lệ (quorum).
      </p>

      {showVoteTally && voteTally && (
        <VoteTallyDisplay tally={voteTally} commitCount={commitCount} revealCount={revealCount} />
      )}
    </section>
  );
}
