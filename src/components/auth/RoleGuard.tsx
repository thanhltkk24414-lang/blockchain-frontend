import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useArbitratorAccess } from '@/hooks/useArbitratorAccess';

import { hasChosenRegistrationRole } from '@/lib/utils/profile';
type RegistrationRole = 'client' | 'freelancer';

interface RoleGuardProps {
  children: ReactNode;
  requireRole?: RegistrationRole;
  requireArbitrator?: boolean;
  requireAuth?: boolean;
}

export function RoleGuard({
  children,
  requireRole,
  requireArbitrator = false,
  requireAuth = true,
}: RoleGuardProps) {
  const { isAuthenticated, user } = useAuth();
  const arbitrator = useArbitratorAccess();
  const location = useLocation();

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/profile" replace state={{ from: location.pathname }} />;
  }

  if (requireRole && !hasChosenRegistrationRole(user)) {
    return <Navigate to="/profile" replace state={{ from: location.pathname, needRole: requireRole }} />;
  }

  if (requireRole && user?.role !== requireRole) {
    return <Navigate to="/profile" replace state={{ from: location.pathname, needRole: requireRole }} />;
  }

  if (requireArbitrator) {
    if (arbitrator.loading) {
      return (
        <main className="page">
          <p className="muted">Checking arbitrator stake…</p>
        </main>
      );
    }
    if (!arbitrator.isValid) {
      return <Navigate to="/profile" replace state={{ from: location.pathname, needArbitratorStake: true }} />;
    }
  }

  return <>{children}</>;
}
