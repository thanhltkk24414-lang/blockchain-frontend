import type { TooltipProps } from 'recharts';

type ChartTooltipProps = TooltipProps<number, string> & {
  valueSuffix?: string;
  valueLabel?: string;
};

/**
 * High-contrast Recharts tooltip — readable in light and dark themes.
 * Uses fixed colors instead of CSS variables that may invert poorly on charts.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  valueSuffix = '',
  valueLabel,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  const name = valueLabel ?? entry.name ?? 'Value';
  const raw = entry.value;
  const display =
    typeof raw === 'number'
      ? `${raw}${valueSuffix}`
      : raw != null
        ? String(raw)
        : '—';

  return (
    <div className="chart-tooltip" role="tooltip">
      {label != null && String(label).length > 0 && (
        <p className="chart-tooltip-label">{label}</p>
      )}
      <p className="chart-tooltip-value">
        <span className="chart-tooltip-name">{name}</span>
        <strong>{display}</strong>
      </p>
    </div>
  );
}
