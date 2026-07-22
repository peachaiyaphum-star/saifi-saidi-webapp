import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  month: string;
  eventCount: number;
  saifi: number | null;
  saidi: number | null;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" fontSize={12} />
        <YAxis yAxisId="saifi" fontSize={12} />
        <YAxis yAxisId="saidi" orientation="right" fontSize={12} />
        <Tooltip />
        <Legend />
        <Line yAxisId="saifi" type="monotone" dataKey="saifi" name="SAIFI (ครั้ง/ราย)" stroke="#2563eb" strokeWidth={2} />
        <Line yAxisId="saidi" type="monotone" dataKey="saidi" name="SAIDI (นาที/ราย)" stroke="#dc2626" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
