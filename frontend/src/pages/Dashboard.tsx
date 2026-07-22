import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { StatCard } from "../components/StatCard";
import { TrendChart, type TrendPoint } from "../components/charts/TrendChart";
import { CauseBreakdown, type CausePoint } from "../components/charts/CauseBreakdown";
import { AreaBreakdown, type AreaPoint } from "../components/charts/AreaBreakdown";
import { WorstFeeders, type FeederPoint } from "../components/charts/WorstFeeders";

interface Summary {
  fileName: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalCustomers: number;
  eventCount: number;
  saifi: number | null;
  saidi: number | null;
  target: { saifiTarget: number; saidiTarget: number } | null;
  saifiWithinTarget: boolean | null;
  saidiWithinTarget: boolean | null;
}

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [causes, setCauses] = useState<CausePoint[]>([]);
  const [areas, setAreas] = useState<AreaPoint[]>([]);
  const [worstFeeders, setWorstFeeders] = useState<FeederPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, t, c, a, w] = await Promise.all([
          apiClient.get("/dashboard/summary"),
          apiClient.get("/dashboard/trend"),
          apiClient.get("/dashboard/causes"),
          apiClient.get("/dashboard/areas"),
          apiClient.get("/dashboard/worst-feeders"),
        ]);
        setSummary(s.data);
        setTrend(t.data);
        setCauses(c.data);
        setAreas(a.data);
        setWorstFeeders(w.data);
      } catch (err: any) {
        setError(err.response?.data?.error ?? "ยังไม่มีข้อมูลสำหรับแสดงผล กรุณาอัปโหลดรายงาน 50 ก่อน");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-slate-500">กำลังโหลดข้อมูล...</div>;

  if (error || !summary) {
    return <div className="rounded-lg border bg-amber-50 p-6 text-amber-700">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="text-sm text-slate-500">
        ข้อมูลจากไฟล์: {summary.fileName}
        {summary.periodStart && summary.periodEnd && (
          <>
            {" "}
            · ช่วงข้อมูล {new Date(summary.periodStart).toLocaleDateString("th-TH")} -{" "}
            {new Date(summary.periodEnd).toLocaleDateString("th-TH")}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="SAIFI (ครั้ง/ราย)"
          value={summary.saifi?.toFixed(2) ?? "-"}
          sub={
            summary.target
              ? `เป้าหมาย ${summary.target.saifiTarget} · ${summary.saifiWithinTarget ? "ผ่านเกณฑ์" : "ไม่ผ่านเกณฑ์"}`
              : "ยังไม่ตั้งเป้าหมาย"
          }
          status={summary.target ? (summary.saifiWithinTarget ? "ok" : "warn") : "neutral"}
        />
        <StatCard
          label="SAIDI (นาที/ราย)"
          value={summary.saidi?.toFixed(1) ?? "-"}
          sub={
            summary.target
              ? `เป้าหมาย ${summary.target.saidiTarget} · ${summary.saidiWithinTarget ? "ผ่านเกณฑ์" : "ไม่ผ่านเกณฑ์"}`
              : "ยังไม่ตั้งเป้าหมาย"
          }
          status={summary.target ? (summary.saidiWithinTarget ? "ok" : "warn") : "neutral"}
        />
        <StatCard label="จำนวนเหตุการณ์ที่ประเมิน" value={summary.eventCount.toLocaleString()} />
        <StatCard label="ผู้ใช้ไฟทั้งหมด" value={summary.totalCustomers.toLocaleString()} />
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">แนวโน้มรายเดือน (Trend Analysis)</h2>
        <TrendChart data={trend} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">สาเหตุหลักของการเกิดไฟดับ</h2>
          <CauseBreakdown data={causes} />
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">ประสิทธิภาพรายเขต/กฟฟ.</h2>
          <AreaBreakdown data={areas} />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">10 อันดับฟีดเดอร์ที่แย่ที่สุด</h2>
        <WorstFeeders data={worstFeeders} />
      </div>
    </div>
  );
}
