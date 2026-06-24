import { Link, NavLink, Outlet } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '@/context/AuthContext';
import { useArbitratorAccess } from '@/hooks/useArbitratorAccess';
import { API_URL } from '@/config/env';
import type { RegistrationRole } from '@/lib/api';

type NavItem = { to: string; label: string; roles?: RegistrationRole[]; arbitrator?: boolean };

const NAV: NavItem[] = [
  { to: '/browse', label: 'Browse' },
  { to: '/client', label: 'Client', roles: ['client'] },
  { to: '/freelancer', label: 'Freelancer', roles: ['freelancer'] },
  { to: '/arbitrator', label: 'Arbitrator', arbitrator: true },
  { to: '/profile', label: 'Profile' },
];

export function AppShell() {
  const { isConnected, isAuthenticated, user, loading, error, signIn, signOut } = useAuth();
  const arbitrator = useArbitratorAccess();

  const visibleNav = NAV.filter((item) => {
    if (item.arbitrator) return isAuthenticated && arbitrator.isValid;
    if (!item.roles) return true;
    if (!isAuthenticated) return false;
    return item.roles.includes(user?.role as RegistrationRole);
  });

  const handleSignOut = () => {
    signOut(true);
  };

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
          {visibleNav.map((item) => (
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
              {user?.role && <span className="badge role-badge">{user.role}</span>}
              <span className="wallet">{user?.walletAddress}</span>
              <button className="btn ghost" onClick={handleSignOut} type="button">
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
