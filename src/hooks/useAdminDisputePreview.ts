import { useCallback, useEffect, useState } from 'react';
import {
  readChosenArbitrators,
  readOnchainDispute,
  readOnchainJob,
  type OnChainDispute,
} from '@/hooks/useDisputeActions';
import { onchainStatusLabel } from '@/lib/utils/onchainJob';
import {
  assessForceResolveEligibility,
  type ForceResolveEligibility,
} from '@/lib/utils/forceResolveEligibility';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';

export type AdminDisputePreview = {
  loading: boolean;
  error?: string;
  onchainStatus?: number;
  onchainStatusLabel?: string;
  dispute?: OnChainDispute;
  chosenArbitrators: string[];
  eligibility: ForceResolveEligibility | null;
  refresh: () => void;
};

const EMPTY: AdminDisputePreview = {
  loading: false,
  chosenArbitrators: [],
  eligibility: null,
  refresh: () => {},
};

export function useAdminDisputePreview(jobIdInput: string): AdminDisputePreview {
  const [state, setState] = useState<AdminDisputePreview>(EMPTY);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const trimmed = jobIdInput.trim();
    const parsed = trimmed ? Number(trimmed) : NaN;

    if (!trimmed || !Number.isFinite(parsed) || parsed <= 0 || !isValidOnchainJobId(parsed)) {
      setState({ ...EMPTY, refresh });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: undefined, refresh }));

    (async () => {
      try {
        const jobId = BigInt(parsed);
        const [job, dispute, arbs] = await Promise.all([
          readOnchainJob(jobId),
          readOnchainDispute(jobId),
          readChosenArbitrators(parsed),
        ]);

        const eligibility = assessForceResolveEligibility(job.status, dispute);

        if (!cancelled) {
          setState({
            loading: false,
            onchainStatus: job.status,
            onchainStatusLabel: onchainStatusLabel(job.status),
            dispute,
            chosenArbitrators: arbs,
            eligibility,
            refresh,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            chosenArbitrators: [],
            eligibility: null,
            error: err instanceof Error ? err.message : 'Failed to read on-chain dispute state',
            refresh,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobIdInput, refreshKey, refresh]);

  return state;
}
