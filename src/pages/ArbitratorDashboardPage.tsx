import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchArbitratorStatus } from '@/lib/api';
import { useArbitratorAccess } from '@/hooks/useArbitratorAccess';

export function ArbitratorDashboardPage() {
  const { address, isAuthenticated } = useAuth();
  const stake = useArbitratorAccess();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stake.error) setError(stake.error);
  }, [stake.error]);

  return (
    <main className="page">
      <div className="page-header">
        <h2>Arbitrator console</h2>
        <p className="muted">
          Access is granted when your wallet has ≥ 50 USDC staked on PlatformTreasury (checked via{' '}
          <code>GET /api/arbitrator/:address/status</code>).
        </p>
      </div>

      {!isAuthenticated && <p className="muted">Connect wallet and sign in to view arbitrator status.</p>}

      {stake.loading && <p className="muted">Loading stake status…</p>}
      {error && <p className="error">{error}</p>}

      {stake.stakedAmount != null && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">Staked USDC</span>
            <strong>{stake.stakedAmount}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Min stake</span>
            <strong>{stake.minStake ?? 50}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Eligible to arbitrate</span>
            <strong>{stake.isValid ? 'Yes' : 'No'}</strong>
          </div>
        </div>
      )}

      {stake.message && <p className="muted">{stake.message}</p>}

      <section className="panel coming-soon-panel">
        <h3>Dispute queue</h3>
        <p className="muted">
          <code>GET /api/disputes</code> is not implemented yet. Disputed jobs will appear here once
          the backend indexes on-chain <code>DisputeRaised</code> events. You can still vote on
          active disputes via ArbitratorPanel when assigned.
        </p>

        <div className="panel" style={{ marginTop: '1rem', opacity: 0.85 }}>
          <h4>Vote on dispute (preview)</h4>
          <p className="muted phase-note">
            Commit-reveal voting: <code>commitVote(jobId, hash)</code> during the evidence window,
            then <code>revealVote(jobId, choice, salt)</code> after the commit phase. Choices: 1 =
            freelancer win, 2 = client win, 3 = split.
          </p>
          <div className="form-actions">
            <button className="btn ghost" type="button" disabled title="Requires active dispute assignment">
              Commit vote
            </button>
            <button className="btn ghost" type="button" disabled title="After commit window closes">
              Reveal vote
            </button>
            <button className="btn ghost" type="button" disabled title="After voting finalizes">
              Submit evidence (IPFS)
            </button>
          </div>
        </div>

        {address && (
          <button
            className="btn ghost"
            type="button"
            onClick={() => fetchArbitratorStatus(address).then(() => window.location.reload())}
          >
            Refresh stake status
          </button>
        )}
      </section>

      <p className="muted">
        Need access? Stake at least 50 USDC via <code>PlatformTreasury.stakeAsArbitrator</code> on
        Sepolia, then return here. See{' '}
        <Link to="/profile">Profile</Link> for your registration role (Client / Freelancer).
      </p>
    </main>
  );
}
