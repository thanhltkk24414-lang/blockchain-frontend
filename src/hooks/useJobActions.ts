import { useCallback } from 'react';
import { readContract, simulateContract } from 'wagmi/actions';
import { useAccount } from 'wagmi';
import type { Abi } from 'viem';
import { getAddress } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { uploadIpfsFile, uploadIpfsMetadata } from '@/lib/api';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { executeContractWrite } from '@/lib/utils/contractWrite';
import {
  normalizeOnchainStatus,
  ONCHAIN_JOB_STATUS,
  onchainStatusLabel,
  type OnChainJob,
  validateDeliverableSubmit,
} from '@/lib/utils/onchainJob';
import { addressesEqual } from '@/lib/utils/address';
import { useContractTx } from './useContractTx';

const PREFLIGHT_CID = 'QmPreflightCheck000000000000000000000000000';
const DISPUTE_FEE_BPS = 2n;
const DISPUTE_FEE_CAP = 50_000_000n; // 50 USDC (6 decimals)
const MIN_ARBITRATOR_POOL = 5n;

function computeDisputeFee(contractValueMicro: bigint): bigint {
  let fee = (contractValueMicro * DISPUTE_FEE_BPS) / 100n;
  if (fee > DISPUTE_FEE_CAP) fee = DISPUTE_FEE_CAP;
  return fee;
}

async function preflightRaiseDispute(
  wallet: `0x${string}`,
  onchainJob: OnChainJob,
): Promise<bigint> {
  const isClient = addressesEqual(onchainJob.client, wallet);
  const isFreelancer = addressesEqual(onchainJob.freelancer, wallet);

  if (!isClient && !isFreelancer) {
    throw new Error(
      `MetaMask wallet (${wallet}) is not the on-chain client or freelancer. ` +
        'Only a job party can raise a dispute.',
    );
  }

  if (
    onchainJob.status !== ONCHAIN_JOB_STATUS.SUBMITTED &&
    onchainJob.status !== ONCHAIN_JOB_STATUS.IN_PROGRESS
  ) {
    throw new Error(
      `On-chain job is ${onchainStatusLabel(onchainJob.status)} — ` +
        'disputes are only allowed when SUBMITTED or IN_PROGRESS.',
    );
  }

  const tier = (await readContract(wagmiConfig, {
    ...contracts.reputationStore,
    functionName: 'getTier',
    args: [wallet],
  })) as number;
  if (tier <= 1) {
    throw new Error(
      'LowReputationTier: Warning/Restricted tiers cannot raise disputes — need Normal or Trusted.',
    );
  }

  const poolSize = (await readContract(wagmiConfig, {
    ...contracts.arbitratorPanel,
    functionName: 'poolSize',
  })) as bigint;
  if (poolSize < MIN_ARBITRATOR_POOL) {
    throw new Error(
      `NotEnoughArbitrators: pool size is ${poolSize.toString()} — need ≥5 arbitrators (run scripts/seed-arbitrator-pool.js).`,
    );
  }

  const fee = computeDisputeFee(onchainJob.contractValue);
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

  if (balance < fee) {
    throw new Error(
      `TransferFailed: need ${Number(fee) / 1e6} USDC dispute fee — MockUSDC balance ${Number(balance) / 1e6}. Mint more on Sepolia.`,
    );
  }

  if (allowance < fee) {
    return fee;
  }

  return 0n;
}

async function readOnchainJob(jobId: bigint): Promise<OnChainJob> {
  const raw = (await readContract(wagmiConfig, {
    ...contracts.jobRegistry,
    functionName: 'getJob',
    args: [jobId],
  })) as OnChainJob;
  return { ...raw, status: normalizeOnchainStatus(raw.status) };
}

async function simulateStartWork(wallet: `0x${string}`, jobId: bigint): Promise<void> {
  await simulateContract(wagmiConfig, {
    address: contracts.escrowVault.address,
    abi: contracts.escrowVault.abi as Abi,
    functionName: 'startWork',
    args: [jobId],
    account: wallet,
  });
}

async function simulateSubmitWork(
  wallet: `0x${string}`,
  jobId: bigint,
  cid: string = PREFLIGHT_CID,
): Promise<void> {
  await simulateContract(wagmiConfig, {
    address: contracts.escrowVault.address,
    abi: contracts.escrowVault.abi as Abi,
    functionName: 'submitWork',
    args: [jobId, cid],
    account: wallet,
  });
}

async function waitForInProgress(jobId: bigint): Promise<OnChainJob> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const job = await readOnchainJob(jobId);
    if (job.status === ONCHAIN_JOB_STATUS.IN_PROGRESS) return job;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  const job = await readOnchainJob(jobId);
  if (job.status !== ONCHAIN_JOB_STATUS.IN_PROGRESS) {
    throw new Error(
      'startWork confirmed but job is not IN_PROGRESS yet — wait a few seconds and submit again.',
    );
  }
  return job;
}

export function useDeliverableSubmit() {
  const { address } = useAccount();
  const tx = useContractTx();

  const submit = useCallback(
    async (params: {
      onchainJobId: number;
      jobTitle: string;
      file?: File | null;
      notes: string;
      repoUrl?: string;
    }) => {
      if (!address) throw new Error('Connect your MetaMask wallet first.');

      const wallet = getAddress(address);
      const jobId = BigInt(params.onchainJobId);
      let onchainJob = await readOnchainJob(jobId);
      validateDeliverableSubmit(onchainJob, wallet);

      const needsStartWork = onchainJob.status === ONCHAIN_JOB_STATUS.ASSIGNED;

      if (needsStartWork) {
        await simulateStartWork(wallet, jobId);
      } else {
        await simulateSubmitWork(wallet, jobId);
      }

      if (needsStartWork) {
        await tx.runTx('Step 1/2: Start work on-chain (startWork)…', () =>
          executeContractWrite({
            address: contracts.escrowVault.address,
            abi: contracts.escrowVault.abi as Abi,
            functionName: 'startWork',
            args: [jobId],
            account: wallet,
          }),
        );
        onchainJob = await waitForInProgress(jobId);
      }

      let deliverableCID: string;

      if (params.file) {
        const upload = await uploadIpfsFile(params.file);
        deliverableCID = upload.cid;
      } else {
        const upload = await uploadIpfsMetadata({
          type: 'deliverable',
          jobTitle: params.jobTitle,
          notes: params.notes,
          repoUrl: params.repoUrl || undefined,
          freelancerAddress: wallet,
          submittedAt: new Date().toISOString(),
        });
        deliverableCID = upload.cid;
      }

      if (!deliverableCID?.trim()) {
        throw new Error('IPFS did not return a CID — retry the upload.');
      }

      onchainJob = await readOnchainJob(jobId);
      validateDeliverableSubmit(onchainJob, wallet);

      if (onchainJob.status !== ONCHAIN_JOB_STATUS.IN_PROGRESS) {
        throw new Error(
          `On-chain job is ${onchainJob.status === ONCHAIN_JOB_STATUS.ASSIGNED ? 'ASSIGNED' : 'not IN_PROGRESS'} — call startWork before submitWork.`,
        );
      }

      await simulateSubmitWork(wallet, jobId, deliverableCID.trim());

      const submitLabel = needsStartWork
        ? 'Step 2/2: Submit deliverable on-chain (submitWork)…'
        : 'Submitting deliverable on-chain (submitWork)…';

      await tx.runTx(submitLabel, () =>
        executeContractWrite({
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'submitWork',
          args: [jobId, deliverableCID.trim()],
          account: wallet,
        }),
      );

      return deliverableCID;
    },
    [address, tx],
  );

  return { submit, ...tx };
}

export function useClientJobActions() {
  const { address } = useAccount();
  const tx = useContractTx();

  const approveAndRelease = useCallback(
    async (onchainJobId: number) => {
      if (!address) throw new Error('Connect your MetaMask wallet first.');

      const wallet = getAddress(address);
      const jobId = BigInt(onchainJobId);
      const onchainJob = await readOnchainJob(jobId);

      if (!addressesEqual(onchainJob.client, wallet)) {
        throw new Error(
          `MetaMask wallet (${wallet}) does not match on-chain client (${getAddress(onchainJob.client)}). ` +
            'Switch to the client wallet that created the job.',
        );
      }

      if (onchainJob.status !== ONCHAIN_JOB_STATUS.SUBMITTED) {
        throw new Error(
          `On-chain job is ${onchainJob.status === ONCHAIN_JOB_STATUS.DISPUTED ? 'DISPUTED' : `status #${onchainJob.status}`} — ` +
            'approve only when SUBMITTED (after freelancer submitWork).',
        );
      }

      await tx.runTx(
        'Approving deliverable and releasing USDC…',
        () =>
          executeContractWrite({
            address: contracts.escrowVault.address,
            abi: contracts.escrowVault.abi as Abi,
            functionName: 'approveAndRelease',
            args: [jobId],
            account: wallet,
          }),
        {
          gasParams: {
            address: contracts.escrowVault.address,
            abi: contracts.escrowVault.abi as Abi,
            functionName: 'approveAndRelease',
            args: [jobId],
            account: wallet,
          },
        },
      );
    },
    [address, tx],
  );

  const raiseDispute = useCallback(
    async (onchainJobId: number) => {
      if (!address) throw new Error('Connect your MetaMask wallet first.');

      const wallet = getAddress(address);
      const jobId = BigInt(onchainJobId);
      const onchainJob = await readOnchainJob(jobId);
      const needsApprove = await preflightRaiseDispute(wallet, onchainJob);

      if (needsApprove > 0n) {
        await tx.runTx('Approving USDC dispute fee…', () =>
          executeContractWrite({
            address: contracts.mockUsdc.address,
            abi: contracts.mockUsdc.abi as Abi,
            functionName: 'approve',
            args: [CONTRACT_ADDRESSES.EscrowVault, needsApprove],
            account: wallet,
          }),
        );
      }

      await tx.runTx('Raising dispute on-chain…', () =>
        executeContractWrite({
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'raiseDispute',
          args: [jobId],
          account: wallet,
        }),
      );
    },
    [address, tx],
  );

  return { approveAndRelease, raiseDispute, ...tx };
}
