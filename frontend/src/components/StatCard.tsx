interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  status?: "ok" | "warn" | "neutral";
}

export function StatCard({ label, value, sub, status = "neutral" }: StatCardProps) {
  const badge =
    status === "ok"
      ? "bg-green-100 text-green-700"
      : status === "warn"
        ? "bg-red-100 text-red-700"
        : "bg-slate-100 text-slate-600";

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-800">{value}</div>
      {sub && <div className={`mt-2 inline-block rounded px-2 py-1 text-xs font-medium ${badge}`}>{sub}</div>}
    </div>
  );
}
