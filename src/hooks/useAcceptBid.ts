import { useCallback } from 'react';
import { useWriteContract } from 'wagmi';
import { acceptBid } from '@/lib/api';
import { contracts } from '@/lib/contracts/config';
import { useContractTx } from './useContractTx';

export function useAcceptBid() {
  const { writeContractAsync } = useWriteContract();
  const tx = useContractTx();

  const accept = useCallback(
    async (params: {
      bidId: string;
      onchainJobId: number;
      freelancerAddress: `0x${string}`;
    }) => {
      const apiRes = await acceptBid(params.bidId);
      if (!apiRes.success) {
        throw new Error('Failed to accept bid on server');
      }

      await tx.runTx('Assigning freelancer on JobRegistry…', () =>
        writeContractAsync({
          ...contracts.jobRegistry,
          functionName: 'assignFreelancer',
          args: [BigInt(params.onchainJobId), params.freelancerAddress],
        }),
      );

      return apiRes;
    },
    [tx, writeContractAsync],
  );

  return { accept, ...tx };
}
