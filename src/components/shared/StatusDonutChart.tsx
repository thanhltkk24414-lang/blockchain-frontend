import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

interface StatusDonutChartProps {
  title: string;
  data: StatusSlice[];
  emptyLabel?: string;
}

export function StatusDonutChart({ title, data, emptyLabel = 'No data yet' }: StatusDonutChartProps) {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((sum, d) => sum + d.value, 0);

  return (
    <section className="panel dashboard-chart-panel">
      <h3>{title}</h3>
      {total === 0 ? (
        <p className="muted chart-empty">{emptyLabel}</p>
      ) : (
        <div className="dashboard-chart-wrap">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={2}
                stroke="var(--panel-bg, #151a24)"
                strokeWidth={2}
              >
                {slices.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`${value}`, name]}
                contentStyle={{
                  background: 'var(--panel-bg, #151a24)',
                  border: '1px solid var(--border, #2a2f3a)',
                  borderRadius: 8,
                  color: 'var(--text, #e8eaed)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <ul className="chart-legend">
            {slices.map((slice) => (
              <li key={slice.name}>
                <span className="chart-legend-swatch" style={{ background: slice.color }} aria-hidden />
                <span>{slice.name}</span>
                <strong>{slice.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
