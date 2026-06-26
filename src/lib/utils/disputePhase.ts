import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';

export type DisputePhase =
  | 'evidence'
  | 'commit'
  | 'reveal'
  | 'finalize'
  | 'appeal'
  | 'execute'
  | 'resolved';

export type DisputePhaseInfo = {
  phase: DisputePhase;
  label: string;
  /** Seconds until this phase ends; 0 if past or resolved */
  secondsRemaining: number;
  /** Unix seconds when current phase ends */
  phaseEndSec: number;
};

const PHASE_LABELS: Record<DisputePhase, string> = {
  evidence: 'Nộp bằng chứng',
  commit: 'Commit vote (arbitrator)',
  reveal: 'Reveal vote (arbitrator)',
  finalize: 'Finalize voting',
  appeal: 'Chờ hết thời gian kháng cáo',
  execute: 'Thực thi kết quả',
  resolved: 'Đã giải quyết',
};

function minToSec(min: number): number {
  return min * 60;
}

function hoursToSec(h: number): number {
  return h * 3600;
}

export function getDisputePhaseInfo(
  createdAtSec: number,
  resultAtSec: number,
  isResolved: boolean,
  nowSec = Math.floor(Date.now() / 1000),
): DisputePhaseInfo {
  if (isResolved) {
    return {
      phase: 'resolved',
      label: PHASE_LABELS.resolved,
      secondsRemaining: 0,
      phaseEndSec: nowSec,
    };
  }

  const evidenceEnd = createdAtSec + minToSec(DISPUTE_PHASES.evidenceRebuttalEndMin);
  const commitEnd = createdAtSec + minToSec(DISPUTE_PHASES.commitEndMin);
  const revealEnd = createdAtSec + minToSec(DISPUTE_PHASES.revealEndMin);
  const appealEnd =
    resultAtSec > 0
      ? resultAtSec + hoursToSec(DISPUTE_PHASES.appealWindowHours)
      : 0;

  let phase: DisputePhase;
  let phaseEndSec: number;

  if (nowSec < evidenceEnd) {
    phase = 'evidence';
    phaseEndSec = evidenceEnd;
  } else if (nowSec < commitEnd) {
    phase = 'commit';
    phaseEndSec = commitEnd;
  } else if (nowSec < revealEnd) {
    phase = 'reveal';
    phaseEndSec = revealEnd;
  } else if (resultAtSec === 0) {
    phase = 'finalize';
    phaseEndSec = revealEnd;
  } else if (appealEnd > 0 && nowSec < appealEnd) {
    phase = 'appeal';
    phaseEndSec = appealEnd;
  } else {
    phase = 'execute';
    phaseEndSec = nowSec;
  }

  const secondsRemaining =
    phase === 'finalize' || phase === 'execute'
      ? 0
      : Math.max(0, phaseEndSec - nowSec);

  return {
    phase,
    label: PHASE_LABELS[phase],
    secondsRemaining,
    phaseEndSec,
  };
}

export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
