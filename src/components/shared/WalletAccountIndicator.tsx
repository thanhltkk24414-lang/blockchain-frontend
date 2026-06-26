import { useWalletAccountSync } from '@/hooks/useWalletAccountSync';

interface WalletAccountIndicatorProps {
  /** Show SIWE session line when authenticated. */
  showSiwe?: boolean;
  compact?: boolean;
}

/**
 * Shows RainbowKit (wagmi) vs MetaMask extension selected account.
 * "Trùng RainbowKit" = hai địa chỉ khớp nhau — cần thiết để eth_sendTransaction không bị -32602.
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
          <strong>RainbowKit</strong> (nút Connect Wallet):{' '}
          <code className="mono">{shortRainbow ?? '—'}</code>
          {rainbowKitAddress && (
            <span className="muted phase-note" title={rainbowKitAddress}>
              {' '}
              full: {rainbowKitAddress}
            </span>
          )}
        </p>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
          <strong>MetaMask active</strong> (account đang chọn trong extension):{' '}
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
            <strong>SIWE đăng nhập</strong>: <code className="mono">{shortSiwe}</code>
          </p>
        )}
      </div>

      {rainbowMismatch && (
        <p className="error" style={{ marginTop: '0.5rem' }}>
          Không trùng RainbowKit — MetaMask đang chọn account khác với ví Fapex đã Connect.
          Giao dịch on-chain dùng <strong>MetaMask active</strong>; chọn đúng account trong
          extension hoặc Disconnect → Connect lại trên Fapex.
        </p>
      )}

      {siweMismatch && !rainbowMismatch && (
        <p className="error" style={{ marginTop: '0.5rem' }}>
          SIWE khác MetaMask active — đăng nhập lại (Sign in) với ví MetaMask đang chọn trước khi
          tạo job.
        </p>
      )}

      {!rainbowMismatch && !siweMismatch && metaMaskActive && (
        <p className="muted phase-note" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
          Trùng RainbowKit — sẵn sàng ký giao dịch.
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
