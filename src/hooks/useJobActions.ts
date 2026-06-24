import { useCallback } from 'react';
import { readContract } from 'wagmi/actions';
import { useWriteContract } from 'wagmi';
import { useAccount } from 'wagmi';
import { wagmiConfig } from '@/config/wagmi';
import { uploadIpfsFile, uploadIpfsMetadata } from '@/lib/api';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
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
          writeContractAsync({
            ...contracts.escrowVault,
            functionName: 'startWork',
            args: [jobId],
          }),
        );
      }

      await tx.runTx('Submitting deliverable on-chain…', () =>
        writeContractAsync({
          ...contracts.escrowVault,
          functionName: 'submitWork',
          args: [jobId, deliverableCID],
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
      await tx.runTx('Approving deliverable and releasing funds…', () =>
        writeContractAsync({
          ...contracts.escrowVault,
          functionName: 'approveAndRelease',
          args: [BigInt(onchainJobId)],
        }),
      );
    },
    [tx, writeContractAsync],
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
          writeContractAsync({
            ...contracts.mockUsdc,
            functionName: 'approve',
            args: [CONTRACT_ADDRESSES.EscrowVault, fee],
          }),
        );
      }

      await tx.runTx('Raising dispute on-chain…', () =>
        writeContractAsync({
          ...contracts.escrowVault,
          functionName: 'raiseDispute',
          args: [BigInt(onchainJobId)],
        }),
      );
    },
    [address, tx, writeContractAsync],
  );

  return { approveAndRelease, raiseDispute, ...tx };
}
