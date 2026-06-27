import type { VoteTally } from '@/lib/utils/disputeChoice';

interface VoteTallyDisplayProps {
  tally: VoteTally;
  commitCount: number;
  revealCount: number;
}

export function VoteTallyDisplay({ tally, commitCount, revealCount }: VoteTallyDisplayProps) {
  return (
    <div className="vote-tally-box">
      <h4>Vote tally (public after reveal)</h4>
      <ul className="vote-tally-list">
        <li>
          Freelancer wins: <strong>{tally.freelancer}</strong>
        </li>
        <li>
          Client wins: <strong>{tally.client}</strong>
        </li>
        <li>
          Split 50-50: <strong>{tally.split}</strong>
        </li>
      </ul>
      <p className="muted phase-note">
        Commit {commitCount} · Reveal {revealCount} · {tally.total} votes revealed (need ≥3 valid to
        finalize)
      </p>
    </div>
  );
}
