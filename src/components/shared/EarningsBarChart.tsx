import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface EarningsPoint {
  label: string;
  earned: number;
}

interface EarningsBarChartProps {
  title: string;
  data: EarningsPoint[];
  emptyLabel?: string;
}

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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #2a2f3a)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--muted, #9aa3b2)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--border, #2a2f3a)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--muted, #9aa3b2)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                formatter={(value: number) => [`${value} USDC`, 'Earned']}
                contentStyle={{
                  background: 'var(--panel-bg, #151a24)',
                  border: '1px solid var(--border, #2a2f3a)',
                  borderRadius: 8,
                  color: 'var(--text, #e8eaed)',
                }}
              />
              <Bar dataKey="earned" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
