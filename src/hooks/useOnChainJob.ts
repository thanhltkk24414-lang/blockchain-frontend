import { useCallback, useEffect, useState } from 'react';
import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { escrowTotalFromOnChain } from '@/lib/utils/usdc';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import {
  ONCHAIN_JOB_STATUS,
  normalizeOnchainStatus,
  onchainStatusLabel,
  type OnChainJob,
} from '@/lib/utils/onchainJob';

export type OnChainJobState = {
  job: OnChainJob;
  statusLabel: string;
  escrowFunded: boolean;
};

export function useOnChainJob(onchainJobId?: number, refreshKey?: string | number) {
  const [state, setState] = useState<OnChainJobState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOnChain = useCallback(async () => {
    if (!isValidOnchainJobId(onchainJobId)) {
      setState(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const job = (await readContract(wagmiConfig, {
        ...contracts.jobRegistry,
        functionName: 'getJob',
        args: [BigInt(onchainJobId!)],
      })) as OnChainJob;

      const normalizedJob: OnChainJob = {
        ...job,
        status: normalizeOnchainStatus(job.status),
      };

      let escrowFunded = false;
      if (
        normalizedJob.contractValue > 0n &&
        (normalizedJob.status === ONCHAIN_JOB_STATUS.ASSIGNED ||
          normalizedJob.status === ONCHAIN_JOB_STATUS.IN_PROGRESS ||
          normalizedJob.status === ONCHAIN_JOB_STATUS.SUBMITTED)
      ) {
        const balance = (await readContract(wagmiConfig, {
          ...contracts.mockUsdc,
          functionName: 'balanceOf',
          args: [CONTRACT_ADDRESSES.EscrowVault],
        })) as bigint;
        escrowFunded = balance >= escrowTotalFromOnChain(normalizedJob.contractValue);
      }

      const next: OnChainJobState = {
        job: normalizedJob,
        statusLabel: onchainStatusLabel(normalizedJob.status),
        escrowFunded,
      };
      setState(next);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không đọc được job on-chain';
      setError(message);
      setState(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [onchainJobId]);

  useEffect(() => {
    void fetchOnChain();
  }, [fetchOnChain, refreshKey]);

  return {
    onchainJob: state?.job ?? null,
    onchainStatus: state?.job.status ?? null,
    onchainStatusLabel: state?.statusLabel ?? null,
    onchainFreelancer: state?.job.freelancer ?? null,
    onchainClient: state?.job.client ?? null,
    escrowFunded: state?.escrowFunded ?? false,
    loading,
    error,
    refetch: fetchOnChain,
  };
}
