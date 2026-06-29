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
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { executeContractWrite } from '@/lib/utils/contractWrite';
import { getDisputePhaseInfo } from '@/lib/utils/disputePhase';
import {
  addVoteToTally,
  emptyVoteTally,
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

export function computeVoteHash(choice: number, salt: string): `0x${string}` {
  return keccak256(encodePacked(['uint256', 'string'], [BigInt(choice), salt]));
}

export function cidToEvidenceHash(cid: string): `0x${string}` {
  const trimmed = cid.trim();
  if (!trimmed) {
    throw new Error('Empty IPFS CID — complete upload before submitEvidence.');
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

async function preflightFinalizeDisputeVoting(wallet: Address, jobId: bigint): Promise<void> {
  const dispute = await readOnchainDispute(jobId);
  if (dispute.createdAt === 0n) {
    throw new Error('No on-chain dispute for this job yet — verify raiseDispute completed.');
  }

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const revealEnd = dispute.createdAt + BigInt(DISPUTE_PHASES.revealEndMin * 60);
  if (nowSec <= revealEnd) {
    throw new Error(
      `VotingStillActive: reveal phase still open — wait until block.timestamp is strictly after minute ${DISPUTE_PHASES.revealEndMin} from dispute start.`,
    );
  }

  await simulateContract(wagmiConfig, {
    address: contracts.escrowVault.address,
    abi: contracts.escrowVault.abi as Abi,
    functionName: 'finalizeDisputeVoting',
    args: [jobId],
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
      `MetaMask wallet (${wallet}) is not the on-chain client or freelancer. ` +
        'Only one of the two parties can submit evidence.',
    );
  }

  if (onchainJob.status !== ONCHAIN_JOB_STATUS.DISPUTED) {
    throw new Error(
      `On-chain job is ${onchainStatusLabel(onchainJob.status)} — evidence can only be submitted when DISPUTED (after raiseDispute).`,
    );
  }

  const dispute = await readOnchainDispute(jobId);
  if (dispute.createdAt === 0n) {
    throw new Error('No on-chain dispute for this job yet — wait for the indexer or verify raiseDispute.');
  }

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const evidenceWindowSec = BigInt(DISPUTE_PHASES.evidenceRebuttalEndMin * 60);
  const windowEnd = dispute.createdAt + evidenceWindowSec;
  if (nowSec > windowEnd) {
    throw new Error(
      `EvidenceWindowClosed: more than ${DISPUTE_PHASES.evidenceRebuttalEndMin} minutes since the dispute opened — no further evidence can be submitted.`,
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

const APPEAL_FEE_NUM = 130n;
const APPEAL_FEE_DEN = 100n;

async function preflightFileAppeal(wallet: Address, jobId: bigint): Promise<bigint> {
  const onchainJob = await readOnchainJob(jobId);
  const isClient = addressesEqual(onchainJob.client, wallet);
  const isFreelancer = addressesEqual(onchainJob.freelancer, wallet);
  if (!isClient && !isFreelancer) {
    throw new Error(
      `MetaMask wallet (${wallet}) is not the on-chain client or freelancer — only a party can file an appeal.`,
    );
  }

  if (onchainJob.status !== ONCHAIN_JOB_STATUS.DISPUTED) {
    throw new Error(
      `On-chain job is ${onchainStatusLabel(onchainJob.status)} — appeals apply only to DISPUTED jobs.`,
    );
  }

  const [dispute, round, appealed, finalized] = await Promise.all([
    readOnchainDispute(jobId),
    readDisputeRound(jobId),
    readAppealFiled(jobId),
    readIsVotingFinalized(jobId),
  ]);

  if (dispute.createdAt === 0n) {
    throw new Error('No on-chain dispute record — wait for raiseDispute / indexer sync.');
  }

  if (!finalized && !dispute.isResolved) {
    throw new Error('VotingNotFinalized: call Finalize voting first (needs ≥3 valid reveals).');
  }

  if (round !== 1) {
    throw new Error('AppealNotAllowed: only round 1 can be appealed — round 2 is final.');
  }

  if (appealed) {
    throw new Error('AppealAlreadyFiled: an appeal was already submitted for this job.');
  }

  const createdAtSec = Number(dispute.createdAt);
  const resultAtSec = Number(dispute.resultAt);
  const phase = getDisputePhaseInfo(createdAtSec, resultAtSec, dispute.isResolved);
  if (phase.phase !== 'appeal') {
    if (phase.phase === 'execute') {
      throw new Error('AppealWindowClosed: appeal window ended — call Execute result instead.');
    }
    throw new Error(
      `Appeal not open yet — current phase: ${phase.label}. Wait until after finalize voting.`,
    );
  }

  const disputeFee = (await readContract(wagmiConfig, {
    ...contracts.escrowVault,
    functionName: 'disputeFees',
    args: [jobId],
  })) as bigint;

  if (disputeFee <= 0n) {
    throw new Error('Appeal fee unavailable — dispute fee not recorded on-chain for this job.');
  }

  const appealFee = (disputeFee * APPEAL_FEE_NUM) / APPEAL_FEE_DEN;
  const [balance, allowance] = (await Promise.all([
    readContract(wagmiConfig, {
      ...contracts.mockUsdc,
      functionName: 'balanceOf',
      args: [wallet],
    }),
    readContract(wagmiConfig, {
      ...contracts.mockUsdc,
      functionName: 'allowance',
      args: [wallet, CONTRACT_ADDRESSES.EscrowVault],
    }),
  ])) as [bigint, bigint];

  if (balance < appealFee) {
    throw new Error(
      `TransferFailed: need ${Number(appealFee) / 1e6} USDC appeal fee (1.3× dispute fee) — balance ${Number(balance) / 1e6}.`,
    );
  }

  return allowance < appealFee ? appealFee : 0n;
}

export function useDisputeActions() {
  const { address } = useAccount();
  const tx = useContractTx();

  const submitEvidence = useCallback(
    async (onchainJobId: number, cid: string) => {
      if (!address) throw new Error('Connect your MetaMask wallet first.');
      const wallet = getAddress(address);
      const jobId = BigInt(onchainJobId);
      const evidenceHash = cidToEvidenceHash(cid);

      await preflightSubmitEvidence(wallet, jobId, evidenceHash);

      await tx.runTx('Submitting evidence on-chain…', () =>
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
      if (!address) throw new Error('Connect your MetaMask wallet first.');
      const wallet = getAddress(address);
      const hash = computeVoteHash(choice, salt);

      await tx.runTx('Committing vote…', () =>
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
      if (!address) throw new Error('Connect your MetaMask wallet first.');
      const wallet = getAddress(address);
      const jobId = BigInt(onchainJobId);

      if (await hasArbitratorRevealed(jobId, wallet)) {
        throw new Error('AlreadyRevealed: you have already revealed your vote for this job — no need to submit again.');
      }

      try {
        await preflightRevealVote(wallet, jobId, choice, salt);
      } catch (simErr) {
        throw new Error(
          decodeContractError(simErr, contracts.arbitratorPanel.abi as Abi, 'revealVote'),
        );
      }

      await tx.runTx('Revealing vote…', () =>
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
      if (!address) throw new Error('Connect your MetaMask wallet first.');
      const wallet = getAddress(address);
      const jobId = BigInt(onchainJobId);

      try {
        await preflightFinalizeDisputeVoting(wallet, jobId);
      } catch (simErr) {
        throw new Error(
          decodeContractError(simErr, contracts.escrowVault.abi as Abi, 'finalizeDisputeVoting'),
        );
      }

      await tx.runTx('Finalizing dispute voting…', () =>
        sendFinalizeDisputeTx({
          onchainJobId: jobId,
          account: wallet,
        }),
      );
    },
    [address, tx],
  );

  const executeArbitrationResult = useCallback(
    async (onchainJobId: number) => {
      if (!address) throw new Error('Connect your MetaMask wallet first.');
      const wallet = getAddress(address);

      await tx.runTx('Executing arbitration result…', () =>
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
      if (!address) throw new Error('Connect your MetaMask wallet first.');
      const wallet = getAddress(address);
      const jobId = BigInt(onchainJobId);

      const needsApprove = await preflightFileAppeal(wallet, jobId);
      if (needsApprove > 0n) {
        await tx.runTx('Approving USDC appeal fee (1.3× dispute fee)…', () =>
          executeContractWrite({
            address: contracts.mockUsdc.address,
            abi: contracts.mockUsdc.abi as Abi,
            functionName: 'approve',
            args: [CONTRACT_ADDRESSES.EscrowVault, needsApprove],
            account: wallet,
          }),
        );
      }

      await tx.runTx('Filing appeal (starts round 2 panel)…', () =>
        sendFileAppealTx({
          onchainJobId: jobId,
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
