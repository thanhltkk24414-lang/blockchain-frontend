import { useCallback, useState } from 'react';
import { useAccount } from 'wagmi';
import { useArbitratorAccess, clearArbitratorAccessCache } from '@/hooks/useArbitratorAccess';
import { useArbitratorStake, MIN_ARBITRATOR_STAKE_USDC } from '@/hooks/useArbitratorStake';
import { useMockUsdcMint, DEMO_MINT_USDC } from '@/hooks/useMockUsdcMint';
import { TxStatusModal } from '@/components/shared/TxStatusModal';

interface ArbitratorOnboardingPanelProps {
  onComplete?: () => void;
}

export function ArbitratorOnboardingPanel({ onComplete }: ArbitratorOnboardingPanelProps) {
  const { address, isConnected } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);
  const arbitrator = useArbitratorAccess(refreshKey);
  const { mint, minting, txStatus: mintTxStatus, txHash: mintTxHash, txError: mintTxError, resetTx: resetMintTx } =
    useMockUsdcMint();
  const {
    stake,
    joinPool,
    busy: stakeBusy,
    txStatus: stakeTxStatus,
    txHash: stakeTxHash,
    txLabel: stakeTxLabel,
    txError: stakeTxError,
    resetTx: resetStakeTx,
  } = useArbitratorStake();

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAccess = useCallback(() => {
    clearArbitratorAccessCache();
    setRefreshKey((k) => k + 1);
    onComplete?.();
  }, [onComplete]);

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

  const handleJoinPool = async () => {
    setError(null);
    setMessage(null);
    try {
      await joinPool();
      setMessage('Joined the arbitrator pool — you are eligible for sortition.');
      refreshAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join pool failed');
    }
  };

  if (!isConnected || !address) {
    return (
      <section className="panel form-panel arbitrator-onboarding">
        <h3>Become an arbitrator</h3>
        <p className="muted">Connect your wallet to mint test USDC, stake, and join the pool on Sepolia.</p>
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
  const needsPool = !arbitrator.inPool;

  return (
    <section className="panel form-panel arbitrator-onboarding">
      <h3>Become an arbitrator</h3>
      <p className="muted">
        Arbitrators resolve disputes with commit-reveal voting. Minimum stake:{' '}
        <strong>{MIN_ARBITRATOR_STAKE_USDC} USDC</strong> on PlatformTreasury, then join the pool.
        Requires sufficient on-chain reputation (ReputationStore score).
      </p>

      <ol className="onboarding-steps">
        <li className={needsStake ? 'step-active' : 'step-done'}>
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
        <li className={needsPool ? 'step-active' : 'step-done'}>
          <strong>Step 3 — Join arbitrator pool</strong>
          <p className="muted">
            Self-join after stake is confirmed. Pool must have ≥5 members for new disputes (run{' '}
            <code>npm run seed:arbitrators</code> if needed).
          </p>
          <button
            className="btn primary"
            type="button"
            onClick={handleJoinPool}
            disabled={stakeBusy || needsStake || !needsPool}
          >
            {stakeBusy ? 'Joining…' : 'Join pool'}
          </button>
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
