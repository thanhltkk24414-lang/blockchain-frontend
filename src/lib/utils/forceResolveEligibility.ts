import { ONCHAIN_JOB_STATUS } from '@/lib/utils/onchainJob';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';
import { getDisputePhaseInfo } from '@/lib/utils/disputePhase';
import type { OnChainDispute } from '@/hooks/useDisputeActions';

export const DISPUTE_QUORUM = 3;

export type ForceResolveEligibility = {
  eligible: boolean;
  reason: string;
  phaseLabel: string;
  phase: string;
  revealEnded: boolean;
};

export function assessForceResolveEligibility(
  onchainStatus: number,
  dispute: OnChainDispute | null,
  nowSec = Math.floor(Date.now() / 1000),
): ForceResolveEligibility {
  if (onchainStatus !== ONCHAIN_JOB_STATUS.DISPUTED) {
    return {
      eligible: false,
      reason: `Job is not DISPUTED on-chain (${onchainStatus}) — force resolve applies only to active disputes.`,
      phaseLabel: '—',
      phase: 'none',
      revealEnded: false,
    };
  }

  if (!dispute || dispute.createdAt === 0n) {
    return {
      eligible: false,
      reason: 'No on-chain dispute record for this job ID.',
      phaseLabel: '—',
      phase: 'none',
      revealEnded: false,
    };
  }

  const createdAtSec = Number(dispute.createdAt);
  const resultAtSec = Number(dispute.resultAt);
  const phaseInfo = getDisputePhaseInfo(createdAtSec, resultAtSec, dispute.isResolved, nowSec);
  const revealEndSec = createdAtSec + DISPUTE_PHASES.revealEndMin * 60;
  const revealEnded = nowSec > revealEndSec;

  if (dispute.isResolved && dispute.pendingResult > 0) {
    return {
      eligible: false,
      reason: 'Dispute already finalized by arbitrators — use executeArbitrationResult, not force resolve.',
      phaseLabel: phaseInfo.label,
      phase: phaseInfo.phase,
      revealEnded,
    };
  }

  if (!revealEnded) {
    return {
      eligible: false,
      reason: `Reveal phase still active — wait until after minute ${DISPUTE_PHASES.revealEndMin} from dispute start.`,
      phaseLabel: phaseInfo.label,
      phase: phaseInfo.phase,
      revealEnded,
    };
  }

  if (dispute.revealCount >= DISPUTE_QUORUM) {
    return {
      eligible: false,
      reason: `Quorum reached (${dispute.revealCount}/${DISPUTE_QUORUM} reveals) — use finalizeDisputeVoting on the job dispute panel.`,
      phaseLabel: phaseInfo.label,
      phase: phaseInfo.phase,
      revealEnded,
    };
  }

  return {
    eligible: true,
    reason: `Quorum failed: ${dispute.revealCount}/${DISPUTE_QUORUM} valid reveals after reveal window. Emergency force resolve is allowed.`,
    phaseLabel: phaseInfo.label,
    phase: phaseInfo.phase,
    revealEnded,
  };
}
