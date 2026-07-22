import { prisma } from "../lib/prisma.js";

/**
 * A "รายงาน 50" upload is a year-to-date cumulative export (from Jan 1 of the
 * report year through the upload date), not an incremental daily/monthly diff.
 * So the dashboard doesn't sum across batches - it reads event-level detail
 * from a single batch (the latest approved one, by default) and groups by
 * month/office/feeder/cause to build the trend and breakdown views.
 */

async function resolveBatch(batchId?: string) {
  if (batchId) {
    const batch = await prisma.uploadBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error("ไม่พบไฟล์ที่ระบุ");
    return batch;
  }

  const approved = await prisma.uploadBatch.findFirst({
    where: { status: "APPROVED" },
    orderBy: { uploadedAt: "desc" },
  });
  if (approved) return approved;

  const latest = await prisma.uploadBatch.findFirst({ orderBy: { uploadedAt: "desc" } });
  if (!latest) throw new Error("ยังไม่มีการอัปโหลดรายงาน 50");
  return latest;
}

export async function getExecutiveSummary(batchId?: string) {
  const batch = await resolveBatch(batchId);
  const totalCustomers = batch.totalCustomers ?? 0;

  const agg = await prisma.outageEvent.aggregate({
    where: { uploadBatchId: batch.id, evaluated: true },
    _sum: { customersAffected: true, customerMinutes: true },
    _count: true,
  });

  const affected = agg._sum.customersAffected ?? 0;
  const customerMinutes = agg._sum.customerMinutes ?? 0;

  const saifi = totalCustomers > 0 ? affected / totalCustomers : null;
  const saidi = totalCustomers > 0 ? customerMinutes / totalCustomers : null;
  const year = batch.periodEnd ? batch.periodEnd.getFullYear() : new Date().getFullYear();

  const target = await prisma.target.findFirst({ where: { year, category: "GENERAL" } });

  return {
    batchId: batch.id,
    fileName: batch.fileName,
    periodStart: batch.periodStart,
    periodEnd: batch.periodEnd,
    totalCustomers,
    eventCount: agg._count,
    saifi,
    saidi,
    fileSaifiEvaluated: batch.fileSaifiEvaluated,
    fileSaidiEvaluated: batch.fileSaidiEvaluated,
    target: target ? { saifiTarget: target.saifiTarget, saidiTarget: target.saidiTarget } : null,
    saifiWithinTarget: target && saifi !== null ? saifi <= target.saifiTarget : null,
    saidiWithinTarget: target && saidi !== null ? saidi <= target.saidiTarget : null,
  };
}

export async function getMonthlyTrend(batchId?: string) {
  const batch = await resolveBatch(batchId);
  const totalCustomers = batch.totalCustomers ?? 0;

  const events = await prisma.outageEvent.findMany({
    where: { uploadBatchId: batch.id, evaluated: true },
    select: { outageAt: true, customersAffected: true, customerMinutes: true },
  });

  const byMonth = new Map<string, { affected: number; customerMinutes: number; events: number }>();
  for (const e of events) {
    const key = `${e.outageAt.getFullYear()}-${String(e.outageAt.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byMonth.get(key) ?? { affected: 0, customerMinutes: 0, events: 0 };
    bucket.affected += e.customersAffected ?? 0;
    bucket.customerMinutes += e.customerMinutes ?? 0;
    bucket.events += 1;
    byMonth.set(key, bucket);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      eventCount: v.events,
      saifi: totalCustomers > 0 ? v.affected / totalCustomers : null,
      saidi: totalCustomers > 0 ? v.customerMinutes / totalCustomers : null,
    }));
}

export async function getCauseBreakdown(batchId?: string) {
  const batch = await resolveBatch(batchId);

  const grouped = await prisma.outageEvent.groupBy({
    by: ["subCause"],
    where: { uploadBatchId: batch.id, evaluated: true },
    _sum: { customerMinutes: true, customersAffected: true },
    _count: true,
  });

  return grouped
    .map((g) => ({
      cause: g.subCause ?? "ไม่ระบุ",
      eventCount: g._count,
      customersAffected: g._sum.customersAffected ?? 0,
      customerMinutes: g._sum.customerMinutes ?? 0,
    }))
    .sort((a, b) => b.customerMinutes - a.customerMinutes);
}

export async function getAreaBreakdown(batchId?: string) {
  const batch = await resolveBatch(batchId);

  const grouped = await prisma.outageEvent.groupBy({
    by: ["officeName"],
    where: { uploadBatchId: batch.id, evaluated: true },
    _sum: { customerMinutes: true, customersAffected: true },
    _count: true,
  });

  return grouped
    .map((g) => ({
      office: g.officeName ?? "ไม่ระบุ",
      eventCount: g._count,
      customersAffected: g._sum.customersAffected ?? 0,
      customerMinutes: g._sum.customerMinutes ?? 0,
    }))
    .sort((a, b) => b.customerMinutes - a.customerMinutes);
}

export async function getWorstFeeders(batchId?: string, limit = 10) {
  const batch = await resolveBatch(batchId);

  const grouped = await prisma.outageEvent.groupBy({
    by: ["feederCode"],
    where: { uploadBatchId: batch.id, evaluated: true, feederCode: { not: null } },
    _sum: { customerMinutes: true, customersAffected: true },
    _count: true,
  });

  return grouped
    .map((g) => ({
      feeder: g.feederCode as string,
      eventCount: g._count,
      customersAffected: g._sum.customersAffected ?? 0,
      customerMinutes: g._sum.customerMinutes ?? 0,
    }))
    .sort((a, b) => b.customerMinutes - a.customerMinutes)
    .slice(0, limit);
}
