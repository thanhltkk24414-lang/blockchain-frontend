import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAuth } from '@/context/AuthContext';
import { useArbitratorAccess, clearArbitratorAccessCache } from '@/hooks/useArbitratorAccess';
import { useArbitratorStake, MIN_ARBITRATOR_STAKE_USDC } from '@/hooks/useArbitratorStake';
import { useMockUsdcMint, DEMO_MINT_USDC } from '@/hooks/useMockUsdcMint';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import {
  fetchMyArbitratorApplication,
  submitArbitratorApplication,
  type ArbitratorApplication,
} from '@/lib/api/client';

const MIN_REASON_LENGTH = 20;

interface ArbitratorOnboardingPanelProps {
  onComplete?: () => void;
}

export function ArbitratorOnboardingPanel({ onComplete }: ArbitratorOnboardingPanelProps) {
  const { address, isConnected } = useAccount();
  const { isAuthenticated, signIn, loading: authLoading } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const arbitrator = useArbitratorAccess(refreshKey);
  const { mint, minting, txStatus: mintTxStatus, txHash: mintTxHash, txError: mintTxError, resetTx: resetMintTx } =
    useMockUsdcMint();
  const {
    stake,
    busy: stakeBusy,
    txStatus: stakeTxStatus,
    txHash: stakeTxHash,
    txLabel: stakeTxLabel,
    txError: stakeTxError,
    resetTx: resetStakeTx,
  } = useArbitratorStake();

  const [application, setApplication] = useState<ArbitratorApplication | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [applyBusy, setApplyBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAccess = useCallback(() => {
    clearArbitratorAccessCache();
    setRefreshKey((k) => k + 1);
    onComplete?.();
  }, [onComplete]);

  const loadApplication = useCallback(async () => {
    if (!isAuthenticated) {
      setApplication(null);
      return;
    }
    setApplicationLoading(true);
    try {
      const res = await fetchMyArbitratorApplication();
      if (res.success) setApplication(res.application);
    } catch {
      setApplication(null);
    } finally {
      setApplicationLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadApplication();
  }, [loadApplication, refreshKey]);

  const handleMint = async () => {
    setError(null);
    setMessage(null);
    try {
      await mint(DEMO_MINT_USDC);
      setMessage(`Minted ${DEMO_MINT_USDC} MockUSDC to your wallet.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mint failed');
    }
  };

  const handleStake = async () => {
    setError(null);
    setMessage(null);
    try {
      await stake(MIN_ARBITRATOR_STAKE_USDC);
      setMessage(`Staked ${MIN_ARBITRATOR_STAKE_USDC} USDC via PlatformTreasury.`);
      refreshAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stake failed');
    }
  };

  const handleApply = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      setError(`Reason must be at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }
    setApplyBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await submitArbitratorApplication(trimmed);
      if (res.success && res.application) {
        setApplication(res.application);
        setMessage('Application submitted — an admin will review and add you to the pool on-chain.');
        setReason('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application failed');
    } finally {
      setApplyBusy(false);
    }
  };

  if (!isConnected || !address) {
    return (
      <section className="panel form-panel arbitrator-onboarding">
        <h3>Become an arbitrator</h3>
        <p className="muted">Connect your wallet to mint test USDC, stake, and apply to the pool on Sepolia.</p>
      </section>
    );
  }

  if (arbitrator.loading) {
    return (
      <section className="panel form-panel arbitrator-onboarding">
        <h3>Become an arbitrator</h3>
        <p className="muted">Reading on-chain stake and pool status…</p>
      </section>
    );
  }

  if (arbitrator.isValid && arbitrator.inPool) {
    return (
      <section className="panel form-panel arbitrator-onboarding">
        <h3>Arbitrator access</h3>
        <p className="badge success">
          Eligible — {arbitrator.stakedAmount} USDC staked, in pool. Open the{' '}
          <a href="/arbitrator">Arbitrator console</a> when assigned to a dispute.
        </p>
      </section>
    );
  }

  const staked = arbitrator.stakedAmount ?? 0;
  const needsStake = staked < MIN_ARBITRATOR_STAKE_USDC;
  const canApply = !needsStake && isAuthenticated && application?.status !== 'pending';

  return (
    <section className="panel form-panel arbitrator-onboarding">
      <h3>Become an arbitrator</h3>
      <p className="muted">
        Arbitrators resolve disputes with commit-reveal voting. Stake{' '}
        <strong>{MIN_ARBITRATOR_STAKE_USDC} USDC</strong> on PlatformTreasury, then submit an application
        with your motivation. An admin approves applications by calling <code>joinPool</code> on-chain.
      </p>

      {application?.status === 'pending' && (
        <p className="badge warning">
          Application pending review — submitted{' '}
          {application.createdAt ? new Date(application.createdAt).toLocaleString() : 'recently'}.
        </p>
      )}
      {application?.status === 'rejected' && (
        <p className="error banner">
          Previous application was rejected. You may submit a new application after updating your stake or
          motivation.
        </p>
      )}
      {application?.status === 'approved' && !arbitrator.inPool && (
        <p className="badge success">
          Application approved — waiting for on-chain pool join. Refresh if you were just added.
        </p>
      )}

      <ol className="onboarding-steps">
        <li className={needsStake ? 'step-active' : 'step-done'}>
          <span className="step-num" aria-hidden>
            <span>1</span>
          </span>
          <strong>Step 1 — Mint MockUSDC</strong>
          <p className="muted">
            Sepolia test token for escrow fees and arbitrator stake. Mint {DEMO_MINT_USDC} USDC to your
            wallet.
          </p>
          <button className="btn ghost" type="button" onClick={handleMint} disabled={minting}>
            {minting ? 'Minting…' : `Mint ${DEMO_MINT_USDC} MockUSDC`}
          </button>
        </li>
        <li className={needsStake ? 'step-active' : 'step-done'}>
          <span className="step-num" aria-hidden>
            <span>2</span>
          </span>
          <strong>Step 2 — Stake via PlatformTreasury</strong>
          <p className="muted">
            Current stake: {staked} / {MIN_ARBITRATOR_STAKE_USDC} USDC. Approves and locks stake on-chain.
          </p>
          <button
            className="btn primary"
            type="button"
            onClick={handleStake}
            disabled={stakeBusy || !needsStake}
          >
            {stakeBusy ? 'Staking…' : `Stake ${MIN_ARBITRATOR_STAKE_USDC} USDC`}
          </button>
        </li>
        <li className={canApply ? 'step-active' : application?.status === 'pending' ? 'step-done' : ''}>
          <span className="step-num" aria-hidden>
            <span>3</span>
          </span>
          <strong>Step 3 — Apply to arbitrator pool</strong>
          <p className="muted">
            Explain why you want to join (min {MIN_REASON_LENGTH} characters). Self-join is disabled — an
            admin reviews applications and calls <code>joinPool</code> for approved wallets.
          </p>
          {!isAuthenticated ? (
            <button className="btn primary" type="button" onClick={signIn} disabled={authLoading}>
              {authLoading ? 'Signing…' : 'Sign in (SIWE) to apply'}
            </button>
          ) : (
            <>
              <label className="field">
                Reason / motivation
                <textarea
                  className="input textarea"
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe your background, dispute-resolution experience, and why you want to arbitrate on FAPEX…"
                  disabled={application?.status === 'pending' || applyBusy}
                />
              </label>
              <button
                className="btn primary"
                type="button"
                onClick={handleApply}
                disabled={
                  applyBusy ||
                  needsStake ||
                  application?.status === 'pending' ||
                  reason.trim().length < MIN_REASON_LENGTH
                }
              >
                {applyBusy ? 'Submitting…' : 'Apply to arbitrator pool'}
              </button>
            </>
          )}
          {applicationLoading && <p className="muted phase-note">Loading application status…</p>}
        </li>
      </ol>

      {message && <p className="badge success">{message}</p>}
      {error && <p className="error">{error}</p>}
      {arbitrator.error && <p className="error">{arbitrator.error}</p>}

      <TxStatusModal
        open={mintTxStatus !== 'idle'}
        status={mintTxStatus}
        label="Minting MockUSDC…"
        hash={mintTxHash}
        error={mintTxError}
        onClose={resetMintTx}
      />
      <TxStatusModal
        open={stakeTxStatus !== 'idle'}
        status={stakeTxStatus}
        label={stakeTxLabel}
        hash={stakeTxHash}
        error={stakeTxError}
        onClose={resetStakeTx}
      />
    </section>
  );
}
