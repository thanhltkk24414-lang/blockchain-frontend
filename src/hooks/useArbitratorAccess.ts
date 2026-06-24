import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { fetchArbitratorStatus } from '@/lib/api';

export interface ArbitratorAccess {
  loading: boolean;
  stakedAmount?: number;
  minStake?: number;
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

    fetchArbitratorStatus(address)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setState({
            loading: false,
            stakedAmount: res.stakedAmount,
            minStake: res.minStake,
            isValid: Boolean(res.isValid),
            message: res.message,
          });
        } else {
          setState({ loading: false, isValid: false, error: 'Failed to load arbitrator status' });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            loading: false,
            isValid: false,
            error: err instanceof Error ? err.message : 'Failed to load arbitrator status',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return state;
}
