import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { formatUnits } from 'viem';
import type { Abi } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';

const MIN_STAKE_USDC = 50;

/** Share resolved stake/pool reads across hook instances (AppShell vs RoleGuard). */
let accessCache: { address: string; state: ArbitratorAccess } | null = null;

export function clearArbitratorAccessCache() {
  accessCache = null;
}

function initialAccess(address?: string): ArbitratorAccess {
  if (address && accessCache?.address === address.toLowerCase()) {
    return accessCache.state;
  }
  return { loading: Boolean(address), isValid: false };
}

export interface ArbitratorAccess {
  loading: boolean;
  stakedAmount?: number;
  minStake?: number;
  inPool?: boolean;
  isValid: boolean;
  message?: string;
  error?: string;
}

export function useArbitratorAccess(refreshKey = 0): ArbitratorAccess {
  const { address } = useAccount();
  const [state, setState] = useState<ArbitratorAccess>(() => initialAccess(address));

  useEffect(() => {
    if (!address) {
      accessCache = null;
      setState({ loading: false, isValid: false });
      return;
    }

    const cached =
      refreshKey === 0 && accessCache?.address === address.toLowerCase() ? accessCache.state : null;
    if (cached && !cached.loading) {
      setState(cached);
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
          const next: ArbitratorAccess = {
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
          };
          accessCache = { address: address.toLowerCase(), state: next };
          setState(next);
        }
      } catch (err) {
        if (!cancelled) {
          accessCache = null;
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
  }, [address, refreshKey]);

  return state;
}
