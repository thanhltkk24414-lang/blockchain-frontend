import { Link, NavLink, Outlet } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';

const NAV = [
  { to: '/browse', label: 'Browse' },
  { to: '/client', label: 'Client' },
  { to: '/freelancer', label: 'Freelancer' },
  { to: '/arbitrator', label: 'Arbitrator' },
  { to: '/profile', label: 'Profile' },
];

export function AppShell() {
  const { isConnected, isAuthenticated, user, loading, error, signIn, signOut } = useAuth();

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <Link to="/" className="brand-link">
            <h1>Fapex</h1>
          </Link>
          <span className="api-badge">API: {API_URL}</span>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <ConnectButton />
          {isConnected && !isAuthenticated && (
            <button className="btn primary" onClick={signIn} disabled={loading} type="button">
              {loading ? 'Signing…' : 'Sign in (SIWE)'}
            </button>
          )}
          {isAuthenticated && (
            <div className="auth-status">
              <span className="badge success">Authenticated</span>
              <span className="wallet">{user?.walletAddress}</span>
              <button className="btn ghost" onClick={signOut} type="button">
                Sign out
              </button>
            </div>
          )}
        </div>
        {error && <p className="error banner">{error}</p>}
      </header>
      <Outlet />
    </div>
  );
}
