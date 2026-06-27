import { useCallback, useEffect, useState } from 'react';
import { readContract } from 'wagmi/actions';
import { getAddress } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { fetchUserReputation } from '@/lib/api';

const TIER_LABELS = ['Restricted', 'Warning', 'Normal', 'Trusted'] as const;

export type ReputationTier = (typeof TIER_LABELS)[number];

export type ReputationView = {
  score: number;
  tier: ReputationTier;
  source: 'chain' | 'api' | 'default';
};

function tierFromScore(score: number): ReputationTier {
  if (score >= 120) return 'Trusted';
  if (score >= 80) return 'Normal';
  if (score >= 50) return 'Warning';
  return 'Restricted';
}

async function readOnChainReputation(address: string): Promise<ReputationView | null> {
  try {
    const wallet = getAddress(address);
    const [scoreRaw, tierRaw] = await Promise.all([
      readContract(wagmiConfig, {
        ...contracts.reputationStore,
        functionName: 'getScore',
        args: [wallet],
      }) as Promise<bigint>,
      readContract(wagmiConfig, {
        ...contracts.reputationStore,
        functionName: 'getTier',
        args: [wallet],
      }) as Promise<number>,
    ]);
    const score = Number(scoreRaw);
    const tier = TIER_LABELS[Number(tierRaw)] ?? tierFromScore(score);
    return { score, tier, source: 'chain' };
  } catch {
    return null;
  }
}

export function useReputation(address?: string | null) {
  const [reputation, setReputation] = useState<ReputationView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setReputation(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const onChain = await readOnChainReputation(address);
      if (onChain) {
        setReputation(onChain);
        return;
      }

      const apiRes = await fetchUserReputation(address).catch(() => null);
      if (apiRes?.success && apiRes.reputation?.score != null) {
        const score = apiRes.reputation.score;
        setReputation({
          score,
          tier: (apiRes.reputation.tier as ReputationTier) || tierFromScore(score),
          source: 'api',
        });
        return;
      }

      setReputation({ score: 100, tier: 'Normal', source: 'default' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reputation');
      setReputation({ score: 100, tier: 'Normal', source: 'default' });
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { reputation, loading, error, refresh };
}

export function tierBadgeClass(tier: ReputationTier): string {
  switch (tier) {
    case 'Trusted':
      return 'reputation-tier trusted';
    case 'Normal':
      return 'reputation-tier normal';
    case 'Warning':
      return 'reputation-tier warning';
    default:
      return 'reputation-tier restricted';
  }
}
