import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

interface Target {
  id: string;
  year: number;
  category: string;
  saifiTarget: number;
  saidiTarget: number;
  maifiTarget: number | null;
}

interface MonthlyTarget {
  month: number;
  cumulativeSaifiTarget: number;
  cumulativeSaidiTarget: number;
}

const CATEGORIES = [
  { value: "GENERAL", label: "ทั่วไป" },
  { value: "INDUSTRIAL_ESTATE", label: "นิคมอุตสาหกรรม" },
  { value: "CITY_MUNICIPALITY", label: "เทศบาลนคร" },
  { value: "WORST4", label: "4 กฟฟ. ยอดแย่" },
];

const MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function emptyMonthRows(): Record<number, { saifi: string; saidi: string }> {
  const rows: Record<number, { saifi: string; saidi: string }> = {};
  for (let m = 1; m <= 12; m++) rows[m] = { saifi: "", saidi: "" };
  return rows;
}

export function Targets() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [year, setYear] = useState(new Date().getFullYear() + 543);
  const [category, setCategory] = useState("GENERAL");
  const [saifiTarget, setSaifiTarget] = useState("");
  const [saidiTarget, setSaidiTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const [monthRows, setMonthRows] = useState(emptyMonthRows());
  const [savingMonthly, setSavingMonthly] = useState(false);

  async function load() {
    const { data } = await apiClient.get<Target[]>("/targets");
    setTargets(data);
  }

  async function loadMonthly() {
    const { data } = await apiClient.get<MonthlyTarget[]>("/targets/monthly", { params: { year, category } });
    const rows = emptyMonthRows();
    for (const row of data) {
      rows[row.month] = {
        saifi: String(row.cumulativeSaifiTarget),
        saidi: String(row.cumulativeSaidiTarget),
      };
    }
    setMonthRows(rows);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadMonthly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, category]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.put("/targets", {
        year,
        category,
        saifiTarget: Number(saifiTarget),
        saidiTarget: Number(saidiTarget),
      });
      setSaifiTarget("");
      setSaidiTarget("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  function setMonthValue(month: number, field: "saifi" | "saidi", value: string) {
    setMonthRows((prev) => ({ ...prev, [month]: { ...prev[month], [field]: value } }));
  }

  async function handleSaveMonthly() {
    setSavingMonthly(true);
    try {
      const rows = Object.entries(monthRows)
        .filter(([, v]) => v.saifi !== "" && v.saidi !== "")
        .map(([month, v]) => ({
          month: Number(month),
          cumulativeSaifiTarget: Number(v.saifi),
          cumulativeSaidiTarget: Number(v.saidi),
        }));
      if (rows.length === 0) return;
      await apiClient.put("/targets/monthly/bulk", { year, category, rows });
      await loadMonthly();
    } finally {
      setSavingMonthly(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold text-slate-800">ตั้งค่าเป้าหมาย SAIFI / SAIDI</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-slate-600">ปี (พ.ศ.)</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">ประเภทพื้นที่</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">เป้า SAIFI ทั้งปี (ครั้ง/ราย)</label>
            <input
              type="number"
              step="0.01"
              value={saifiTarget}
              onChange={(e) => setSaifiTarget(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">เป้า SAIDI ทั้งปี (นาที/ราย)</label>
            <input
              type="number"
              step="0.01"
              value={saidiTarget}
              onChange={(e) => setSaidiTarget(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !saifiTarget || !saidiTarget}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          บันทึกเป้าหมายทั้งปี
        </button>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-slate-800">เป้าหมายสะสมรายเดือน</h2>
        <p className="mb-4 text-sm text-slate-500">
          กรอกค่าสะสม ณ สิ้นเดือน (ปี {year} · {CATEGORIES.find((c) => c.value === category)?.label}) เช่น ณ สิ้นเดือน ก.พ.
          ค่าสะสม SAIFI ไม่ควรเกิน 0.4 เป็นต้น
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="pb-2 pr-3">เดือน</th>
                <th className="pb-2 pr-3">SAIFI สะสม (ครั้ง/ราย)</th>
                <th className="pb-2">SAIDI สะสม (นาที/ราย)</th>
              </tr>
            </thead>
            <tbody>
              {MONTH_NAMES.map((name, idx) => {
                const month = idx + 1;
                return (
                  <tr key={month} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 text-slate-600">{name}</td>
                    <td className="py-1.5 pr-3">
                      <input
                        type="number"
                        step="0.01"
                        value={monthRows[month].saifi}
                        onChange={(e) => setMonthValue(month, "saifi", e.target.value)}
                        className="w-28 rounded border px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        value={monthRows[month].saidi}
                        onChange={(e) => setMonthValue(month, "saidi", e.target.value)}
                        className="w-28 rounded border px-2 py-1 text-sm"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          onClick={handleSaveMonthly}
          disabled={savingMonthly}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          บันทึกเป้าหมายรายเดือน
        </button>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">เป้าหมายทั้งปีที่ตั้งไว้</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="pb-2">ปี</th>
              <th className="pb-2">ประเภทพื้นที่</th>
              <th className="pb-2">SAIFI</th>
              <th className="pb-2">SAIDI</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2">{t.year}</td>
                <td className="py-2">{CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}</td>
                <td className="py-2">{t.saifiTarget}</td>
                <td className="py-2">{t.saidiTarget}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
