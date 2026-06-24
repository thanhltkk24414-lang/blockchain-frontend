import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchArbitratorStatus } from '@/lib/api';

export function ArbitratorDashboardPage() {
  const { address, isAuthenticated } = useAuth();
  const [stakeStatus, setStakeStatus] = useState<{
    stakedAmount?: number;
    minStake?: number;
    isValid?: boolean;
    message?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);

    fetchArbitratorStatus(address)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setStakeStatus({
            stakedAmount: res.stakedAmount,
            minStake: res.minStake,
            isValid: res.isValid,
            message: res.message,
          });
        } else setError('Failed to load arbitrator status');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load status');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <main className="page">
      <div className="page-header">
        <h2>Arbitrator console</h2>
        <p className="muted">Dispute queue, evidence review, and on-chain voting — Phase 3.</p>
      </div>
      {!isAuthenticated && <p className="muted">Connect wallet and sign in to view arbitrator status.</p>}
      {loading && <p className="muted">Loading stake status…</p>}
      {error && <p className="error">{error}</p>}
      {stakeStatus != null && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">Staked USDC</span>
            <strong>{stakeStatus.stakedAmount ?? '—'}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Min stake</span>
            <strong>{stakeStatus.minStake ?? '—'}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Eligible</span>
            <strong>{stakeStatus.isValid ? 'Yes' : 'No'}</strong>
          </div>
        </div>
      )}
      {stakeStatus?.message && <p className="muted">{stakeStatus.message}</p>}
      <p className="muted phase-note">
        Dispute list API returns placeholders today — wire to backend when disputeController is implemented.
      </p>
    </main>
  );
}
