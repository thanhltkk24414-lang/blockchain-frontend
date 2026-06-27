import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '@/context/AuthContext';
import { useArbitratorAccess } from '@/hooks/useArbitratorAccess';
import { useEthUsdPrice } from '@/hooks/useEthUsdPrice';
import { API_URL } from '@/config/env';
import { fetchHealth } from '@/lib/api';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { hasChosenRegistrationRole } from '@/lib/utils/profile';
import { useReputation } from '@/hooks/useReputation';
import { ReputationBadge } from '@/components/shared/ReputationBadge';
import { FapexLogo } from '@/components/shared/FapexLogo';
import { NetworkBanner } from '@/components/shared/NetworkBanner';
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
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { isConnected, isAuthenticated, user, loading, error, signIn, signOut } = useAuth();
  const arbitrator = useArbitratorAccess();
  const { reputation, loading: reputationLoading } = useReputation(user?.walletAddress);
  const { price: ethUsd } = useEthUsdPrice();
  const [contractMismatch, setContractMismatch] = useState<string | null>(null);

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
    if (item.arbitrator) return isAuthenticated && arbitrator.isValid;
    if (!item.roles) return true;
    if (!isAuthenticated || !hasChosenRegistrationRole(user)) return false;
    return item.roles.includes(user?.role as RegistrationRole);
  });

  const handleSignOut = () => {
    signOut(true);
  };

  return (
    <div className={isLanding ? 'app app-landing' : 'app'}>
      <NetworkBanner />
      <header className={`header${isLanding ? ' header-landing header-sticky' : ' header-sticky'}`}>
        <div className="brand">
          <FapexLogo size="md" />
          {!isLanding && <span className="api-badge">API: {API_URL}</span>}
          {ethUsd && !isLanding && (
            <span className="api-badge eth-badge" title="Chainlink ETH/USD">
              ETH ${ethUsd.usd.toFixed(0)}
            </span>
          )}
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
              {hasChosenRegistrationRole(user) && (
                <span className="badge role-badge">{user.role}</span>
              )}
              <ReputationBadge reputation={reputation} loading={reputationLoading} compact />
              <span className="wallet" title="SIWE session wallet">
                {user?.walletAddress}
              </span>
              <button className="btn ghost" onClick={handleSignOut} type="button">
                Sign out
              </button>
            </div>
          )}
        </div>
        {error && <p className="error banner">{error}</p>}
        {contractMismatch && <p className="error banner">{contractMismatch}</p>}
      </header>
      <Outlet />
    </div>
  );
}
