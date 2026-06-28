import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '@/context/AuthContext';
import { useArbitratorAccess } from '@/hooks/useArbitratorAccess';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { API_URL } from '@/config/env';
import { fetchHealth } from '@/lib/api';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { hasChosenRegistrationRole } from '@/lib/utils/profile';
import { truncateAddress } from '@/lib/utils/address';
import { useReputation } from '@/hooks/useReputation';
import { ReputationBadge } from '@/components/shared/ReputationBadge';
import { FapexLogo } from '@/components/shared/FapexLogo';
import { NetworkBanner } from '@/components/shared/NetworkBanner';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { SocketStatusDot } from '@/components/shared/SocketStatusDot';
import type { RegistrationRole } from '@/lib/api';

type NavItem = {
  to: string;
  label: string;
  roles?: RegistrationRole[];
  arbitrator?: boolean;
  admin?: boolean;
  landingOnly?: boolean;
  appOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: '/browse', label: 'Browse' },
  { to: '/#how-it-works', label: 'How it works', landingOnly: true },
  { to: '/client', label: 'For clients', landingOnly: true },
  { to: '/freelancer', label: 'For freelancers', landingOnly: true },
  { to: '/client', label: 'Client', roles: ['client'], appOnly: true },
  { to: '/freelancer', label: 'Freelancer', roles: ['freelancer'], appOnly: true },
  { to: '/arbitrator', label: 'Arbitrator', arbitrator: true, appOnly: true },
  { to: '/admin', label: 'Admin', admin: true, appOnly: true },
  { to: '/profile', label: 'Profile' },
];

const isDev = import.meta.env.DEV;

export function AppShell() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { isConnected, isAuthenticated, user, loading, error, signIn, signOut } = useAuth();
  const arbitrator = useArbitratorAccess();
  const platformAdmin = useAdminAccess();
  const { reputation, loading: reputationLoading } = useReputation(user?.walletAddress);
  const [contractMismatch, setContractMismatch] = useState<string | null>(null);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then((health) => {
        const backendRegistry = health.contracts?.JobRegistry?.toLowerCase();
        const frontendRegistry = CONTRACT_ADDRESSES.JobRegistry.toLowerCase();
        if (backendRegistry && backendRegistry !== frontendRegistry) {
          setContractMismatch(
            `Backend JobRegistry (${health.contracts?.JobRegistry}) ≠ frontend (${CONTRACT_ADDRESSES.JobRegistry}). Update Railway env vars.`,
          );
        } else {
          setContractMismatch(null);
        }
      })
      .catch(() => setContractMismatch(null));
  }, []);

  const visibleNav = NAV.filter((item) => {
    if (isLanding && item.appOnly) return false;
    if (!isLanding && item.landingOnly) return false;
    if (item.arbitrator) return isAuthenticated && arbitrator.isValid;
    if (item.admin) return platformAdmin.isAdmin;
    if (!item.roles) return true;
    if (!isAuthenticated || !hasChosenRegistrationRole(user)) return false;
    return item.roles.includes(user?.role as RegistrationRole);
  });

  const handleSignOut = () => {
    setWalletMenuOpen(false);
    signOut(true);
  };

  return (
    <div className={isLanding ? 'app app-landing' : 'app'}>
      <NetworkBanner />
      <header className={`header header-compact${isLanding ? ' header-landing header-sticky' : ' header-sticky'}`}>
        <div className="header-row">
          <div className="brand">
            <FapexLogo size="md" />
            {isDev && !isLanding && <span className="api-badge dev-only">API: {API_URL}</span>}
          </div>
          <nav className="nav">
            {visibleNav.map((item) => (
              <NavLink
                key={`${item.to}-${item.label}`}
                to={item.to}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <SocketStatusDot />
            <ThemeToggle />
            <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
            {isConnected && !isAuthenticated && (
              <button className="btn primary btn-compact" onClick={signIn} disabled={loading} type="button">
                {loading ? 'Signing…' : 'Sign in'}
              </button>
            )}
            {isAuthenticated && (
              <div className="auth-status auth-status-compact">
                <ReputationBadge reputation={reputation} loading={reputationLoading} compact />
                <div className="wallet-menu">
                  <button
                    type="button"
                    className="wallet-chip"
                    onClick={() => setWalletMenuOpen((v) => !v)}
                    aria-expanded={walletMenuOpen}
                    title={user?.walletAddress ?? undefined}
                  >
                    {truncateAddress(user?.walletAddress)}
                  </button>
                  {walletMenuOpen && (
                    <div className="wallet-dropdown">
                      <p className="wallet-dropdown-label">Connected wallet</p>
                      <code className="mono wallet-full">{user?.walletAddress}</code>
                      {hasChosenRegistrationRole(user) && (
                        <span className="badge role-badge">{user?.role}</span>
                      )}
                      <span className="badge success">Authenticated</span>
                      <button className="btn ghost btn-compact" onClick={handleSignOut} type="button">
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {error && <p className="error banner">{error}</p>}
        {contractMismatch && isDev && <p className="error banner">{contractMismatch}</p>}
      </header>
      <Outlet />
    </div>
  );
}
