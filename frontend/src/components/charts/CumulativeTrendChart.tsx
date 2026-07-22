import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface CumulativePoint {
  month: number;
  actualSaifi: number | null;
  actualSaidi: number | null;
  targetSaifi: number | null;
  targetSaidi: number | null;
}

const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function MiniChart({
  data,
  actualKey,
  targetKey,
  label,
}: {
  data: CumulativePoint[];
  actualKey: "actualSaifi" | "actualSaidi";
  targetKey: "targetSaifi" | "targetSaidi";
  label: string;
}) {
  const chartData = data.map((d) => ({
    monthLabel: MONTH_LABELS[d.month - 1],
    actual: d[actualKey],
    target: d[targetKey],
  }));

  return (
    <div>
      <div className="mb-2 text-sm font-medium text-slate-600">{label}</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="monthLabel" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="actual" name="สะสมจริง" stroke="#2563eb" strokeWidth={2} connectNulls={false} />
          <Line
            type="monotone"
            dataKey="target"
            name="เป้าหมายสะสม"
            stroke="#d97706"
            strokeWidth={2}
            strokeDasharray="5 4"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CumulativeTrendChart({ data }: { data: CumulativePoint[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <MiniChart data={data} actualKey="actualSaifi" targetKey="targetSaifi" label="SAIFI สะสม (ครั้ง/ราย)" />
      <MiniChart data={data} actualKey="actualSaidi" targetKey="targetSaidi" label="SAIDI สะสม (นาที/ราย)" />
    </div>
  );
}
