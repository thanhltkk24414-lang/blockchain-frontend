const USDC_DECIMALS = 6n;
const SCALE = 10n ** USDC_DECIMALS;

/** Convert whole USDC units (API / UI) to on-chain smallest units (6 decimals). */
export function toUsdcUnits(amount: number): bigint {
  return BigInt(Math.round(amount)) * SCALE;
}

/** On-chain smallest units → whole USDC for display. */
export function fromUsdcUnits(units: bigint): number {
  return Number(units) / Number(SCALE);
}

/** Platform fee is 3% of contract value (matches EscrowVault BPS on smallest units). */
export function computeTotalDepositUnits(contractValueUsdc: number): bigint {
  const units = toUsdcUnits(contractValueUsdc);
  return units + (units * 3n) / 100n;
}

/** Whole USDC total deposit (contract + 3% fee) for UI labels. */
export function computeTotalDeposit(contractValueUsdc: number): number {
  return fromUsdcUnits(computeTotalDepositUnits(contractValueUsdc));
}

/** Total escrow pull from on-chain JobRegistry.contractValue (already in smallest units). */
export function escrowTotalFromOnChain(contractValueUnits: bigint): bigint {
  return contractValueUnits + (contractValueUnits * 3n) / 100n;
}
