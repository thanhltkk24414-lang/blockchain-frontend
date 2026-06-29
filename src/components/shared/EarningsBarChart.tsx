import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components/shared/ChartTooltip';

export interface EarningsPoint {
  label: string;
  earned: number;
}

interface EarningsBarChartProps {
  title: string;
  data: EarningsPoint[];
  emptyLabel?: string;
}

const AXIS_TICK = { fill: 'var(--chart-axis-fill)', fontSize: 11 };
const GRID_STROKE = 'var(--chart-grid-stroke)';

export function EarningsBarChart({ title, data, emptyLabel = 'No earnings yet' }: EarningsBarChartProps) {
  const points = data.filter((d) => d.earned > 0);

  return (
    <section className="panel dashboard-chart-panel">
      <h3>{title}</h3>
      {points.length === 0 ? (
        <p className="muted chart-empty">{emptyLabel}</p>
      ) : (
        <div className="dashboard-chart-wrap dashboard-chart-bar">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={{ stroke: GRID_STROKE }}
                tickLine={false}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<ChartTooltip valueSuffix=" USDC" valueLabel="Earned" />} />
              <Bar dataKey="earned" fill="var(--fapex-primary)" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
