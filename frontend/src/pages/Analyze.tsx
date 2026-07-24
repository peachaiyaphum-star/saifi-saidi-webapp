import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

interface BatchOption {
  id: string;
  fileName: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  uploadedAt: string;
}

interface EventRow {
  id: string;
  eventNo: string;
  outageAt: string;
  feederCode: string | null;
  officeName: string | null;
  subCause: string | null;
  status: string | null;
  eventType: string | null;
  customersAffected: number | null;
  evaluated: boolean;
  evaluatedOverride: boolean | null;
  effectiveEvaluated: boolean;
  anomalyFlags: string[] | null;
}

const FILTERS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "true", label: "ประเมิน" },
  { value: "false", label: "ไม่ประเมิน" },
  { value: "overridden", label: "ปรับด้วยมือ" },
];

export function Analyze() {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchId, setBatchId] = useState<string>("");
  const [evaluatedFilter, setEvaluatedFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [events, setEvents] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await apiClient.get<BatchOption[]>("/uploads");
      setBatches(data);
      if (data.length > 0) {
        const approved = data.find((b) => b.status === "APPROVED");
        setBatchId((approved ?? data[0]).id);
      }
    })();
  }, []);

  async function loadEvents() {
    if (!batchId) return;
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/uploads/${batchId}/events`, {
        params: { page, pageSize, evaluatedFilter, search: search || undefined },
      });
      setEvents(data.events);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, evaluatedFilter, search, page]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function setEvaluated(eventId: string, value: boolean) {
    setSavingId(eventId);
    try {
      await apiClient.post(`/uploads/${batchId}/events/${eventId}/override`, { evaluated: value });
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId ? { ...ev, evaluatedOverride: value, effectiveEvaluated: value } : ev
        )
      );
    } finally {
      setSavingId(null);
    }
  }

  async function resetToAuto(eventId: string) {
    setSavingId(eventId);
    try {
      await apiClient.post(`/uploads/${batchId}/events/${eventId}/override`, { evaluated: null });
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId ? { ...ev, evaluatedOverride: null, effectiveEvaluated: ev.evaluated } : ev
        )
      );
    } finally {
      setSavingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold text-slate-800">วิเคราะห์รายการที่นำเข้า</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-slate-600">ไฟล์</label>
            <select
              value={batchId}
              onChange={(e) => {
                setBatchId(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.fileName} ({b.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">สถานะประเมิน</label>
            <select
              value={evaluatedFilter}
              onChange={(e) => {
                setEvaluatedFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <form onSubmit={handleSearchSubmit} className="sm:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">ค้นหา (ฟีดเดอร์ / กฟฟ. / สาเหตุ / หมายเลขเหตุการณ์)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                ค้นหา
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
          <span>{loading ? "กำลังโหลด..." : `รวม ${total.toLocaleString()} รายการ`}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border px-2 py-1 disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <span>
              หน้า {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded border px-2 py-1 disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="pb-2 pr-3">ประเมิน</th>
                <th className="pb-2 pr-3">เหตุการณ์</th>
                <th className="pb-2 pr-3">วันที่/เวลาไฟดับ</th>
                <th className="pb-2 pr-3">ฟีดเดอร์</th>
                <th className="pb-2 pr-3">กฟฟ.</th>
                <th className="pb-2 pr-3">สาเหตุย่อย</th>
                <th className="pb-2 pr-3">สถานะ</th>
                <th className="pb-2 pr-3">ผชฟ.ถูกกระทบ</th>
                <th className="pb-2 pr-3">ผลระบบ</th>
                <th className="pb-2">การตรวจสอบ</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-3">
                    <input
                      type="checkbox"
                      checked={ev.effectiveEvaluated}
                      disabled={savingId === ev.id}
                      onChange={(e) => setEvaluated(ev.id, e.target.checked)}
                    />
                  </td>
                  <td className="py-1.5 pr-3 text-slate-600">{ev.eventNo}</td>
                  <td className="py-1.5 pr-3">{new Date(ev.outageAt).toLocaleString("th-TH")}</td>
                  <td className="py-1.5 pr-3">{ev.feederCode ?? "-"}</td>
                  <td className="py-1.5 pr-3">{ev.officeName ?? "-"}</td>
                  <td className="py-1.5 pr-3">{ev.subCause ?? "-"}</td>
                  <td className="py-1.5 pr-3">{ev.status ?? "-"}</td>
                  <td className="py-1.5 pr-3">{ev.customersAffected?.toLocaleString() ?? "-"}</td>
                  <td className="py-1.5 pr-3">
                    <span className={ev.evaluated ? "text-green-700" : "text-slate-400"}>
                      {ev.evaluated ? "ประเมิน" : "ไม่ประเมิน"}
                    </span>
                  </td>
                  <td className="py-1.5">
                    {ev.evaluatedOverride !== null ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          ปรับด้วยมือ
                        </span>
                        <button
                          onClick={() => resetToAuto(ev.id)}
                          disabled={savingId === ev.id}
                          className="text-xs text-blue-600 underline"
                        >
                          รีเซ็ตเป็นอัตโนมัติ
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">ตามระบบ</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
