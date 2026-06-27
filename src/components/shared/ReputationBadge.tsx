import { tierBadgeClass, type ReputationView } from '@/hooks/useReputation';

interface ReputationBadgeProps {
  reputation: ReputationView | null;
  loading?: boolean;
  compact?: boolean;
}

export function ReputationBadge({ reputation, loading, compact }: ReputationBadgeProps) {
  if (loading) {
    return <span className="reputation-badge muted">Rep …</span>;
  }
  if (!reputation) return null;

  if (compact) {
    return (
      <span className="reputation-badge compact" title={`ReputationStore: ${reputation.score}`}>
        <span className={tierBadgeClass(reputation.tier)}>{reputation.tier}</span>
        <span className="reputation-score">{reputation.score}</span>
      </span>
    );
  }

  return (
    <div className="reputation-panel">
      <div className="reputation-header">
        <span className={tierBadgeClass(reputation.tier)}>{reputation.tier}</span>
        <strong className="reputation-score">{reputation.score}</strong>
        <span className="muted">/ 100+</span>
      </div>
      <p className="muted phase-note">
        On-chain reputation (ReputationStore on Sepolia). Tier ≥80 required to raise disputes or join
        the arbitrator pool.
      </p>
    </div>
  );
}
