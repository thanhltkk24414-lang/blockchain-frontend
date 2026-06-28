import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { etherscanAddressUrl } from '@/lib/utils/etherscan';
import { DISPUTE_QUORUM } from '@/lib/utils/forceResolveEligibility';

const DISPUTE_FLOW_DOCS =
  'https://github.com/thanhltkk24414-lang/Blockchain/blob/dev/docs/guides/contract-interaction.md';

const ROLE_MATRIX = [
  {
    actor: 'Arbitrators (panel of 5)',
    normal: 'Commit–reveal votes; majority decides outcome',
    emergency: '—',
  },
  {
    actor: 'Anyone',
    normal: 'finalizeDisputeVoting / executeArbitrationResult after phases',
    emergency: '—',
  },
  {
    actor: 'Pauser (delegated)',
    normal: '—',
    emergency: 'EscrowVault.setPaused — blocks new deposits & disputes',
  },
  {
    actor: 'Force resolver (delegated)',
    normal: '—',
    emergency: `adminForceResolve only when <${DISPUTE_QUORUM} reveals after reveal window`,
  },
  {
    actor: 'Contract admin / deployer',
    normal: 'grantRole, joinPool, setAuthorizedContract',
    emergency: 'All emergency roles + force resolve fallback',
  },
] as const;

export function GovernanceTransparencyCard() {
  const escrowExplorer = etherscanAddressUrl(CONTRACT_ADDRESSES.EscrowVault);

  return (
    <section className="panel admin-governance-panel">
      <h3>How governance works</h3>
      <p className="muted">
        Normal disputes are decided by five randomly chosen arbitrators using commit–reveal voting (
        quorum ≥{DISPUTE_QUORUM}). Admin force resolve is an emergency fallback when quorum fails — not
        part of the standard path.
      </p>

      <div className="admin-governance-flow">
        <h4 className="admin-subheading">Dispute resolution paths</h4>
        <pre className="admin-mermaid-hint" aria-label="Governance flow diagram">
{`flowchart LR
  A[raiseDispute] --> B[Evidence 0-10m]
  B --> C[Commit 10-13m]
  C --> D[Reveal 13-16m]
  D --> E{≥${DISPUTE_QUORUM} reveals?}
  E -->|Yes| F[finalizeDisputeVoting]
  F --> G[executeArbitrationResult]
  E -->|No| H[adminForceResolve]
  H --> I[Emergency only]`}
        </pre>
        <ul className="muted phase-note">
          <li>
            <strong>Normal path:</strong> arbitrators vote → finalize → execute (permissionless after
            timers).
          </li>
          <li>
            <strong>Emergency path:</strong> force resolve when reveal count &lt; {DISPUTE_QUORUM} after
            reveal window — UI blocks the button otherwise.
          </li>
        </ul>
      </div>

      <h4 className="admin-subheading">Who can do what</h4>
      <div className="admin-role-table-wrap">
        <table className="admin-role-table">
          <thead>
            <tr>
              <th>Actor</th>
              <th>Normal operations</th>
              <th>Emergency / admin</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_MATRIX.map((row) => (
              <tr key={row.actor}>
                <td>{row.actor}</td>
                <td>{row.normal}</td>
                <td>{row.emergency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-roadmap-note" role="note">
        <strong>MVP (Sepolia demo):</strong> single deployer wallet holds contract admin.{' '}
        <strong>Production roadmap:</strong> transfer admin to multisig + timelock; grant pauser /
        force_resolver only to multisig; publish force-resolve rationale off-chain before any
        emergency tx.
      </div>

      <h4 className="admin-subheading">Audit trail</h4>
      <p className="muted phase-note">
        Force resolve emits <code>AdminForceResolved</code> on EscrowVault — visible on{' '}
        <a className="etherscan-link" href={`${escrowExplorer}#events`} target="_blank" rel="noopener noreferrer">
          Etherscan events ↗
        </a>
        . Normal outcomes emit <code>DisputeFinalized</code> on ArbitratorPanel. The event indexer
        caches job status in MongoDB; on-chain logs are the source of truth.
      </p>

      <p className="muted phase-note">
        Full dispute API reference:{' '}
        <a className="etherscan-link" href={DISPUTE_FLOW_DOCS} target="_blank" rel="noopener noreferrer">
          contract-interaction.md ↗
        </a>
      </p>
    </section>
  );
}
