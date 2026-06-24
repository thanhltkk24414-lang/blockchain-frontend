const STATUS_CLASS: Record<string, string> = {
  OPEN: 'status-open',
  ASSIGNED: 'status-assigned',
  IN_PROGRESS: 'status-progress',
  SUBMITTED: 'status-submitted',
  COMPLETED: 'status-completed',
  CANCELLED: 'status-cancelled',
  DISPUTED: 'status-disputed',
  REFUNDED: 'status-cancelled',
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const key = status?.toUpperCase() || 'UNKNOWN';
  return <span className={`status ${STATUS_CLASS[key] || ''}`}>{key}</span>;
}
