import { useCallback } from 'react';
import { readContract } from 'wagmi/actions';
import { useWriteContract } from 'wagmi';
import { useAccount } from 'wagmi';
import type { Abi } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { uploadIpfsFile, uploadIpfsMetadata } from '@/lib/api';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { executeContractWrite } from '@/lib/utils/contractWrite';
import { useContractTx } from './useContractTx';

export function useDeliverableSubmit() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const tx = useContractTx();

  const submit = useCallback(
    async (params: {
      onchainJobId: number;
      jobTitle: string;
      file?: File | null;
      notes: string;
      repoUrl?: string;
    }) => {
      if (!address) throw new Error('Connect your wallet first');

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
          freelancerAddress: address,
          submittedAt: new Date().toISOString(),
        });
        deliverableCID = upload.cid;
      }

      const jobId = BigInt(params.onchainJobId);

      const job = (await readContract(wagmiConfig, {
        ...contracts.jobRegistry,
        functionName: 'getJob',
        args: [jobId],
      })) as { status: number };

      // 1 = ASSIGNED — freelancer must start work before submitting
      if (job.status === 1) {
        await tx.runTx('Starting work on-chain…', () =>
          executeContractWrite(writeContractAsync, {
            address: contracts.escrowVault.address,
            abi: contracts.escrowVault.abi as Abi,
            functionName: 'startWork',
            args: [jobId],
            account: address,
          }),
        );
      }

      await tx.runTx('Submitting deliverable on-chain…', () =>
        executeContractWrite(writeContractAsync, {
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'submitWork',
          args: [jobId, deliverableCID],
          account: address,
        }),
      );

      return deliverableCID;
    },
    [address, tx, writeContractAsync],
  );

  return { submit, ...tx };
}

export function useClientJobActions() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const tx = useContractTx();

  const approveAndRelease = useCallback(
    async (onchainJobId: number) => {
      if (!address) throw new Error('Connect your wallet first');
      await tx.runTx('Approving deliverable and releasing funds…', () =>
        executeContractWrite(writeContractAsync, {
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'approveAndRelease',
          args: [BigInt(onchainJobId)],
          account: address,
        }),
      );
    },
    [address, tx, writeContractAsync],
  );

  const raiseDispute = useCallback(
    async (onchainJobId: number, contractValue: number) => {
      if (!address) throw new Error('Connect your wallet first');

      const fee = BigInt(Math.ceil(contractValue * 0.02 * 1_000_000));

      const allowance = (await readContract(wagmiConfig, {
        ...contracts.mockUsdc,
        functionName: 'allowance',
        args: [address, CONTRACT_ADDRESSES.EscrowVault],
      })) as bigint;

      if (allowance < fee) {
        await tx.runTx('Approving USDC dispute fee…', () =>
          executeContractWrite(writeContractAsync, {
            address: contracts.mockUsdc.address,
            abi: contracts.mockUsdc.abi as Abi,
            functionName: 'approve',
            args: [CONTRACT_ADDRESSES.EscrowVault, fee],
            account: address,
          }),
        );
      }

      await tx.runTx('Raising dispute on-chain…', () =>
        executeContractWrite(writeContractAsync, {
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'raiseDispute',
          args: [BigInt(onchainJobId)],
          account: address,
        }),
      );
    },
    [address, tx, writeContractAsync],
  );

  return { approveAndRelease, raiseDispute, ...tx };
}
