interface MilestoneProgressProps {
  status: string;
}

const STEPS = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED'] as const;

function stepIndex(status: string): number {
  const key = status?.toUpperCase();
  const idx = STEPS.indexOf(key as (typeof STEPS)[number]);
  if (idx >= 0) return idx;
  if (key === 'DISPUTED') return 3;
  return 0;
}

export function MilestoneProgress({ status }: MilestoneProgressProps) {
  const current = stepIndex(status);

  return (
    <div className="milestone-progress" aria-label="Job progress">
      <p className="muted phase-note">Milestone progress</p>
      <ol className="milestone-steps">
        {STEPS.map((step, i) => (
          <li key={step} className={i <= current ? 'done' : ''}>
            <span className="milestone-dot" />
            <span>{step.replace('_', ' ')}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
