import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useArbitratorAccess } from '@/hooks/useArbitratorAccess';
import {
  shortWallet,
  useArbitratorDisputes,
  type ArbitratorDisputeItem,
} from '@/hooks/useArbitratorDisputes';
import { isAssignedArbitrator } from '@/hooks/useDisputeActions';
import { DISPUTE_PHASES, formatAppealWindow } from '@/lib/contracts/disputeTimings';
import { formatCountdown } from '@/lib/utils/disputePhase';

const DISPUTE_STEPS = [
  { key: 'evidence', label: 'Evidence', endMin: DISPUTE_PHASES.evidenceRebuttalEndMin },
  { key: 'commit', label: 'Commit', endMin: DISPUTE_PHASES.commitEndMin },
  { key: 'reveal', label: 'Reveal', endMin: DISPUTE_PHASES.revealEndMin },
  { key: 'finalize', label: 'Finalize', endMin: DISPUTE_PHASES.revealEndMin },
  { key: 'appeal', label: 'Appeal', endMin: DISPUTE_PHASES.revealEndMin + DISPUTE_PHASES.appealWindowMin },
] as const;

function DisputePhaseStepper() {
  return (
    <div className="dispute-stepper" aria-label="Dispute timeline">
      {DISPUTE_STEPS.map((step, i) => (
        <div key={step.key} className="dispute-step">
          <span className="dispute-step-num">{i + 1}</span>
          <span className="dispute-step-label">{step.label}</span>
          <span className="dispute-step-time">≤{step.endMin}m</span>
        </div>
      ))}
    </div>
  );
}

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
  const [searchParams] = useSearchParams();
  const showDebugGuide = searchParams.get('debug') === 'true';
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
  const minStake = stake.minStake ?? 50;
  const staked = stake.stakedAmount ?? 0;
  const stakePct = Math.min(100, Math.round((staked / minStake) * 100));
  const stakeEligible = stake.isValid;

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
          <div className="stat-card stat-card-wide">
            <span className="stat-label">Stake progress ({staked} / {minStake} USDC)</span>
            <div className="stake-progress-track" role="progressbar" aria-valuenow={stakePct} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`stake-progress-fill${stakeEligible ? ' stake-eligible' : ' stake-insufficient'}`}
                style={{ width: `${stakePct}%` }}
              />
            </div>
            <p className={`stake-status${stakeEligible ? ' success' : ' error'}`}>
              {stakeEligible ? 'Eligible for arbitrator pool' : `Need ${Math.max(0, minStake - staked)} more USDC`}
            </p>
          </div>
          <div className="stat-card">
            <span className="stat-label">Pool member</span>
            <strong>{stake.inPool ? 'Yes' : 'No'}</strong>
          </div>
        </div>
      )}

      {stake.message && <p className="muted phase-note">{stake.message}</p>}

      <section className="panel">
        <h3>Dispute phases</h3>
        <DisputePhaseStepper />
        <p className="muted phase-note">
          Sepolia demo windows: evidence 0–{DISPUTE_PHASES.evidenceRebuttalEndMin}m → commit{' '}
          {DISPUTE_PHASES.commitStartMin}–{DISPUTE_PHASES.commitEndMin}m → reveal{' '}
          {DISPUTE_PHASES.revealStartMin}–{DISPUTE_PHASES.revealEndMin}m → appeal {formatAppealWindow()}.
          Countdown on job detail when a dispute is active.
        </p>
        <p className="badge countdown">Phase timer example: {formatCountdown(8 * 60 + 42)}</p>
      </section>

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

        {!address && <p className="muted">Wallet not connected.</p>}

        {address && !loading && assignedDisputes.length === 0 && (
          <div className="empty-state arbitrator-empty">
            <h3>No disputes assigned yet</h3>
            <p className="muted">
              When sortition selects your wallet for an active dispute, it will appear here with a link to
              vote on the job detail page.
            </p>
            {samplePanelWallets.length > 0 && (
              <p className="muted phase-note">
                Using <code>{shortWallet(address)}</code>
                {stake.inPool ? ' (in pool)' : ''} — not on a panel for current disputes. Demo wallets
                include <code>{shortWallet(hintArbitratorWallet)}</code>.
              </p>
            )}
            {samplePanelWallets.length === 0 && (
              <p className="muted phase-note">
                No active on-chain disputes found. Raise a dispute on a submitted job to begin.
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

      {showDebugGuide && (
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
      )}
    </main>
  );
}
