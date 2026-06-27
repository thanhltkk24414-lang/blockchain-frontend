/** On-chain dispute phase labels — Sepolia demo uses short windows from DisputeTimings.demo.sol */
export const DISPUTE_PHASES_DEMO = {
  evidenceInitialEndMin: 5,
  evidenceRebuttalEndMin: 10,
  commitStartMin: 10,
  commitEndMin: 13,
  revealStartMin: 13,
  revealEndMin: 16,
  appealWindowMin: 30,
} as const;

export const DISPUTE_PHASES_PROD = {
  evidenceInitialEndHours: 72,
  evidenceRebuttalEndHours: 120,
  commitStartHours: 120,
  commitEndHours: 144,
  revealStartHours: 144,
  revealEndHours: 168,
  appealWindowHours: 72,
} as const;

/** Active UI copy for Sepolia demo deployment */
export const DISPUTE_PHASES = DISPUTE_PHASES_DEMO;

/** Human-readable appeal window for UI copy */
export function formatAppealWindow(): string {
  if ('appealWindowMin' in DISPUTE_PHASES) {
    return `${DISPUTE_PHASES.appealWindowMin} min`;
  }
  return `${DISPUTE_PHASES_PROD.appealWindowHours} h`;
}
