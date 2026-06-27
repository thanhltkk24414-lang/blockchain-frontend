import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useArbitratorAccess } from '@/hooks/useArbitratorAccess';
import {
  shortWallet,
  useArbitratorDisputes,
  type ArbitratorDisputeItem,
} from '@/hooks/useArbitratorDisputes';
import { isAssignedArbitrator } from '@/hooks/useDisputeActions';
import { DISPUTE_PHASES, formatAppealWindow } from '@/lib/contracts/disputeTimings';

function DisputeList({
  items,
  note,
}: {
  items: ArbitratorDisputeItem[];
  note?: string;
}) {
  if (items.length === 0) return null;

  return (
    <>
      {note && <p className="muted phase-note">{note}</p>}
      <ul className="bids-list">
        {items.map((d) => (
          <li key={d.onchainJobId} className="bid-item">
            <strong>
              On-chain job #{d.onchainJobId}
              {d.title ? ` — ${d.title}` : ''}
            </strong>
            <span className="muted"> · {d.disputeStatus}</span>
            {d.jobId ? (
              <Link to={`/jobs/${d.jobId}`} className="btn primary">
                Open details & vote →
              </Link>
            ) : (
              <span className="muted">Off-chain jobId not synced yet</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function ArbitratorDashboardPage() {
  const { address, isAuthenticated } = useAuth();
  const stake = useArbitratorAccess();
  const {
    assignedDisputes,
    poolOnlyDisputes,
    samplePanelWallets,
    loading,
    error,
    reload,
  } = useArbitratorDisputes(address, stake.inPool);

  const displayError = error ?? stake.error;

  const hintArbitratorWallet =
    samplePanelWallets.find((w) => !isAssignedArbitrator([w], address)) ??
    samplePanelWallets[0] ??
    '0x59a1E706254fcE3152feeE8D95Ecf74f1f30040e';

  return (
    <main className="page">
      <div className="page-header">
        <h2>Arbitrator dashboard</h2>
        <p className="muted">
          Requires ≥50 USDC stake on PlatformTreasury. When sortition selects you for a panel, commit-reveal
          vote on the job detail page.
        </p>
      </div>

      {!isAuthenticated && (
        <p className="muted">Connect MetaMask and sign in with SIWE to see assigned disputes.</p>
      )}

      {stake.loading && <p className="muted">Checking stake…</p>}
      {displayError && <p className="error">{displayError}</p>}

      {stake.stakedAmount != null && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">USDC staked</span>
            <strong>{stake.stakedAmount}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Minimum stake</span>
            <strong>{stake.minStake ?? 50}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Pool eligible</span>
            <strong>{stake.isValid ? 'Yes' : 'No'}</strong>
          </div>
        </div>
      )}

      {stake.message && <p className="muted phase-note">{stake.message}</p>}

      <section className="panel">
        <div className="panel-header-row">
          <h3>Disputes assigned to you</h3>
          <button
            className="btn ghost"
            type="button"
            onClick={() => void reload()}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <p className="muted phase-note">
          Sepolia demo: evidence 0–{DISPUTE_PHASES.evidenceRebuttalEndMin}m → commit{' '}
          {DISPUTE_PHASES.commitStartMin}–{DISPUTE_PHASES.commitEndMin}m → reveal{' '}
          {DISPUTE_PHASES.revealStartMin}–{DISPUTE_PHASES.revealEndMin}m → finalize after{' '}
          {DISPUTE_PHASES.revealEndMin}m → appeal {formatAppealWindow()}.
        </p>

        {!address && <p className="muted">Wallet not connected.</p>}

        {address && !loading && assignedDisputes.length === 0 && (
          <div className="muted phase-note">
            <p>
              Using wallet <code>{shortWallet(address)}</code>
              {stake.inPool ? ' (in arbitrator pool)' : ''} —{' '}
              {samplePanelWallets.length > 0
                ? 'not on the panel for any active disputed jobs.'
                : 'no DISPUTED on-chain jobs found in scan range.'}
            </p>
            {samplePanelWallets.length > 0 && (
              <p>
                Switch to a selected arbitrator wallet (e.g.{' '}
                <code>{shortWallet(hintArbitratorWallet)}</code>) — import a private key from{' '}
                <code>deployments/sepolia-arbitrators.json</code>.
              </p>
            )}
            {samplePanelWallets.length === 0 && (
              <p>
                Run <code>seed-arbitrator-pool.js</code> and raise a dispute on a SUBMITTED job first.
              </p>
            )}
          </div>
        )}

        <DisputeList items={assignedDisputes} />

        {poolOnlyDisputes.length > 0 && (
          <>
            <h4>Other disputes (in pool, not selected)</h4>
            <DisputeList
              items={poolOnlyDisputes}
              note="You are in the pool but sortition did not select this wallet for these jobs — view only, no vote."
            />
          </>
        )}
      </section>

      <section className="panel">
        <h3>Quick test guide</h3>
        <ol className="muted phase-note">
          <li>
            Import one wallet from <code>deployments/sepolia-arbitrators.json</code> into MetaMask (Sepolia).
          </li>
          <li>Stake ≥50 USDC + join pool (Profile page or scripts).</li>
          <li>Client raises dispute on a job → 5 arbitrators are selected at random.</li>
          <li>Open DISPUTED job → Arbitrator panel → commit / reveal on the phase timer.</li>
        </ol>
        <p className="muted">
          Stake and mint at <Link to="/profile">Profile</Link>.
        </p>
      </section>
    </main>
  );
}
