import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface AreaPoint {
  office: string;
  eventCount: number;
  customerMinutes: number;
}

export function AreaBreakdown({ data }: { data: AreaPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" fontSize={12} />
        <YAxis type="category" dataKey="office" width={160} fontSize={12} />
        <Tooltip formatter={(value: number) => value.toLocaleString()} />
        <Bar dataKey="customerMinutes" name="ผชฟ.*เวลา (นาที-ราย)" fill="#2563eb" />
      </BarChart>
    </ResponsiveContainer>
  );
}
