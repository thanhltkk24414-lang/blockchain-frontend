import type { Job } from '@/lib/api';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';
import { ONCHAIN_JOB_STATUS } from '@/lib/utils/onchainJob';

interface DisputeStatusPanelProps {
  job: Job;
}

export function DisputeStatusPanel({ job }: DisputeStatusPanelProps) {
  const { onchainStatus, onchainStatusLabel, loading } = useOnChainJob(job.onchainJobId, job.status);

  const isDisputed =
    onchainStatus === ONCHAIN_JOB_STATUS.DISPUTED || job.status?.toUpperCase() === 'DISPUTED';

  if (!isDisputed || !isValidOnchainJobId(job.onchainJobId)) return null;

  return (
    <section className="panel dispute-status-panel">
      <h3>Trạng thái tranh chấp</h3>
      <p className="badge warning">
        Job #{job.onchainJobId} — {loading ? '…' : onchainStatusLabel ?? 'DISPUTED'}
      </p>
      <ul className="muted phase-note">
        <li>
          <strong>0–{DISPUTE_PHASES.evidenceRebuttalEndMin} phút:</strong> Nộp bằng chứng (
          <code>submitEvidence</code>)
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
          Arbitrator reveal vote
        </li>
        <li>
          <strong>Sau {DISPUTE_PHASES.revealEndMin} phút:</strong>{' '}
          <code>finalizeDisputeVoting</code> → <code>executeArbitrationResult</code>
        </li>
      </ul>
      <p className="muted">
        Hội đồng 5 arbitrator được chọn ngẫu nhiên từ pool. Cần ≥3 vote hợp lệ (quorum).
      </p>
    </section>
  );
}
