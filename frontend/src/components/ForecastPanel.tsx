import { useState } from "react";
import { apiClient } from "../api/client";

interface ForecastResult {
  asOfDate: string;
  targetDate: string;
  actualSaifiAsOf: number;
  actualSaidiAsOf: number;
  forecastSaifi: number;
  forecastSaidi: number;
  targetSaifiAtDate: number | null;
  targetSaidiAtDate: number | null;
  saifiOnTrack: boolean | null;
  saidiOnTrack: boolean | null;
}

export function ForecastPanel({ batchId }: { batchId?: string }) {
  const [date, setDate] = useState("");
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCalculate() {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<ForecastResult>("/dashboard/forecast", {
        params: { date, ...(batchId ? { batchId } : {}) },
      });
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "คำนวณไม่สำเร็จ");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-slate-800">ทำนายผล ณ วันที่ต้องการทราบ</h2>
      <p className="mb-4 text-sm text-slate-500">
        ระบบคำนวณอัตโนมัติจากอัตราเฉลี่ยสะสมของข้อมูลจริงถึงปัจจุบัน แล้วประมาณการไปยังวันที่เลือก (ไม่ใช่ค่าที่แม่นยำ 100%
        เป็นเพียงแนวโน้ม)
      </p>
      <div className="flex items-end gap-3">
        <div>
          <label className="mb-1 block text-sm text-slate-600">วันที่ต้องการทราบ</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleCalculate}
          disabled={!date || loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "กำลังคำนวณ..." : "คำนวณ"}
        </button>
      </div>

      {error && <div className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {result && (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded border p-4">
            <div className="text-sm text-slate-500">SAIFI ที่คาดการณ์ (ครั้ง/ราย)</div>
            <div className="mt-1 text-2xl font-semibold text-slate-800">{result.forecastSaifi.toFixed(2)}</div>
            {result.targetSaifiAtDate !== null ? (
              <div
                className={`mt-2 inline-block rounded px-2 py-1 text-xs font-medium ${
                  result.saifiOnTrack ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                เป้าหมาย ณ วันนี้ {result.targetSaifiAtDate.toFixed(2)} ·{" "}
                {result.saifiOnTrack ? "อยู่ในแนวโน้มผ่านเกณฑ์" : "มีแนวโน้มไม่ผ่านเกณฑ์"}
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-400">ยังไม่ได้ตั้งเป้าหมายรายเดือนสำหรับช่วงนี้</div>
            )}
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-slate-500">SAIDI ที่คาดการณ์ (นาที/ราย)</div>
            <div className="mt-1 text-2xl font-semibold text-slate-800">{result.forecastSaidi.toFixed(1)}</div>
            {result.targetSaidiAtDate !== null ? (
              <div
                className={`mt-2 inline-block rounded px-2 py-1 text-xs font-medium ${
                  result.saidiOnTrack ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                เป้าหมาย ณ วันนี้ {result.targetSaidiAtDate.toFixed(1)} ·{" "}
                {result.saidiOnTrack ? "อยู่ในแนวโน้มผ่านเกณฑ์" : "มีแนวโน้มไม่ผ่านเกณฑ์"}
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-400">ยังไม่ได้ตั้งเป้าหมายรายเดือนสำหรับช่วงนี้</div>
            )}
          </div>
          <div className="sm:col-span-2 text-xs text-slate-400">
            คำนวณจากข้อมูลจริงถึงวันที่ {new Date(result.asOfDate).toLocaleDateString("th-TH")} (SAIFI ปัจจุบัน{" "}
            {result.actualSaifiAsOf.toFixed(2)} · SAIDI ปัจจุบัน {result.actualSaidiAsOf.toFixed(1)})
          </div>
        </div>
      )}
    </div>
  );
}
