import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { readContract, simulateContract } from 'wagmi/actions';
import type { Abi, Address } from 'viem';
import { getAddress, keccak256, encodePacked, toBytes } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';
import { executeContractWrite } from '@/lib/utils/contractWrite';
import { sendSubmitEvidenceTx } from '@/lib/utils/sendSubmitEvidenceTx';
import { addressesEqual } from '@/lib/utils/address';
import {
  normalizeOnchainStatus,
  ONCHAIN_JOB_STATUS,
  onchainStatusLabel,
  type OnChainJob,
} from '@/lib/utils/onchainJob';
import { useContractTx } from './useContractTx';

export const VOTE_CHOICES = {
  FREELANCER_WIN: 1,
  CLIENT_WIN: 2,
  SPLIT: 3,
} as const;

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

type OnChainDispute = {
  initiator: Address;
  createdAt: bigint;
  resultAt: bigint;
  isResolved: boolean;
  round: number;
  commitCount: number;
  revealCount: number;
  pendingResult: number;
};

async function readOnchainJob(jobId: bigint): Promise<OnChainJob> {
  const raw = (await readContract(wagmiConfig, {
    ...contracts.jobRegistry,
    functionName: 'getJob',
    args: [jobId],
  })) as OnChainJob;
  return { ...raw, status: normalizeOnchainStatus(raw.status) };
}

async function readOnchainDispute(jobId: bigint): Promise<OnChainDispute> {
  return (await readContract(wagmiConfig, {
    ...contracts.arbitratorPanel,
    functionName: 'disputes',
    args: [jobId],
  })) as OnChainDispute;
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
        executeContractWrite({
          address: contracts.arbitratorPanel.address,
          abi: contracts.arbitratorPanel.abi as Abi,
          functionName: 'commitVote',
          args: [BigInt(onchainJobId), hash],
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

      await tx.runTx('Đang reveal vote…', () =>
        executeContractWrite({
          address: contracts.arbitratorPanel.address,
          abi: contracts.arbitratorPanel.abi as Abi,
          functionName: 'revealVote',
          args: [BigInt(onchainJobId), choice, salt],
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
        executeContractWrite({
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'finalizeDisputeVoting',
          args: [BigInt(onchainJobId)],
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
        executeContractWrite({
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'executeArbitrationResult',
          args: [BigInt(onchainJobId)],
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
