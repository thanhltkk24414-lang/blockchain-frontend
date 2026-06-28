import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useAdminAccess } from '@/hooks/useAdminAccess';

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { isConnected } = useAccount();
  const admin = useAdminAccess();

  if (!isConnected) {
    return (
      <main className="page">
        <div className="page-header">
          <h2>Platform governance</h2>
          <p className="muted">
            Connect the deployer wallet or a delegated role holder on Sepolia to access admin tools.
          </p>
        </div>
        <section className="panel">
          <p className="muted">Use the Connect button in the header, then return to this page.</p>
          <Link to="/profile" className="btn ghost">
            Profile & sign-in
          </Link>
        </section>
      </main>
    );
  }

  if (admin.loading) {
    return (
      <main className="page">
        <p className="muted">Checking on-chain admin access…</p>
      </main>
    );
  }

  if (!admin.isAdmin) {
    return (
      <main className="page">
        <div className="page-header">
          <h2>Access denied</h2>
          <p className="muted">
            This console is visible only to EscrowVault/ArbitratorPanel admins, the Sepolia deployer,
            or wallets with delegated roles (pauser, force resolver, arbitrator manager).
          </p>
        </div>
        {admin.error && <p className="error">{admin.error}</p>}
        <section className="panel">
          <p className="muted">
            On-chain admin is set at deployment. Delegated roles can be granted via{' '}
            <code>scripts/grant-platform-roles.js</code> on Sepolia.
          </p>
          <Link to="/browse" className="btn ghost">
            Back to browse
          </Link>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
