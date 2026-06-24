import { zeroAddress, type Address } from 'viem';

/** Matches JobRegistry.JobStatus enum in deployed contracts. */
export const ONCHAIN_JOB_STATUS = {
  OPEN: 0,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  SUBMITTED: 3,
  COMPLETED: 5,
  REFUNDED: 6,
  CANCELLED: 7,
} as const;

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
    [ONCHAIN_JOB_STATUS.COMPLETED]: 'COMPLETED',
    [ONCHAIN_JOB_STATUS.REFUNDED]: 'REFUNDED',
    [ONCHAIN_JOB_STATUS.CANCELLED]: 'CANCELLED',
  };
  return labels[status] ?? `UNKNOWN(${status})`;
}

export function isNonZeroAddress(addr?: string | null): addr is Address {
  return Boolean(addr && addr.toLowerCase() !== zeroAddress.toLowerCase());
}

export function explainDepositBlocker(job: OnChainJob): string | null {
  if (job.status === ONCHAIN_JOB_STATUS.OPEN) {
    return null;
  }
  if (job.status === ONCHAIN_JOB_STATUS.ASSIGNED) {
    return (
      'Job đã ASSIGNED on-chain (thường do luồng cũ gọi assignFreelancer trước khi nạp escrow). ' +
      'depositEscrow chỉ chạy khi job còn OPEN. Job này không thể nạp escrow — hãy tạo job mới để demo.'
    );
  }
  return `Trạng thái on-chain là ${onchainStatusLabel(job.status)} — không thể nạp escrow.`;
}
