import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { getAddress, isAddress, type Abi } from 'viem';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useContractTx } from '@/hooks/useContractTx';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { GovernanceTransparencyCard } from '@/components/admin/GovernanceTransparencyCard';
import { ForceResolvePanel } from '@/components/admin/ForceResolvePanel';
import { CONTRACT_ADDRESSES, DEPLOYER_ADDRESS } from '@/lib/contracts/addresses';
import { contracts } from '@/lib/contracts/config';
import { wagmiConfig } from '@/config/wagmi';
import { truncateAddress } from '@/lib/utils/address';
import {
  fetchAdminStats,
  fetchArbitratorApplications,
  fetchQuorumFailedJobs,
  updateArbitratorApplicationStatus,
  type AdminStats,
  type ArbitratorApplication,
  type QuorumFailedJob,
} from '@/lib/api/client';
import { useRoleHolders } from '@/hooks/useRoleHolders';
import {
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
] as const;

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
  const [roleKind, setRoleKind] = useState<string>(ROLE_OPTIONS[0].value);
  const [joinPoolTarget, setJoinPoolTarget] = useState('');
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [applications, setApplications] = useState<ArbitratorApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState<string>();
  const [actionAppId, setActionAppId] = useState<string | null>(null);
  const [quorumJobs, setQuorumJobs] = useState<QuorumFailedJob[]>([]);
  const [quorumLoading, setQuorumLoading] = useState(true);
  const [quorumError, setQuorumError] = useState<string>();
  const [forceResolveJobId, setForceResolveJobId] = useState('');

  const roleHolders = useRoleHolders(roleKind, roleTarget.trim() || undefined);

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

  const loadApplications = useCallback(() => {
    setApplicationsLoading(true);
    setApplicationsError(undefined);
    fetchArbitratorApplications('pending')
      .then((res) => {
        if (res.success) setApplications(res.applications);
        else setApplicationsError('Applications unavailable');
      })
      .catch((err) =>
        setApplicationsError(err instanceof Error ? err.message : 'Failed to load applications'),
      )
      .finally(() => setApplicationsLoading(false));
  }, []);

  const loadQuorumFailed = useCallback(() => {
    setQuorumLoading(true);
    setQuorumError(undefined);
    fetchQuorumFailedJobs()
      .then((res) => {
        if (res.success) setQuorumJobs(res.jobs);
        else setQuorumError('Quorum scan unavailable');
      })
      .catch((err) =>
        setQuorumError(err instanceof Error ? err.message : 'Failed to load quorum-failed jobs'),
      )
      .finally(() => setQuorumLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
    loadApplications();
    loadQuorumFailed();
  }, [loadStats, loadApplications, loadQuorumFailed]);

  const afterTx = useCallback(async () => {
    admin.refresh();
    roleHolders.refresh();
    loadStats();
    loadApplications();
    loadQuorumFailed();
  }, [admin.refresh, loadStats, loadApplications, loadQuorumFailed, roleHolders.refresh]);

  const handlePauseConfirm = async () => {
    setPauseConfirmOpen(false);
    await runTx('Pausing EscrowVault…', () => sendSetPausedTx(true));
    await afterTx();
  };

  const handleUnpause = async () => {
    await runTx('Unpausing EscrowVault…', () => sendSetPausedTx(false));
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

  const handleApproveApplication = async (app: ArbitratorApplication) => {
    if (!isAddress(app.walletAddress)) {
      alert('Invalid applicant wallet');
      return;
    }
    const arb = getAddress(app.walletAddress);
    setActionAppId(app._id);
    try {
      await runTx(`Approving & joinPool for ${truncateAddress(arb)}…`, () => sendJoinPoolAdminTx(arb));
      await updateArbitratorApplicationStatus(app._id, 'approved');
      await afterTx();
    } finally {
      setActionAppId(null);
    }
  };

  const handleRejectApplication = async (app: ArbitratorApplication) => {
    if (!window.confirm(`Reject application from ${truncateAddress(app.walletAddress)}?`)) return;
    setActionAppId(app._id);
    try {
      await updateArbitratorApplicationStatus(app._id, 'rejected');
      await loadApplications();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setActionAppId(null);
    }
  };

  const canGrantSelectedRole =
    ROLE_OPTIONS.find((o) => o.value === roleKind)?.contract === 'escrow'
      ? admin.canGrantVaultRoles
      : admin.canGrantPanelRoles;

  const isForceResolverRole = roleKind === 'escrow_force_resolver';

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

      <GovernanceTransparencyCard />

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
            onClick={() => {
              if (admin.escrowPaused) {
                void handleUnpause();
              } else {
                setPauseConfirmOpen(true);
              }
            }}
            disabled={txStatus === 'pending'}
          >
            {admin.escrowPaused ? 'Unpause escrow' : 'Pause escrow'}
          </button>

          <ConfirmModal
            open={pauseConfirmOpen}
            title="Pause EscrowVault?"
            danger
            confirmLabel="Pause escrow"
            onConfirm={() => void handlePauseConfirm()}
            onCancel={() => setPauseConfirmOpen(false)}
          >
            <p>
              This blocks new deposits, dispute raises, and other escrow writes until unpaused. Funds
              already in escrow remain locked — no one can withdraw them while paused.
            </p>
            <p className="muted phase-note">Use only for incidents or demo rehearsal — not routine ops.</p>
          </ConfirmModal>
        </section>
      )}

      {(admin.canGrantVaultRoles || admin.canGrantPanelRoles) && (
        <section className="panel">
          <h3>Grant / revoke delegated roles</h3>
          <p className="muted">Only contract admin can grant or revoke. Does not transfer admin ownership.</p>

          {isForceResolverRole && (
            <div className="admin-warning-banner admin-warning-banner-strong" role="alert">
              <strong>Emergency role.</strong> Grant <code>ROLE_FORCE_RESOLVER</code> only to a production
              multisig — never to an individual hot wallet. Holders can call{' '}
              <code>adminForceResolve</code> when quorum fails.
            </div>
          )}

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

          <h4 className="admin-subheading">Current role holders (known addresses)</h4>
          {roleHolders.loading && <p className="muted">Checking hasRole on-chain…</p>}
          {!roleHolders.loading && roleHolders.rows.length === 0 && (
            <p className="muted phase-note">
              No holders among deployer / contract admins / entered address — verify other wallets on
              Etherscan via <code>hasRole(addr, roleId)</code>.
            </p>
          )}
          {!roleHolders.loading && roleHolders.rows.length > 0 && (
            <ul className="admin-role-holder-list">
              {roleHolders.rows.map((row) => (
                <li key={row.address}>
                  <span className="badge success">{row.label}</span>{' '}
                  <code className="mono">{row.address}</code>
                </li>
              ))}
            </ul>
          )}

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
            Pool size: <strong>{admin.poolSize ?? '—'}</strong>. Disputes require ≥5 members. Applicants
            submit motivation on Profile; approve here to call <code>joinPool</code> on-chain.
          </p>

          <div className="panel-header-row">
            <h4 className="admin-subheading">Pending applications</h4>
            <button
              type="button"
              className="btn ghost btn-compact"
              onClick={loadApplications}
              disabled={applicationsLoading}
            >
              Refresh
            </button>
          </div>
          {applicationsLoading && <p className="muted">Loading applications…</p>}
          {applicationsError && <p className="error">{applicationsError}</p>}
          {!applicationsLoading && !applicationsError && applications.length === 0 && (
            <p className="muted phase-note">No pending arbitrator applications.</p>
          )}
          {!applicationsLoading && applications.length > 0 && (
            <div className="admin-role-table-wrap">
              <table className="admin-role-table admin-applications-table">
                <thead>
                  <tr>
                    <th>Wallet</th>
                    <th>Reason</th>
                    <th>Stake</th>
                    <th>Reputation</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app._id}>
                      <td>
                        <code className="mono">{truncateAddress(app.walletAddress, 6, 4)}</code>
                        <CopyButton text={app.walletAddress} />
                      </td>
                      <td className="admin-app-reason">{app.reason}</td>
                      <td>
                        {app.stakeVerified ? (
                          <span className="badge success">{app.stakedAmount ?? '≥50'} USDC</span>
                        ) : (
                          <span className="badge error">Unverified</span>
                        )}
                      </td>
                      <td>{app.reputationScore ?? '—'}</td>
                      <td>
                        {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div className="admin-form-actions">
                          <button
                            type="button"
                            className="btn primary btn-compact"
                            disabled={txStatus === 'pending' || actionAppId === app._id}
                            onClick={() => void handleApproveApplication(app)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn ghost btn-compact"
                            disabled={actionAppId === app._id}
                            onClick={() => void handleRejectApplication(app)}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4 className="admin-subheading">Manual joinPool</h4>
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
        <>
          <section className="panel admin-danger-panel">
            <div className="panel-header-row">
              <h3>Quorum failed — needs force resolve</h3>
              <button
                type="button"
                className="btn ghost btn-compact"
                onClick={loadQuorumFailed}
                disabled={quorumLoading}
              >
                Refresh
              </button>
            </div>
            <p className="muted">
              Disputed jobs with fewer than 3 valid vote reveals after the reveal window. Evidence is
              hydrated from chain + IPFS for review before emergency{' '}
              <code>adminForceResolve</code>.
            </p>
            {quorumLoading && <p className="muted">Scanning disputed jobs on-chain…</p>}
            {quorumError && <p className="error">{quorumError}</p>}
            {!quorumLoading && !quorumError && quorumJobs.length === 0 && (
              <p className="muted phase-note">No quorum-failed disputes right now.</p>
            )}
            {!quorumLoading && quorumJobs.length > 0 && (
              <ul className="admin-quorum-list">
                {quorumJobs.map((item) => (
                  <li key={item.onchainJobId} className="admin-quorum-item">
                    <div className="admin-quorum-header">
                      <strong>
                        Job #{item.onchainJobId}
                        {item.title ? ` — ${item.title}` : ''}
                      </strong>
                      <span className="badge warning">
                        {item.revealCount}/{item.quorum} reveals
                      </span>
                    </div>
                    {item.evidence && item.evidence.length > 0 && (
                      <ul className="evidence-list compact">
                        {item.evidence.slice(0, 4).map((ev, idx) => (
                          <li key={`${item.onchainJobId}-ev-${idx}`} className="evidence-item">
                            <span className="mono muted">{ev.submitter?.slice(0, 10)}…</span>
                            {ev.content?.description && <span> — {ev.content.description}</span>}
                            {ev.ipfsHash && (
                              <>
                                {' '}
                                <a
                                  href={`https://gateway.pinata.cloud/ipfs/${ev.ipfsHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="etherscan-link"
                                >
                                  IPFS ↗
                                </a>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="admin-form-actions">
                      <button
                        type="button"
                        className="btn ghost btn-compact"
                        onClick={() => setForceResolveJobId(String(item.onchainJobId))}
                      >
                        Pre-fill force resolve →
                      </button>
                      {item.mongoJobId && (
                        <a className="etherscan-link" href={`/jobs/${item.mongoJobId}`}>
                          Open job page
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ForceResolvePanel
            initialJobId={forceResolveJobId}
            onComplete={() => {
              setForceResolveJobId('');
              void afterTx();
            }}
          />
        </>
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
