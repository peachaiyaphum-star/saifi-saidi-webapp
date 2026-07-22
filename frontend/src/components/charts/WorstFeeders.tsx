export interface FeederPoint {
  feeder: string;
  eventCount: number;
  customersAffected: number;
  customerMinutes: number;
}

export function WorstFeeders({ data }: { data: FeederPoint[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b text-slate-500">
          <th className="pb-2">อันดับ</th>
          <th className="pb-2">ฟีดเดอร์</th>
          <th className="pb-2">จำนวนเหตุการณ์</th>
          <th className="pb-2">ผชฟ.ถูกกระทบ</th>
          <th className="pb-2">ผชฟ.*เวลา (นาที-ราย)</th>
        </tr>
      </thead>
      <tbody>
        {data.map((f, idx) => (
          <tr key={f.feeder} className="border-b last:border-0">
            <td className="py-2 font-medium text-slate-500">{idx + 1}</td>
            <td className="py-2 font-medium text-slate-800">{f.feeder}</td>
            <td className="py-2">{f.eventCount.toLocaleString()}</td>
            <td className="py-2">{f.customersAffected.toLocaleString()}</td>
            <td className="py-2">{f.customerMinutes.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
