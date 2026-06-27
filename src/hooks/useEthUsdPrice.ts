import { useCallback, useEffect, useState } from 'react';
import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '@/config/wagmi';
import { CHAIN_ID } from '@/lib/contracts/addresses';
import { AGGREGATOR_V3_ABI, SEPOLIA_ETH_USD_FEED } from '@/lib/chainlink/priceFeeds';

export type EthUsdPrice = {
  usd: number;
  updatedAt: number;
  source: 'chainlink';
};

const REFRESH_MS = 60_000;

export function useEthUsdPrice() {
  const [price, setPrice] = useState<EthUsdPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [, answer, , updatedAt] = (await readContract(wagmiConfig, {
        address: SEPOLIA_ETH_USD_FEED,
        abi: AGGREGATOR_V3_ABI,
        functionName: 'latestRoundData',
        chainId: CHAIN_ID as 11155111,
      })) as [bigint, bigint, bigint, bigint, bigint];

      const usd = Number(answer) / 1e8;
      if (!Number.isFinite(usd) || usd <= 0) {
        throw new Error('Invalid Chainlink answer');
      }

      setPrice({ usd, updatedAt: Number(updatedAt), source: 'chainlink' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ETH/USD');
      setPrice(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { price, loading, error, refresh };
}

/** Format gas units with optional USD estimate (Sepolia ETH). */
export function formatGasWithUsd(gas: bigint, ethUsd?: number | null): string {
  const gwei = Number(gas) / 1e9;
  const gasEth = Number(gas) / 1e18;
  const base = `~${gas.toLocaleString()} gas (${gwei.toFixed(1)} gwei est.)`;
  if (ethUsd && gasEth > 0) {
    const usd = gasEth * ethUsd;
    return `${base} · ≈$${usd.toFixed(4)} @ $${ethUsd.toFixed(0)} ETH`;
  }
  return base;
}
