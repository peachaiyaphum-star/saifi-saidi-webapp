import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface CausePoint {
  cause: string;
  eventCount: number;
  customerMinutes: number;
}

const COLORS = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2", "#be185d", "#65a30d", "#64748b"];

export function CauseBreakdown({ data }: { data: CausePoint[] }) {
  const top = data.slice(0, 8);
  const rest = data.slice(8);
  const chartData =
    rest.length > 0
      ? [...top, { cause: "อื่นๆ", customerMinutes: rest.reduce((s, r) => s + r.customerMinutes, 0), eventCount: rest.reduce((s, r) => s + r.eventCount, 0) }]
      : top;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="customerMinutes"
          nameKey="cause"
          cx="50%"
          cy="50%"
          outerRadius={110}
          label={(entry) => entry.cause}
        >
          {chartData.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [`${value.toLocaleString()} นาที-ราย`, "ผลกระทบ"]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
