import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { readContract, simulateContract } from 'wagmi/actions';
import type { Abi, Address } from 'viem';
import { getAddress, keccak256, encodePacked, toBytes } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';
import { sendSubmitEvidenceTx } from '@/lib/utils/sendSubmitEvidenceTx';
import { sendCommitVoteTx } from '@/lib/utils/sendCommitVoteTx';
import { sendRevealVoteTx } from '@/lib/utils/sendRevealVoteTx';
import { sendFinalizeDisputeTx } from '@/lib/utils/sendFinalizeDisputeTx';
import { sendExecuteArbitrationResultTx } from '@/lib/utils/sendExecuteArbitrationResultTx';
import { sendFileAppealTx } from '@/lib/utils/sendFileAppealTx';
import {
  addVoteToTally,
  emptyVoteTally,
  VOTE_CHOICES,
  type VoteTally,
} from '@/lib/utils/disputeChoice';
import { addressesEqual } from '@/lib/utils/address';
import {
  normalizeOnchainStatus,
  ONCHAIN_JOB_STATUS,
  onchainStatusLabel,
  type OnChainJob,
} from '@/lib/utils/onchainJob';
import { decodeContractError } from '@/lib/utils/contractWrite';
import { useContractTx } from './useContractTx';

export { VOTE_CHOICES };

export function computeVoteHash(choice: number, salt: string): `0x${string}` {
  return keccak256(encodePacked(['uint256', 'string'], [BigInt(choice), salt]));
}

export function cidToEvidenceHash(cid: string): `0x${string}` {
  const trimmed = cid.trim();
  if (!trimmed) {
    throw new Error('IPFS CID trống — upload phải hoàn tất trước submitEvidence.');
  }
  return keccak256(toBytes(trimmed));
}

export type OnChainDispute = {
  initiator: Address;
  createdAt: bigint;
  resultAt: bigint;
  isResolved: boolean;
  round: number;
  commitCount: number;
  revealCount: number;
  pendingResult: number;
};

/** ArbitratorPanel.disputes returns uint40 timestamps — viem may decode as number, bigint, or tuple. */
type OnChainDisputeRaw = Omit<OnChainDispute, 'createdAt' | 'resultAt'> & {
  createdAt?: number | bigint | null;
  resultAt?: number | bigint | null;
};

type OnChainDisputeTuple = readonly [
  Address,
  number | bigint | null | undefined,
  number | bigint | null | undefined,
  boolean,
  number,
  number,
  number,
  number,
];

function toBigIntField(value: unknown, fallback = 0n): bigint {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value.trim() !== '') return BigInt(value);
  return fallback;
}

function normalizeOnchainDispute(raw: unknown): OnChainDispute {
  if (Array.isArray(raw)) {
    const [
      initiator,
      createdAt,
      resultAt,
      isResolved,
      round,
      commitCount,
      revealCount,
      pendingResult,
    ] = raw as unknown as OnChainDisputeTuple;
    return {
      initiator: getAddress(initiator),
      createdAt: toBigIntField(createdAt),
      resultAt: toBigIntField(resultAt),
      isResolved: Boolean(isResolved),
      round: Number(round ?? 0),
      commitCount: Number(commitCount ?? 0),
      revealCount: Number(revealCount ?? 0),
      pendingResult: Number(pendingResult ?? 0),
    };
  }

  const obj = raw as OnChainDisputeRaw;
  return {
    initiator: getAddress(obj.initiator),
    createdAt: toBigIntField(obj.createdAt),
    resultAt: toBigIntField(obj.resultAt),
    isResolved: Boolean(obj.isResolved),
    round: Number(obj.round ?? 0),
    commitCount: Number(obj.commitCount ?? 0),
    revealCount: Number(obj.revealCount ?? 0),
    pendingResult: Number(obj.pendingResult ?? 0),
  };
}

export async function readOnchainJob(jobId: bigint | number): Promise<OnChainJob> {
  const id = typeof jobId === 'bigint' ? jobId : BigInt(jobId);
  const raw = (await readContract(wagmiConfig, {
    ...contracts.jobRegistry,
    functionName: 'getJob',
    args: [id],
  })) as OnChainJob;
  return { ...raw, status: normalizeOnchainStatus(raw.status) };
}

export async function readOnchainDispute(jobId: bigint): Promise<OnChainDispute> {
  const raw = (await readContract(wagmiConfig, {
    ...contracts.arbitratorPanel,
    functionName: 'disputes',
    args: [jobId],
  })) as unknown;
  return normalizeOnchainDispute(raw);
}

export type OnChainEvidence = {
  submitter: Address;
  submittedAt: number;
  ipfsHash: `0x${string}`;
};

export async function readOnChainEvidences(jobId: bigint): Promise<OnChainEvidence[]> {
  const raw = (await readContract(wagmiConfig, {
    ...contracts.arbitratorPanel,
    functionName: 'getEvidences',
    args: [jobId],
  })) as Array<{ submitter: Address; submittedAt: number | bigint; ipfsHash: `0x${string}` }>;

  return (raw ?? []).map((ev) => ({
    submitter: getAddress(ev.submitter),
    submittedAt: Number(ev.submittedAt),
    ipfsHash: ev.ipfsHash,
  }));
}

export async function readArbitratorVote(
  jobId: bigint,
  arbitrator: Address,
): Promise<number> {
  const vote = (await readContract(wagmiConfig, {
    ...contracts.arbitratorPanel,
    functionName: 'getVote',
    args: [jobId, getAddress(arbitrator)],
  })) as number;
  return Number(vote);
}

export async function readVoteTally(
  jobId: bigint,
  arbitrators: string[],
): Promise<VoteTally> {
  let tally = emptyVoteTally();
  await Promise.all(
    arbitrators.map(async (arb) => {
      try {
        const choice = await readArbitratorVote(jobId, getAddress(arb));
        tally = addVoteToTally(tally, choice);
      } catch {
        /* skip unreadable */
      }
    }),
  );
  return tally;
}

export async function readDisputeRound(jobId: bigint): Promise<number> {
  const round = (await readContract(wagmiConfig, {
    ...contracts.arbitratorPanel,
    functionName: 'getDisputeRound',
    args: [jobId],
  })) as number;
  return Number(round);
}

export async function readPendingResult(jobId: bigint): Promise<number> {
  const result = (await readContract(wagmiConfig, {
    ...contracts.arbitratorPanel,
    functionName: 'getPendingResult',
    args: [jobId],
  })) as number;
  return Number(result);
}

export async function readIsVotingFinalized(jobId: bigint): Promise<boolean> {
  return (await readContract(wagmiConfig, {
    ...contracts.arbitratorPanel,
    functionName: 'isVotingFinalized',
    args: [jobId],
  })) as boolean;
}

export async function readAppealFiled(jobId: bigint): Promise<boolean> {
  return (await readContract(wagmiConfig, {
    ...contracts.escrowVault,
    functionName: 'appealFiled',
    args: [jobId],
  })) as boolean;
}

export async function hasArbitratorRevealed(
  jobId: bigint,
  wallet: Address,
): Promise<boolean> {
  const vote = await readArbitratorVote(jobId, wallet);
  return vote !== 0;
}

async function preflightRevealVote(
  wallet: Address,
  jobId: bigint,
  choice: number,
  salt: string,
): Promise<void> {
  await simulateContract(wagmiConfig, {
    address: contracts.arbitratorPanel.address,
    abi: contracts.arbitratorPanel.abi as Abi,
    functionName: 'revealVote',
    args: [jobId, choice, salt],
    account: wallet,
  });
}

async function preflightSubmitEvidence(
  wallet: Address,
  jobId: bigint,
  evidenceHash: `0x${string}`,
): Promise<void> {
  const onchainJob = await readOnchainJob(jobId);

  const isClient = addressesEqual(onchainJob.client, wallet);
  const isFreelancer = addressesEqual(onchainJob.freelancer, wallet);
  if (!isClient && !isFreelancer) {
    throw new Error(
      `Ví MetaMask (${wallet}) không phải client/freelancer của job on-chain. ` +
        'Chỉ một trong hai bên mới nộp được bằng chứng.',
    );
  }

  if (onchainJob.status !== ONCHAIN_JOB_STATUS.DISPUTED) {
    throw new Error(
      `Job on-chain đang ${onchainStatusLabel(onchainJob.status)} — chỉ nộp bằng chứng khi DISPUTED (sau raiseDispute).`,
    );
  }

  const dispute = await readOnchainDispute(jobId);
  if (dispute.createdAt === 0n) {
    throw new Error('Chưa có dispute on-chain cho job này — đợi indexer hoặc kiểm tra raiseDispute.');
  }

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const evidenceWindowSec = BigInt(DISPUTE_PHASES.evidenceRebuttalEndMin * 60);
  const windowEnd = dispute.createdAt + evidenceWindowSec;
  if (nowSec > windowEnd) {
    throw new Error(
      `EvidenceWindowClosed: đã quá ${DISPUTE_PHASES.evidenceRebuttalEndMin} phút kể từ khi mở tranh chấp — không nộp thêm bằng chứng được.`,
    );
  }

  await simulateContract(wagmiConfig, {
    address: contracts.arbitratorPanel.address,
    abi: contracts.arbitratorPanel.abi as Abi,
    functionName: 'submitEvidence',
    args: [jobId, evidenceHash],
    account: wallet,
  });
}

export function useDisputeActions() {
  const { address } = useAccount();
  const tx = useContractTx();

  const submitEvidence = useCallback(
    async (onchainJobId: number, cid: string) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');
      const wallet = getAddress(address);
      const jobId = BigInt(onchainJobId);
      const evidenceHash = cidToEvidenceHash(cid);

      await preflightSubmitEvidence(wallet, jobId, evidenceHash);

      await tx.runTx('Đang nộp bằng chứng on-chain…', () =>
        sendSubmitEvidenceTx({
          onchainJobId: jobId,
          evidenceHash,
          account: wallet,
        }),
      );
    },
    [address, tx],
  );

  const commitVote = useCallback(
    async (onchainJobId: number, choice: number, salt: string) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');
      const wallet = getAddress(address);
      const hash = computeVoteHash(choice, salt);

      await tx.runTx('Đang commit vote…', () =>
        sendCommitVoteTx({
          onchainJobId: BigInt(onchainJobId),
          voteHash: hash,
          account: wallet,
        }),
      );
    },
    [address, tx],
  );

  const revealVote = useCallback(
    async (onchainJobId: number, choice: number, salt: string) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');
      const wallet = getAddress(address);
      const jobId = BigInt(onchainJobId);

      if (await hasArbitratorRevealed(jobId, wallet)) {
        throw new Error('AlreadyRevealed: bạn đã reveal vote cho job này — không cần gửi lại.');
      }

      try {
        await preflightRevealVote(wallet, jobId, choice, salt);
      } catch (simErr) {
        throw new Error(
          decodeContractError(simErr, contracts.arbitratorPanel.abi as Abi, 'revealVote'),
        );
      }

      await tx.runTx('Đang reveal vote…', () =>
        sendRevealVoteTx({
          onchainJobId: jobId,
          choice,
          salt,
          account: wallet,
        }),
      );
    },
    [address, tx],
  );

  const finalizeDisputeVoting = useCallback(
    async (onchainJobId: number) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');
      const wallet = getAddress(address);

      await tx.runTx('Đang finalize dispute voting…', () =>
        sendFinalizeDisputeTx({
          onchainJobId: BigInt(onchainJobId),
          account: wallet,
        }),
      );
    },
    [address, tx],
  );

  const executeArbitrationResult = useCallback(
    async (onchainJobId: number) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');
      const wallet = getAddress(address);

      await tx.runTx('Đang thực thi kết quả phân xử…', () =>
        sendExecuteArbitrationResultTx({
          onchainJobId: BigInt(onchainJobId),
          account: wallet,
        }),
      );
    },
    [address, tx],
  );

  const fileAppeal = useCallback(
    async (onchainJobId: number) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');
      const wallet = getAddress(address);

      await tx.runTx('Đang nộp kháng cáo…', () =>
        sendFileAppealTx({
          onchainJobId: BigInt(onchainJobId),
          account: wallet,
        }),
      );
    },
    [address, tx],
  );

  return {
    submitEvidence,
    commitVote,
    revealVote,
    finalizeDisputeVoting,
    executeArbitrationResult,
    fileAppeal,
    ...tx,
  };
}

export async function readChosenArbitrators(onchainJobId: number): Promise<string[]> {
  const arbs = (await readContract(wagmiConfig, {
    address: contracts.arbitratorPanel.address,
    abi: contracts.arbitratorPanel.abi as Abi,
    functionName: 'getChosenArbitrators',
    args: [BigInt(onchainJobId)],
  })) as `0x${string}`[];
  return arbs.map((a) => a.toLowerCase());
}

export function isAssignedArbitrator(arbitrators: string[], wallet?: string | null): boolean {
  if (!wallet) return false;
  const w = wallet.toLowerCase();
  return arbitrators.some((a) => addressesEqual(a, w));
}
