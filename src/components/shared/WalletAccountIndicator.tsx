import { useWalletAccountSync } from '@/hooks/useWalletAccountSync';

interface WalletAccountIndicatorProps {
  /** Show SIWE session line when authenticated. */
  showSiwe?: boolean;
  compact?: boolean;
}

/**
 * Shows Fapex-connected (wagmi) vs MetaMask extension selected account.
 * Both addresses must match — otherwise eth_sendTransaction returns -32602.
 */
export function WalletAccountIndicator({ showSiwe = true, compact = false }: WalletAccountIndicatorProps) {
  const {
    rainbowKitAddress,
    metaMaskActive,
    rainbowMismatch,
    siweMismatch,
    siweWallet,
    shortRainbow,
    shortMetaMask,
    shortSiwe,
    refresh,
  } = useWalletAccountSync();

  if (!rainbowKitAddress && !metaMaskActive) return null;

  const statusClass = rainbowMismatch || siweMismatch ? 'wallet-mismatch-banner' : 'info';

  return (
    <section
      className={`panel wallet-account-indicator ${statusClass}`}
      role={rainbowMismatch || siweMismatch ? 'alert' : 'status'}
      style={compact ? { padding: '0.5rem 0.75rem', fontSize: '0.85rem' } : undefined}
    >
      <div className="wallet-account-lines">
        <p className="muted" style={{ margin: 0 }}>
          <strong>Fapex connected</strong> (MetaMask):{' '}
          <code className="mono">{shortRainbow ?? '—'}</code>
          {rainbowKitAddress && (
            <span className="muted phase-note" title={rainbowKitAddress}>
              {' '}
              full: {rainbowKitAddress}
            </span>
          )}
        </p>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
          <strong>MetaMask active</strong> (account selected in extension):{' '}
          <code className="mono">{shortMetaMask ?? '—'}</code>
          {metaMaskActive && (
            <span className="muted phase-note" title={metaMaskActive}>
              {' '}
              full: {metaMaskActive}
            </span>
          )}
        </p>
        {showSiwe && siweWallet && (
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            <strong>SIWE session</strong>: <code className="mono">{shortSiwe}</code>
          </p>
        )}
      </div>

      {rainbowMismatch && (
        <p className="error" style={{ marginTop: '0.5rem' }}>
          MetaMask is using a different account than the Fapex-connected wallet.
          On-chain transactions use <strong>MetaMask active</strong>; select the correct account in
          the extension or Disconnect → Connect again on Fapex.
        </p>
      )}

      {siweMismatch && !rainbowMismatch && (
        <p className="error" style={{ marginTop: '0.5rem' }}>
          SIWE session differs from MetaMask active — sign in again with the currently selected
          MetaMask wallet before creating a job.
        </p>
      )}

      {!rainbowMismatch && !siweMismatch && metaMaskActive && (
        <p className="muted phase-note" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
          Wallets match — ready to sign transactions.
        </p>
      )}

      <button
        type="button"
        className="btn ghost"
        style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
        onClick={() => void refresh()}
      >
        Refresh accounts
      </button>
    </section>
  );
}
