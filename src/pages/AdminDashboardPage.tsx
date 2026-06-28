import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { getAddress, isAddress, type Abi } from 'viem';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useContractTx } from '@/hooks/useContractTx';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { CONTRACT_ADDRESSES, DEPLOYER_ADDRESS } from '@/lib/contracts/addresses';
import { contracts } from '@/lib/contracts/config';
import { wagmiConfig } from '@/config/wagmi';
import { truncateAddress } from '@/lib/utils/address';
import { VOTE_CHOICES, formatDisputeChoice } from '@/lib/utils/disputeChoice';
import { fetchAdminStats, type AdminStats } from '@/lib/api/client';
import {
  sendAdminForceResolveTx,
  sendGrantEscrowRoleTx,
  sendGrantPanelRoleTx,
  sendJoinPoolAdminTx,
  sendRevokeEscrowRoleTx,
  sendRevokePanelRoleTx,
  sendSetPausedTx,
} from '@/lib/utils/sendAdminTx';

const CONTRACT_ROWS = [
  ['MockUSDC', CONTRACT_ADDRESSES.MockUSDC],
  ['JobRegistry', CONTRACT_ADDRESSES.JobRegistry],
  ['EscrowVault', CONTRACT_ADDRESSES.EscrowVault],
  ['ArbitratorPanel', CONTRACT_ADDRESSES.ArbitratorPanel],
  ['PlatformTreasury', CONTRACT_ADDRESSES.PlatformTreasury],
  ['ReputationStore', CONTRACT_ADDRESSES.ReputationStore],
] as const;

const ROLE_OPTIONS = [
  { value: 'escrow_pauser', label: 'EscrowVault — Pauser (setPaused)', contract: 'escrow' as const },
  {
    value: 'escrow_force_resolver',
    label: 'EscrowVault — Force resolver (adminForceResolve)',
    contract: 'escrow' as const,
  },
  {
    value: 'panel_arbitrator_manager',
    label: 'ArbitratorPanel — Arbitrator manager (joinPool for others)',
    contract: 'panel' as const,
  },
];

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="btn ghost btn-compact copy-btn" onClick={copy} title="Copy address">
      {copied ? 'Copied' : label ?? 'Copy'}
    </button>
  );
}

function RoleBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`badge${active ? ' success' : ''}`} style={{ marginRight: '0.35rem' }}>
      {label}: {active ? 'yes' : 'no'}
    </span>
  );
}

export function AdminDashboardPage() {
  const { address } = useAccount();
  const admin = useAdminAccess();
  const { txStatus, txHash, txLabel, txError, resetTx, runTx } = useContractTx();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string>();
  const [statsLoading, setStatsLoading] = useState(true);

  const [roleTarget, setRoleTarget] = useState('');
  const [roleKind, setRoleKind] = useState(ROLE_OPTIONS[0].value);
  const [joinPoolTarget, setJoinPoolTarget] = useState('');
  const [forceJobId, setForceJobId] = useState('');
  const [forceDecision, setForceDecision] = useState(String(VOTE_CHOICES.FREELANCER_WIN));

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    setStatsError(undefined);
    fetchAdminStats()
      .then((res) => {
        if (res.success) setStats(res);
        else setStatsError('Stats unavailable');
      })
      .catch((err) => setStatsError(err instanceof Error ? err.message : 'Failed to load stats'))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const afterTx = useCallback(async () => {
    admin.refresh();
    loadStats();
  }, [admin, loadStats]);

  const handlePauseToggle = async () => {
    const nextPaused = !admin.escrowPaused;
    await runTx(
      nextPaused ? 'Pausing EscrowVault…' : 'Unpausing EscrowVault…',
      () => sendSetPausedTx(nextPaused),
    );
    await afterTx();
  };

  const resolveRoleId = async (kind: string): Promise<{ contract: 'escrow' | 'panel'; role: bigint }> => {
    if (kind === 'escrow_pauser') {
      const role = (await readContract(wagmiConfig, {
        address: contracts.escrowVault.address,
        abi: contracts.escrowVault.abi as Abi,
        functionName: 'ROLE_PAUSER',
      })) as bigint;
      return { contract: 'escrow', role };
    }
    if (kind === 'escrow_force_resolver') {
      const role = (await readContract(wagmiConfig, {
        address: contracts.escrowVault.address,
        abi: contracts.escrowVault.abi as Abi,
        functionName: 'ROLE_FORCE_RESOLVER',
      })) as bigint;
      return { contract: 'escrow', role };
    }
    const role = (await readContract(wagmiConfig, {
      address: contracts.arbitratorPanel.address,
      abi: contracts.arbitratorPanel.abi as Abi,
      functionName: 'ROLE_ARBITRATOR_MANAGER',
    })) as bigint;
    return { contract: 'panel', role };
  };

  const handleGrantRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAddress(roleTarget)) {
      alert('Enter a valid 0x address');
      return;
    }
    const grantee = getAddress(roleTarget);
    const { contract, role } = await resolveRoleId(roleKind);
    await runTx(`Granting role to ${truncateAddress(grantee)}…`, async () => {
      if (contract === 'escrow') return sendGrantEscrowRoleTx(grantee, role);
      return sendGrantPanelRoleTx(grantee, role);
    });
    await afterTx();
  };

  const handleRevokeRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAddress(roleTarget)) {
      alert('Enter a valid 0x address');
      return;
    }
    const grantee = getAddress(roleTarget);
    const { contract, role } = await resolveRoleId(roleKind);
    await runTx(`Revoking role from ${truncateAddress(grantee)}…`, async () => {
      if (contract === 'escrow') return sendRevokeEscrowRoleTx(grantee, role);
      return sendRevokePanelRoleTx(grantee, role);
    });
    await afterTx();
  };

  const handleJoinPool = async (e: FormEvent) => {
    e.preventDefault();
    const target = joinPoolTarget.trim() || address;
    if (!target || !isAddress(target)) {
      alert('Enter a valid arbitrator address');
      return;
    }
    const arb = getAddress(target);
    await runTx(`Joining arbitrator pool for ${truncateAddress(arb)}…`, () => sendJoinPoolAdminTx(arb));
    await afterTx();
  };

  const handleForceResolve = async (e: FormEvent) => {
    e.preventDefault();
    const jobId = BigInt(forceJobId);
    const decision = Number(forceDecision);
    if (!forceJobId || jobId <= 0n) {
      alert('Enter a valid on-chain job ID');
      return;
    }
    const confirmed = window.confirm(
      `Force-resolve job #${jobId} as "${formatDisputeChoice(decision)}"? This is an emergency action when quorum fails.`,
    );
    if (!confirmed) return;

    await runTx(`Force-resolving job #${jobId}…`, () => sendAdminForceResolveTx(jobId, decision));
    await afterTx();
  };

  const canGrantSelectedRole =
    ROLE_OPTIONS.find((o) => o.value === roleKind)?.contract === 'escrow'
      ? admin.canGrantVaultRoles
      : admin.canGrantPanelRoles;

  return (
    <main className="page admin-page">
      <div className="page-header">
        <h2>Platform governance</h2>
        <p className="muted">
          On-chain admin console — actions are signed via MetaMask on Sepolia. MongoDB has no admin RBAC;
          access is enforced by contract roles.
        </p>
      </div>

      {admin.error && <p className="error">{admin.error}</p>}

      <section className="panel">
        <h3>Your access</h3>
        <p className="muted mono">{address}</p>
        <div className="admin-role-badges">
          <RoleBadge active={admin.isVaultAdmin} label="Vault admin" />
          <RoleBadge active={admin.isPanelAdmin} label="Panel admin" />
          <RoleBadge active={admin.isDeployer} label="Deployer" />
          <RoleBadge active={admin.roles.pauser} label="Pauser" />
          <RoleBadge active={admin.roles.forceResolver} label="Force resolver" />
          <RoleBadge active={admin.roles.arbitratorManager} label="Arb. manager" />
        </div>
      </section>

      <section className="panel">
        <h3>Platform overview</h3>
        <dl className="detail-grid">
          <dt>Deployer (from deployments)</dt>
          <dd className="admin-address-row">
            <code className="mono">{DEPLOYER_ADDRESS}</code>
            <CopyButton text={DEPLOYER_ADDRESS} />
          </dd>
          <dt>EscrowVault admin</dt>
          <dd className="admin-address-row">
            <code className="mono">{admin.vaultAdmin ?? '—'}</code>
            {admin.vaultAdmin && <CopyButton text={admin.vaultAdmin} />}
          </dd>
          <dt>ArbitratorPanel admin</dt>
          <dd className="admin-address-row">
            <code className="mono">{admin.panelAdmin ?? '—'}</code>
            {admin.panelAdmin && <CopyButton text={admin.panelAdmin} />}
          </dd>
          <dt>Escrow paused</dt>
          <dd>
            <span className={`badge${admin.escrowPaused ? ' error' : ' success'}`}>
              {admin.escrowPaused ? 'Paused' : 'Active'}
            </span>
          </dd>
          <dt>Arbitrator pool size</dt>
          <dd>
            <strong>{admin.poolSize ?? '—'}</strong>
            {admin.poolSize != null && admin.poolSize < 5 && (
              <span className="muted phase-note"> — need ≥5 for raiseDispute</span>
            )}
          </dd>
        </dl>

        <h4 className="admin-subheading">Contract addresses</h4>
        <ul className="admin-contract-list">
          {CONTRACT_ROWS.map(([name, addr]) => (
            <li key={name} className="admin-contract-row">
              <span className="admin-contract-name">{name}</span>
              <code className="mono">{addr}</code>
              <CopyButton text={addr} />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h3>Platform stats (API cache)</h3>
          <button type="button" className="btn ghost btn-compact" onClick={loadStats} disabled={statsLoading}>
            Refresh
          </button>
        </div>
        {statsLoading && <p className="muted">Loading stats…</p>}
        {statsError && <p className="error">{statsError}</p>}
        {stats && (
          <>
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-label">Total jobs (DB)</span>
                <strong>{stats.jobs.total}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Disputed</span>
                <strong>{stats.jobs.disputed}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Indexer last block</span>
                <strong>{stats.indexer.lastBlock ?? '—'}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">MongoDB</span>
                <strong>{stats.mongodb}</strong>
              </div>
            </div>
            {stats.jobs.byStatus && Object.keys(stats.jobs.byStatus).length > 0 && (
              <ul className="admin-status-list">
                {Object.entries(stats.jobs.byStatus).map(([status, count]) => (
                  <li key={status}>
                    <span className="badge">{status}</span> {count}
                  </li>
                ))}
              </ul>
            )}
            <p className="muted phase-note">
              Stats are read-only from MongoDB (event indexer cache). On-chain state is authoritative for
              escrow and disputes.
            </p>
          </>
        )}
      </section>

      {admin.canPause && (
        <section className="panel">
          <h3>Emergency pause</h3>
          <p className="muted">
            Calls <code>EscrowVault.setPaused</code>. When paused, escrow writes are blocked until unpaused.
          </p>
          <button
            type="button"
            className={`btn${admin.escrowPaused ? ' primary' : ' ghost'}`}
            onClick={handlePauseToggle}
            disabled={txStatus === 'pending'}
          >
            {admin.escrowPaused ? 'Unpause escrow' : 'Pause escrow'}
          </button>
        </section>
      )}

      {(admin.canGrantVaultRoles || admin.canGrantPanelRoles) && (
        <section className="panel">
          <h3>Grant / revoke delegated roles</h3>
          <p className="muted">Only contract admin can grant or revoke. Does not transfer admin ownership.</p>
          {!canGrantSelectedRole && (
            <p className="muted phase-note">
              You cannot modify the selected role — switch role or connect the contract admin wallet.
            </p>
          )}
          <form className="admin-form" onSubmit={handleGrantRole}>
            <label className="form-field">
              Wallet address
              <input
                type="text"
                className="input"
                placeholder="0x…"
                value={roleTarget}
                onChange={(e) => setRoleTarget(e.target.value)}
                spellCheck={false}
              />
            </label>
            <label className="form-field">
              Role
              <select className="input" value={roleKind} onChange={(e) => setRoleKind(e.target.value)}>
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-form-actions">
              <button
                type="submit"
                className="btn primary"
                disabled={txStatus === 'pending' || !canGrantSelectedRole}
              >
                Grant role
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={txStatus === 'pending' || !canGrantSelectedRole}
                onClick={(e) => void handleRevokeRole(e)}
              >
                Revoke role
              </button>
            </div>
          </form>
          <p className="muted phase-note">
            CLI alternative:{' '}
            <code>npx hardhat run scripts/grant-platform-roles.js --network sepolia</code> with{' '}
            <code>GRANTEE_ADDRESS</code> and <code>ROLE=pauser|force_resolver|arbitrator_manager</code>.
          </p>
        </section>
      )}

      {admin.canManageArbitrators && (
        <section className="panel">
          <h3>Arbitrator pool</h3>
          <p className="muted">
            Pool size: <strong>{admin.poolSize ?? '—'}</strong>. Disputes require ≥5 members. Seed script:{' '}
            <code>npm run seed:arbitrators</code> (root monorepo).
          </p>
          <form className="admin-form" onSubmit={handleJoinPool}>
            <label className="form-field">
              Arbitrator address (leave empty for connected wallet)
              <input
                type="text"
                className="input"
                placeholder={address ?? '0x…'}
                value={joinPoolTarget}
                onChange={(e) => setJoinPoolTarget(e.target.value)}
                spellCheck={false}
              />
            </label>
            <button type="submit" className="btn primary" disabled={txStatus === 'pending'}>
              joinPool
            </button>
          </form>
        </section>
      )}

      {admin.canForceResolve && (
        <section className="panel admin-danger-panel">
          <h3>Force resolve dispute</h3>
          <div className="admin-warning-banner" role="alert">
            Emergency only — use when arbitrator quorum fails (&lt;3 reveals). Bypasses commit-reveal
            voting and settles escrow per your decision on-chain.
          </div>
          <form className="admin-form" onSubmit={handleForceResolve}>
            <label className="form-field">
              On-chain job ID
              <input
                type="number"
                className="input"
                min={1}
                value={forceJobId}
                onChange={(e) => setForceJobId(e.target.value)}
                required
              />
            </label>
            <label className="form-field">
              Decision
              <select
                className="input"
                value={forceDecision}
                onChange={(e) => setForceDecision(e.target.value)}
              >
                <option value={String(VOTE_CHOICES.FREELANCER_WIN)}>
                  {formatDisputeChoice(VOTE_CHOICES.FREELANCER_WIN)}
                </option>
                <option value={String(VOTE_CHOICES.CLIENT_WIN)}>
                  {formatDisputeChoice(VOTE_CHOICES.CLIENT_WIN)}
                </option>
                <option value={String(VOTE_CHOICES.SPLIT)}>
                  {formatDisputeChoice(VOTE_CHOICES.SPLIT)}
                </option>
              </select>
            </label>
            <button type="submit" className="btn ghost admin-danger-btn" disabled={txStatus === 'pending'}>
              adminForceResolve
            </button>
          </form>
        </section>
      )}

      <TxStatusModal
        open={txStatus !== 'idle'}
        status={txStatus}
        label={txLabel}
        hash={txHash}
        error={txError}
        onClose={resetTx}
      />
    </main>
  );
}
