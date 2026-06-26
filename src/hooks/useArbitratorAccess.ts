import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { formatUnits } from 'viem';
import type { Abi } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';

const MIN_STAKE_USDC = 50;

export interface ArbitratorAccess {
  loading: boolean;
  stakedAmount?: number;
  minStake?: number;
  inPool?: boolean;
  isValid: boolean;
  message?: string;
  error?: string;
}

export function useArbitratorAccess(): ArbitratorAccess {
  const { address } = useAccount();
  const [state, setState] = useState<ArbitratorAccess>({
    loading: false,
    isValid: false,
  });

  useEffect(() => {
    if (!address) {
      setState({ loading: false, isValid: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: undefined }));

    (async () => {
      try {
        const [stakeWei, inPool] = await Promise.all([
          readContract(wagmiConfig, {
            address: contracts.platformTreasury.address,
            abi: contracts.platformTreasury.abi as Abi,
            functionName: 'arbitratorStakes',
            args: [address],
          }),
          readContract(wagmiConfig, {
            address: contracts.arbitratorPanel.address,
            abi: contracts.arbitratorPanel.abi as Abi,
            functionName: 'isInPool',
            args: [address],
          }),
        ]);

        const stakedAmount = parseFloat(formatUnits(stakeWei as bigint, 6));
        const isInPool = Boolean(inPool);
        const isValid = isInPool || stakedAmount >= MIN_STAKE_USDC;

        if (!cancelled) {
          setState({
            loading: false,
            stakedAmount,
            minStake: MIN_STAKE_USDC,
            inPool: isInPool,
            isValid,
            message: isValid
              ? isInPool
                ? 'In arbitrator pool — console access granted'
                : 'Stake sufficient — join pool to be eligible for sortition'
              : `Stake at least ${MIN_STAKE_USDC} USDC via PlatformTreasury`,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            isValid: false,
            error: err instanceof Error ? err.message : 'Failed to read arbitrator stake on-chain',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  return state;
}
