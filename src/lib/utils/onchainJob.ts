import { getAddress, zeroAddress, type Address } from 'viem';
import { addressesEqual } from '@/lib/utils/address';

/** Matches JobRegistry.JobStatus enum in deployed contracts. */
export const ONCHAIN_JOB_STATUS = {
  OPEN: 0,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  SUBMITTED: 3,
  DISPUTED: 4,
  COMPLETED: 5,
  REFUNDED: 6,
  CANCELLED: 7,
} as const;

const STATUS_RANK: Record<string, number> = {
  OPEN: 0,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  SUBMITTED: 3,
  DISPUTED: 3,
  COMPLETED: 5,
  REFUNDED: 6,
  CANCELLED: 7,
};

/** Coerce viem uint8 / bigint enum to a plain number for comparisons. */
export function normalizeOnchainStatus(status: number | bigint): number {
  return typeof status === 'bigint' ? Number(status) : status;
}

export type OnChainJob = {
  client: Address;
  status: number;
  freelancer: Address;
  contractValue: bigint;
  deadline: bigint;
  submittedAt: bigint;
  assignedAt: bigint;
  jobMetadataCID: string;
  deliverableCID: string;
};

export function onchainStatusLabel(status: number): string {
  const labels: Record<number, string> = {
    [ONCHAIN_JOB_STATUS.OPEN]: 'OPEN',
    [ONCHAIN_JOB_STATUS.ASSIGNED]: 'ASSIGNED',
    [ONCHAIN_JOB_STATUS.IN_PROGRESS]: 'IN_PROGRESS',
    [ONCHAIN_JOB_STATUS.SUBMITTED]: 'SUBMITTED',
    [ONCHAIN_JOB_STATUS.DISPUTED]: 'DISPUTED',
    [ONCHAIN_JOB_STATUS.COMPLETED]: 'COMPLETED',
    [ONCHAIN_JOB_STATUS.REFUNDED]: 'REFUNDED',
    [ONCHAIN_JOB_STATUS.CANCELLED]: 'CANCELLED',
  };
  return labels[status] ?? `UNKNOWN(${status})`;
}

/** Prefer on-chain status for UI when registry has been read. */
export function effectiveJobStatus(
  dbStatus: string | undefined,
  onchainStatus: number | null | undefined,
): string {
  if (onchainStatus != null) {
    const label = onchainStatusLabel(onchainStatus);
    if (!label.startsWith('UNKNOWN')) return label;
  }
  if (dbStatus) {
    const key = dbStatus.toUpperCase();
    if (key in STATUS_RANK) return key;
  }
  return 'OPEN';
}

export function isNonZeroAddress(addr?: string | null): addr is Address {
  return Boolean(addr && addr.toLowerCase() !== zeroAddress.toLowerCase());
}

/** True when frontend JobRegistry read disagrees with API-persisted on-chain client. */
export function hasRegistryClientMismatch(
  chainClient?: string | null,
  apiClient?: string | null,
): boolean {
  if (!isNonZeroAddress(apiClient)) return false;
  return !isNonZeroAddress(chainClient) || !addressesEqual(chainClient, apiClient);
}

export function explainRegistryMismatch(
  onchainJobId: number,
  frontendRegistry: string,
  apiClient: string,
  chainClient?: string | null,
): string {
  const chainLabel = isNonZeroAddress(chainClient)
    ? shortAddress(chainClient)
    : '0x0000…0000';
  return (
    `Job #${onchainJobId} on the frontend JobRegistry (${shortAddress(frontendRegistry)}) has client ${chainLabel}, ` +
    `but the backend records client ${shortAddress(apiClient)}. ` +
    'The Railway backend and frontend point to different contract addresses — update Railway env per deployments/sepolia.json, ' +
    'then create a new job. The old job cannot receive escrow deposits.'
  );
}

export type DepositBlockerOptions = {
  /** True when EscrowVault holds at least the expected deposit for this job. */
  escrowFunded?: boolean;
};

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Throws when the connected wallet cannot submit deliverables. */
export function validateDeliverableSubmit(job: OnChainJob, wallet: Address): void {
  const walletCs = getAddress(wallet);
  const freelancerCs = getAddress(job.freelancer);

  if (!addressesEqual(freelancerCs, walletCs)) {
    throw new Error(
      `MetaMask wallet (${walletCs}) does not match on-chain freelancer (${freelancerCs}). ` +
        'Switch to the wallet assigned by the client at escrow deposit (depositEscrow). ' +
        `Correct address: ${freelancerCs}`,
    );
  }

  if (job.status === ONCHAIN_JOB_STATUS.SUBMITTED) {
    throw new Error('Deliverable already submitted on-chain (SUBMITTED). Awaiting client approval.');
  }

  if (
    job.status !== ONCHAIN_JOB_STATUS.ASSIGNED &&
    job.status !== ONCHAIN_JOB_STATUS.IN_PROGRESS
  ) {
    throw new Error(
      `On-chain job is ${onchainStatusLabel(job.status)} — deliverables can only be submitted when ASSIGNED or IN_PROGRESS.`,
    );
  }
}

export function explainDepositBlocker(
  job: OnChainJob,
  options?: DepositBlockerOptions,
): string | null {
  if (job.status === ONCHAIN_JOB_STATUS.OPEN) {
    return null;
  }
  if (job.status === ONCHAIN_JOB_STATUS.ASSIGNED) {
    if (options?.escrowFunded) {
      return null;
    }
    return (
      'Job is ASSIGNED on-chain but escrow was not funded (usually from the legacy flow calling assignFreelancer before depositEscrow). ' +
      'depositEscrow only runs while the job is OPEN. This job cannot receive escrow — create a new job to demo.'
    );
  }
  return `On-chain status is ${onchainStatusLabel(job.status)} — escrow deposit is not available.`;
}
