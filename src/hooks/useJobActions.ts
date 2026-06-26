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

function computeDisputeFee(contractValueMicro: bigint): bigint {
  let fee = (contractValueMicro * DISPUTE_FEE_BPS) / 100n;
  if (fee > DISPUTE_FEE_CAP) fee = DISPUTE_FEE_CAP;
  return fee;
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
      'startWork đã xác nhận nhưng job chưa chuyển sang IN_PROGRESS — đợi vài giây rồi bấm nộp lại.',
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
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');

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
        await tx.runTx('Bước 1/2: Bắt đầu làm việc on-chain (startWork)…', () =>
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
        throw new Error('IPFS không trả về CID — thử lại upload.');
      }

      onchainJob = await readOnchainJob(jobId);
      validateDeliverableSubmit(onchainJob, wallet);

      if (onchainJob.status !== ONCHAIN_JOB_STATUS.IN_PROGRESS) {
        throw new Error(
          `Job on-chain đang ${onchainJob.status === ONCHAIN_JOB_STATUS.ASSIGNED ? 'ASSIGNED' : 'không phải IN_PROGRESS'} — cần startWork trước khi submitWork.`,
        );
      }

      await simulateSubmitWork(wallet, jobId, deliverableCID.trim());

      const submitLabel = needsStartWork
        ? 'Bước 2/2: Nộp bàn giao on-chain (submitWork)…'
        : 'Đang nộp bàn giao on-chain (submitWork)…';

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
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');

      const wallet = getAddress(address);
      const jobId = BigInt(onchainJobId);
      const onchainJob = await readOnchainJob(jobId);

      if (!addressesEqual(onchainJob.client, wallet)) {
        throw new Error(
          `Ví MetaMask (${wallet}) không trùng client on-chain (${getAddress(onchainJob.client)}). ` +
            'Hãy đổi sang ví client đã tạo job.',
        );
      }

      if (onchainJob.status !== ONCHAIN_JOB_STATUS.SUBMITTED) {
        throw new Error(
          `Job on-chain đang ${onchainJob.status === ONCHAIN_JOB_STATUS.DISPUTED ? 'DISPUTED' : `trạng thái #${onchainJob.status}`} — ` +
            'chỉ phê duyệt khi SUBMITTED (sau khi freelancer submitWork).',
        );
      }

      await tx.runTx('Đang phê duyệt bàn giao và giải phóng USDC…', () =>
        executeContractWrite({
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'approveAndRelease',
          args: [jobId],
          account: wallet,
        }),
      );
    },
    [address, tx],
  );

  const raiseDispute = useCallback(
    async (onchainJobId: number) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');

      const wallet = getAddress(address);
      const jobId = BigInt(onchainJobId);
      const onchainJob = await readOnchainJob(jobId);
      const isClient = addressesEqual(onchainJob.client, wallet);
      const isFreelancer = addressesEqual(onchainJob.freelancer, wallet);

      if (!isClient && !isFreelancer) {
        throw new Error(
          `Ví MetaMask (${wallet}) không phải client/freelancer của job on-chain. ` +
            'Chỉ một trong hai bên mới được mở tranh chấp.',
        );
      }

      if (
        onchainJob.status !== ONCHAIN_JOB_STATUS.SUBMITTED &&
        onchainJob.status !== ONCHAIN_JOB_STATUS.IN_PROGRESS
      ) {
        throw new Error(
          `Job on-chain đang ${onchainStatusLabel(onchainJob.status)} — ` +
            'chỉ khiếu nại khi SUBMITTED hoặc IN_PROGRESS.',
        );
      }

      const fee = computeDisputeFee(onchainJob.contractValue);

      const allowance = (await readContract(wagmiConfig, {
        ...contracts.mockUsdc,
        functionName: 'allowance',
        args: [wallet, CONTRACT_ADDRESSES.EscrowVault],
      })) as bigint;

      if (allowance < fee) {
        await tx.runTx('Đang approve phí tranh chấp USDC…', () =>
          executeContractWrite({
            address: contracts.mockUsdc.address,
            abi: contracts.mockUsdc.abi as Abi,
            functionName: 'approve',
            args: [CONTRACT_ADDRESSES.EscrowVault, fee],
            account: wallet,
          }),
        );
      }

      await tx.runTx('Đang mở tranh chấp on-chain…', () =>
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
