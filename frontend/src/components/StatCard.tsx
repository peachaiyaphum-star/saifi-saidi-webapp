import { useState } from "react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  status?: "ok" | "warn" | "neutral";
  editable?: boolean;
  onSave?: (newValue: number) => Promise<void>;
}

export function StatCard({ label, value, sub, status = "neutral", editable, onSave }: StatCardProps) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const badge =
    status === "ok"
      ? "bg-green-100 text-green-700"
      : status === "warn"
        ? "bg-red-100 text-red-700"
        : "bg-slate-100 text-slate-600";

  function startEdit() {
    setInput(value.replace(/,/g, ""));
    setEditing(true);
  }

  async function save() {
    const num = Number(input);
    if (!Number.isFinite(num) || num <= 0 || !onSave) return;
    setSaving(true);
    try {
      await onSave(num);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">{label}</div>
        {editable && !editing && (
          <button onClick={startEdit} className="text-xs text-blue-600 underline">
            แก้ไข
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-32 rounded border px-2 py-1 text-lg"
            autoFocus
          />
          <button onClick={save} disabled={saving} className="text-sm text-green-700 underline disabled:opacity-50">
            บันทึก
          </button>
          <button onClick={() => setEditing(false)} className="text-sm text-slate-500 underline">
            ยกเลิก
          </button>
        </div>
      ) : (
        <div className="mt-1 text-3xl font-semibold text-slate-800">{value}</div>
      )}
      {sub && !editing && <div className={`mt-2 inline-block rounded px-2 py-1 text-xs font-medium ${badge}`}>{sub}</div>}
    </div>
  );
}
