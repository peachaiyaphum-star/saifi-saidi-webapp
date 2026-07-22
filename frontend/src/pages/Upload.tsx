import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

interface BatchSummary {
  id: string;
  fileName: string;
  uploadedAt: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  anomalyCount: number;
  fileSaifiEvaluated: number | null;
  fileSaidiEvaluated: number | null;
  uploadedBy: { name: string; email: string };
}

interface AnomalyEvent {
  id: string;
  eventNo: string;
  outageAt: string;
  feederCode: string | null;
  officeName: string | null;
  anomalyFlags: string[] | null;
}

const ANOMALY_LABELS: Record<string, string> = {
  UNCLASSIFIED: "ไม่พบในชีตประเมิน/ไม่ประเมิน",
  RESTORE_BEFORE_OUTAGE: "เวลาจ่ายไฟคืนก่อนเวลาไฟดับ",
  NEGATIVE_OR_ZERO_DURATION: "ระยะเวลาไฟดับผิดปกติ (<=0)",
  DURATION_MISMATCH: "ระยะเวลาไฟดับไม่ตรงกับเวลาที่คำนวณได้",
  MISSING_RESTORE_TIME: "ไม่มีเวลาจ่ายไฟคืน",
};

export function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);

  async function loadBatches() {
    const { data } = await apiClient.get<BatchSummary[]>("/uploads");
    setBatches(data);
  }

  useEffect(() => {
    loadBatches();
  }, []);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      await apiClient.post("/uploads", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFile(null);
      await loadBatches();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function viewAnomalies(batchId: string) {
    setSelectedBatch(batchId);
    const { data } = await apiClient.get(`/uploads/${batchId}`);
    setAnomalies(data.events);
  }

  async function review(batchId: string, decision: "APPROVED" | "REJECTED") {
    await apiClient.post(`/uploads/${batchId}/review`, { decision });
    await loadBatches();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold text-slate-800">อัปโหลดรายงาน 50</h1>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "กำลังประมวลผล..." : "อัปโหลด"}
          </button>
        </div>
        {error && <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">ประวัติการอัปโหลด</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="pb-2">ไฟล์</th>
              <th className="pb-2">ผู้อัปโหลด</th>
              <th className="pb-2">สถานะ</th>
              <th className="pb-2">SAIFI / SAIDI (ในไฟล์)</th>
              <th className="pb-2">ข้อมูลผิดปกติ</th>
              <th className="pb-2">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="py-2">{b.fileName}</td>
                <td className="py-2">{b.uploadedBy?.name}</td>
                <td className="py-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      b.status === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : b.status === "REJECTED"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="py-2">
                  {b.fileSaifiEvaluated?.toFixed(2) ?? "-"} / {b.fileSaidiEvaluated?.toFixed(1) ?? "-"}
                </td>
                <td className="py-2">
                  {b.anomalyCount > 0 ? (
                    <button onClick={() => viewAnomalies(b.id)} className="text-amber-700 underline">
                      {b.anomalyCount} รายการ
                    </button>
                  ) : (
                    <span className="text-slate-400">ไม่มี</span>
                  )}
                </td>
                <td className="py-2 space-x-2">
                  {b.status === "PENDING_REVIEW" && (
                    <>
                      <button onClick={() => review(b.id, "APPROVED")} className="text-green-700 underline">
                        อนุมัติ
                      </button>
                      <button onClick={() => review(b.id, "REJECTED")} className="text-red-700 underline">
                        ปฏิเสธ
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedBatch && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">รายการที่ต้องตรวจสอบ/แก้ไข</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="pb-2">เหตุการณ์</th>
                <th className="pb-2">วันที่/เวลาไฟดับ</th>
                <th className="pb-2">ฟีดเดอร์</th>
                <th className="pb-2">กฟฟ.</th>
                <th className="pb-2">ปัญหาที่พบ</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2">{a.eventNo}</td>
                  <td className="py-2">{new Date(a.outageAt).toLocaleString("th-TH")}</td>
                  <td className="py-2">{a.feederCode ?? "-"}</td>
                  <td className="py-2">{a.officeName ?? "-"}</td>
                  <td className="py-2 text-amber-700">
                    {(a.anomalyFlags ?? []).map((f) => ANOMALY_LABELS[f] ?? f).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
