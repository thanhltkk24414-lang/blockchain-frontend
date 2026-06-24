const USDC_DECIMALS = 6n;
const SCALE = 10n ** USDC_DECIMALS;

/** Convert whole USDC units (API / UI) to on-chain smallest units (6 decimals). */
export function toUsdcUnits(amount: number): bigint {
  return BigInt(Math.round(amount)) * SCALE;
}

/** Platform fee is 3% of contract value (matches on-chain escrow). */
export function computeTotalDeposit(contractValue: number): number {
  const fee = Math.floor((contractValue * 3) / 100);
  return contractValue + fee;
}
