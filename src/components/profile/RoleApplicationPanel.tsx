import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchMyRoleApplications,
  submitRoleApplication,
  type DelegatedRole,
  type RoleApplication,
} from '@/lib/api/client';

const MIN_REASON_LENGTH = 20;

const ROLE_OPTIONS: Array<{ value: DelegatedRole; label: string; description: string }> = [
  {
    value: 'pauser',
    label: 'Pauser',
    description: 'Emergency pause/unpause EscrowVault (ROLE_PAUSER).',
  },
  {
    value: 'force_resolver',
    label: 'Force resolver',
    description: 'Resolve disputes when arbitrator quorum fails (ROLE_FORCE_RESOLVER).',
  },
  {
    value: 'arbitrator_manager',
    label: 'Arbitrator manager',
    description: 'Join arbitrators to the pool on behalf of others (ROLE_ARBITRATOR_MANAGER).',
  },
];

function statusBadge(status: RoleApplication['status']) {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'error';
  return 'warning';
}

export function RoleApplicationPanel() {
  const { isAuthenticated, signIn, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<RoleApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [desiredRole, setDesiredRole] = useState<DelegatedRole>('pauser');
  const [reason, setReason] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    if (!isAuthenticated) {
      setApplications([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchMyRoleApplications();
      if (res.success) setApplications(res.applications);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);
    if (!isAuthenticated) {
      setError('Sign in (SIWE) before applying.');
      return;
    }
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError(`Reason must be at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }

    setSubmitBusy(true);
    try {
      const res = await submitRoleApplication({ desiredRole, reason: reason.trim() });
      if (!res.success) throw new Error(res.error || 'Application failed');
      setMessage('Application submitted — an admin will review it on /admin.');
      setReason('');
      await loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application failed');
    } finally {
      setSubmitBusy(false);
    }
  };

  const pendingForRole = (role: DelegatedRole) =>
    applications.find((app) => app.desiredRole === role && app.status === 'pending');

  return (
    <section className="panel">
      <h3>Apply for delegated role</h3>
      <p className="muted phase-note">
        Request on-chain governance roles (pauser, force resolver, arbitrator manager). This is
        separate from the arbitrator pool application above. An admin grants roles via{' '}
        <code>grantRole</code> after review.
      </p>

      {!isAuthenticated && (
        <p className="muted">
          <button type="button" className="btn primary" disabled={authLoading} onClick={() => signIn()}>
            Sign in to apply
          </button>
        </p>
      )}

      {isAuthenticated && (
        <>
          <label className="field">
            Desired role
            <select
              className="input full"
              value={desiredRole}
              onChange={(e) => setDesiredRole(e.target.value as DelegatedRole)}
              disabled={submitBusy || Boolean(pendingForRole(desiredRole))}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <p className="muted phase-note">
            {ROLE_OPTIONS.find((o) => o.value === desiredRole)?.description}
          </p>

          <label className="field">
            Reason / motivation
            <textarea
              className="input full"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitBusy || Boolean(pendingForRole(desiredRole))}
              placeholder="Why should this wallet receive the delegated role? (min 20 characters)"
            />
          </label>

          {pendingForRole(desiredRole) ? (
            <p className="badge warning">You already have a pending application for this role.</p>
          ) : (
            <button
              type="button"
              className="btn primary"
              disabled={submitBusy || reason.trim().length < MIN_REASON_LENGTH}
              onClick={() => void handleSubmit()}
            >
              Submit application
            </button>
          )}
        </>
      )}

      {loading && <p className="muted">Loading your applications…</p>}
      {applications.length > 0 && (
        <ul className="role-application-list">
          {applications.slice(0, 5).map((app) => (
            <li key={app._id}>
              <span className={`badge ${statusBadge(app.status)}`}>{app.status}</span>{' '}
              <strong>{app.desiredRole.replace(/_/g, ' ')}</strong>
              {app.createdAt && (
                <span className="muted"> · {new Date(app.createdAt).toLocaleDateString()}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {message && <p className="badge success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
