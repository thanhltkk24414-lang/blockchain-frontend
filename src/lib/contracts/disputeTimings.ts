/** On-chain dispute phase labels — Sepolia demo uses short windows from DisputeTimings.demo.sol */
export const DISPUTE_PHASES_DEMO = {
  evidenceInitialEndMin: 15,
  evidenceRebuttalEndMin: 30,
  commitStartMin: 30,
  commitEndMin: 45,
  revealStartMin: 45,
  revealEndMin: 60,
  appealWindowHours: 2,
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
