import type { VoteTally } from '@/lib/utils/disputeChoice';

interface VoteTallyDisplayProps {
  tally: VoteTally;
  commitCount: number;
  revealCount: number;
}

export function VoteTallyDisplay({ tally, commitCount, revealCount }: VoteTallyDisplayProps) {
  return (
    <div className="vote-tally-box">
      <h4>Kết quả vote (công khai sau reveal)</h4>
      <ul className="vote-tally-list">
        <li>
          Freelancer thắng: <strong>{tally.freelancer}</strong>
        </li>
        <li>
          Client thắng: <strong>{tally.client}</strong>
        </li>
        <li>
          Chia 50-50: <strong>{tally.split}</strong>
        </li>
      </ul>
      <p className="muted phase-note">
        Commit {commitCount} · Reveal {revealCount} · Đã mở {tally.total} phiếu (cần ≥3 hợp lệ để
        finalize)
      </p>
    </div>
  );
}
