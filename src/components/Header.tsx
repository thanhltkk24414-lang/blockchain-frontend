import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/env';

export function Header() {
  const {
    isConnected,
    isAuthenticated,
    sessionWallet,
    connectedWallet,
    walletSessionNotice,
    loading,
    error,
    signIn,
    signOut,
  } = useAuth();

  return (
    <header className="header">
      <div className="brand">
        <h1>Fapex</h1>
        <span className="api-badge">API: {API_URL}</span>
      </div>
      <div className="header-actions">
        <ConnectButton />
        {isConnected && !isAuthenticated && (
          <button className="btn primary" onClick={signIn} disabled={loading}>
            {loading ? 'Signing…' : 'Sign in (SIWE)'}
          </button>
        )}
        {isAuthenticated && (
          <div className="auth-status">
            <span className="badge success">Authenticated</span>
            <span className="wallet" title="SIWE session wallet (API)">
              API: {sessionWallet}
            </span>
            {connectedWallet &&
              sessionWallet &&
              connectedWallet.toLowerCase() !== sessionWallet.toLowerCase() && (
                <span className="wallet muted" title="MetaMask connected wallet (on-chain txs)">
                  MetaMask: {connectedWallet}
                </span>
              )}
            <button className="btn ghost" onClick={() => signOut(true)} type="button">
              Sign out
            </button>
          </div>
        )}
      </div>
      {walletSessionNotice && <p className="muted banner info">{walletSessionNotice}</p>}
      {error && <p className="error banner">{error}</p>}
    </header>
  );
}
