import { useCallback, useEffect, useState } from 'react';
import { fetchDisputes, fetchJobs } from '@/lib/api';
import {
  isAssignedArbitrator,
  readChosenArbitrators,
  readOnchainDispute,
  readOnchainJob,
} from '@/hooks/useDisputeActions';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { ONCHAIN_JOB_STATUS } from '@/lib/utils/onchainJob';

export type ArbitratorDisputeItem = {
  onchainJobId: number;
  jobId?: string;
  title?: string;
  disputeStatus: string;
  panelArbitrators: string[];
};

type LoadResult = {
  assigned: ArbitratorDisputeItem[];
  poolOnly: ArbitratorDisputeItem[];
  /** Sample panel wallets from active disputes (for wrong-wallet hint). */
  samplePanelWallets: string[];
};

function shortWallet(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export { shortWallet };

async function loadArbitratorDisputes(
  address: string,
  inPool: boolean,
): Promise<LoadResult> {
  const [jobsRes, disputesRes] = await Promise.all([
    // Indexer may lag — do not filter by DISPUTED; verify on-chain instead.
    fetchJobs({ limit: 50 }),
    fetchDisputes({ limit: 50 }),
  ]);

  const candidates = new Map<
    number,
    { onchainJobId: number; jobId?: string; title?: string }
  >();

  for (const job of jobsRes.jobs ?? []) {
    if (isValidOnchainJobId(job.onchainJobId)) {
      candidates.set(job.onchainJobId!, {
        onchainJobId: job.onchainJobId!,
        jobId: job._id,
        title: job.title,
      });
    }
  }

  for (const d of disputesRes.disputes ?? []) {
    if (!isValidOnchainJobId(d.onchainJobId)) continue;
    const existing = candidates.get(d.onchainJobId);
    candidates.set(d.onchainJobId, {
      onchainJobId: d.onchainJobId,
      jobId: d.jobId ?? existing?.jobId,
      title: existing?.title,
    });
  }

  const assigned: ArbitratorDisputeItem[] = [];
  const poolOnly: ArbitratorDisputeItem[] = [];
  const samplePanelWallets = new Set<string>();

  await Promise.all(
    [...candidates.values()].map(async (item) => {
      try {
        const onchainJob = await readOnchainJob(item.onchainJobId);
        if (onchainJob.status !== ONCHAIN_JOB_STATUS.DISPUTED) return;

        const dispute = await readOnchainDispute(BigInt(item.onchainJobId));
        if (dispute.createdAt === 0n || dispute.isResolved) return;

        const panelArbitrators = await readChosenArbitrators(item.onchainJobId);
        for (const a of panelArbitrators) samplePanelWallets.add(a);

        const entry: ArbitratorDisputeItem = {
          ...item,
          disputeStatus: 'DISPUTED',
          panelArbitrators,
        };

        if (isAssignedArbitrator(panelArbitrators, address)) {
          assigned.push(entry);
        } else if (inPool) {
          poolOnly.push(entry);
        }
      } catch {
        /* skip unreadable */
      }
    }),
  );

  assigned.sort((a, b) => b.onchainJobId - a.onchainJobId);
  poolOnly.sort((a, b) => b.onchainJobId - a.onchainJobId);

  return {
    assigned,
    poolOnly,
    samplePanelWallets: [...samplePanelWallets],
  };
}

export function useArbitratorDisputes(address?: string | null, inPool = false) {
  const [assignedDisputes, setAssignedDisputes] = useState<ArbitratorDisputeItem[]>([]);
  const [poolOnlyDisputes, setPoolOnlyDisputes] = useState<ArbitratorDisputeItem[]>([]);
  const [samplePanelWallets, setSamplePanelWallets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!address) {
      setAssignedDisputes([]);
      setPoolOnlyDisputes([]);
      setSamplePanelWallets([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await loadArbitratorDisputes(address, inPool);
      setAssignedDisputes(result.assigned);
      setPoolOnlyDisputes(result.poolOnly);
      setSamplePanelWallets(result.samplePanelWallets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách tranh chấp');
    } finally {
      setLoading(false);
    }
  }, [address, inPool]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    assignedDisputes,
    poolOnlyDisputes,
    samplePanelWallets,
    loading,
    error,
    reload,
  };
}
