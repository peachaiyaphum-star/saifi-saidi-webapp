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

const CATEGORIES = [
  { value: "GENERAL", label: "ทั่วไป" },
  { value: "INDUSTRIAL_ESTATE", label: "นิคมอุตสาหกรรม" },
  { value: "CITY_MUNICIPALITY", label: "เทศบาลนคร" },
  { value: "WORST4", label: "4 กฟฟ. ยอดแย่" },
];

export function Targets() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [year, setYear] = useState(new Date().getFullYear() + 543);
  const [category, setCategory] = useState("GENERAL");
  const [saifiTarget, setSaifiTarget] = useState("");
  const [saidiTarget, setSaidiTarget] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await apiClient.get<Target[]>("/targets");
    setTargets(data);
  }

  useEffect(() => {
    load();
  }, []);

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
            <label className="mb-1 block text-sm text-slate-600">เป้า SAIFI (ครั้ง/ราย)</label>
            <input
              type="number"
              step="0.01"
              value={saifiTarget}
              onChange={(e) => setSaifiTarget(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">เป้า SAIDI (นาที/ราย)</label>
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
          บันทึก
        </button>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">เป้าหมายที่ตั้งไว้</h2>
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
