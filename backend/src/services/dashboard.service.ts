import { prisma } from "../lib/prisma.js";
import type { TargetCategory } from "@prisma/client";
import { EVALUATED_TRUE_FILTER as EVALUATED_TRUE } from "./evaluation.service.js";

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
    where: { uploadBatchId: batch.id, ...EVALUATED_TRUE },
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
    where: { uploadBatchId: batch.id, ...EVALUATED_TRUE },
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
    where: { uploadBatchId: batch.id, ...EVALUATED_TRUE },
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
    where: { uploadBatchId: batch.id, ...EVALUATED_TRUE },
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

// Last day-of-month `month` (1-12) as a day offset from Jan 1 of `year`.
// Date.UTC(year, month, 0) rolls back to the last day of the *previous*
// 0-based month index, which is exactly the 1-based `month` we want.
function dayOffsetAtMonthEnd(year: number, month: number): number {
  return Math.round((Date.UTC(year, month, 0) - Date.UTC(year, 0, 1)) / 86400000);
}

function dayOffset(year: number, date: Date): number {
  return (date.getTime() - Date.UTC(year, 0, 1)) / 86400000;
}

export async function getCumulativeTrend(batchId?: string, category: TargetCategory = "GENERAL" as TargetCategory) {
  const batch = await resolveBatch(batchId);
  const totalCustomers = batch.totalCustomers ?? 0;
  const year = batch.periodEnd ? batch.periodEnd.getUTCFullYear() : new Date().getUTCFullYear();
  const lastActualMonth = batch.periodEnd ? batch.periodEnd.getUTCMonth() + 1 : 12;

  const events = await prisma.outageEvent.findMany({
    where: { uploadBatchId: batch.id, ...EVALUATED_TRUE },
    select: { outageAt: true, customersAffected: true, customerMinutes: true },
  });

  const byMonth = new Map<number, { affected: number; customerMinutes: number }>();
  for (const e of events) {
    const month = e.outageAt.getUTCMonth() + 1;
    const bucket = byMonth.get(month) ?? { affected: 0, customerMinutes: 0 };
    bucket.affected += e.customersAffected ?? 0;
    bucket.customerMinutes += e.customerMinutes ?? 0;
    byMonth.set(month, bucket);
  }

  const monthlyTargets = await prisma.monthlyTarget.findMany({ where: { year, category } });
  const targetByMonth = new Map(monthlyTargets.map((t) => [t.month, t]));

  let runningAffected = 0;
  let runningCustomerMinutes = 0;
  const rows = [];
  for (let month = 1; month <= 12; month++) {
    const hasActual = month <= lastActualMonth;
    if (hasActual) {
      const bucket = byMonth.get(month);
      runningAffected += bucket?.affected ?? 0;
      runningCustomerMinutes += bucket?.customerMinutes ?? 0;
    }
    const target = targetByMonth.get(month);
    rows.push({
      month,
      actualSaifi: hasActual && totalCustomers > 0 ? runningAffected / totalCustomers : null,
      actualSaidi: hasActual && totalCustomers > 0 ? runningCustomerMinutes / totalCustomers : null,
      targetSaifi: target?.cumulativeSaifiTarget ?? null,
      targetSaidi: target?.cumulativeSaidiTarget ?? null,
    });
  }

  return rows;
}

function interpolateCumulativeTarget(
  monthlyTargets: { month: number; cumulativeSaifiTarget: number; cumulativeSaidiTarget: number }[],
  year: number,
  targetDate: Date
): { saifi: number; saidi: number } | null {
  if (monthlyTargets.length === 0) return null;

  const points = [
    { day: 0, saifi: 0, saidi: 0 },
    ...monthlyTargets.map((t) => ({
      day: dayOffsetAtMonthEnd(year, t.month),
      saifi: t.cumulativeSaifiTarget,
      saidi: t.cumulativeSaidiTarget,
    })),
  ].sort((a, b) => a.day - b.day);

  const targetDay = dayOffset(year, targetDate);

  for (let i = 1; i < points.length; i++) {
    if (targetDay <= points[i].day) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const frac = p1.day === p0.day ? 0 : (targetDay - p0.day) / (p1.day - p0.day);
      return {
        saifi: p0.saifi + (p1.saifi - p0.saifi) * frac,
        saidi: p0.saidi + (p1.saidi - p0.saidi) * frac,
      };
    }
  }

  const last = points[points.length - 1];
  return { saifi: last.saifi, saidi: last.saidi };
}

// A simple linear run-rate projection: takes YTD actual SAIFI/SAIDI as of the
// batch's report date, divides by elapsed days to get a daily rate, and
// scales that rate out to whatever date the user asks about. It's a
// deliberately simple model (no seasonality) - good enough for "am I trending
// on pace" but not a substitute for real forecasting.
export async function getForecast(targetDateStr: string, batchId?: string, category: TargetCategory = "GENERAL" as TargetCategory) {
  const batch = await resolveBatch(batchId);
  if (!batch.periodEnd) throw new Error("ไฟล์นี้ไม่มีข้อมูลช่วงเวลา ไม่สามารถคำนวณการทำนายได้");

  const targetDate = new Date(targetDateStr);
  if (Number.isNaN(targetDate.getTime())) throw new Error("รูปแบบวันที่ไม่ถูกต้อง");

  const totalCustomers = batch.totalCustomers ?? 0;
  const year = batch.periodEnd.getUTCFullYear();

  const agg = await prisma.outageEvent.aggregate({
    where: { uploadBatchId: batch.id, ...EVALUATED_TRUE },
    _sum: { customersAffected: true, customerMinutes: true },
  });
  const actualSaifiAsOf = totalCustomers > 0 ? (agg._sum.customersAffected ?? 0) / totalCustomers : 0;
  const actualSaidiAsOf = totalCustomers > 0 ? (agg._sum.customerMinutes ?? 0) / totalCustomers : 0;

  const elapsedDays = dayOffset(year, batch.periodEnd);
  if (elapsedDays <= 0) throw new Error("ช่วงข้อมูลของไฟล์นี้สั้นเกินไปสำหรับการคำนวณอัตราเฉลี่ย");

  const dailySaifiRate = actualSaifiAsOf / elapsedDays;
  const dailySaidiRate = actualSaidiAsOf / elapsedDays;

  const targetDayOffset = dayOffset(year, targetDate);
  const forecastSaifi = dailySaifiRate * targetDayOffset;
  const forecastSaidi = dailySaidiRate * targetDayOffset;

  const monthlyTargets = await prisma.monthlyTarget.findMany({ where: { year, category } });
  const targetAtDate = interpolateCumulativeTarget(monthlyTargets, year, targetDate);

  return {
    asOfDate: batch.periodEnd,
    targetDate,
    actualSaifiAsOf,
    actualSaidiAsOf,
    forecastSaifi,
    forecastSaidi,
    targetSaifiAtDate: targetAtDate?.saifi ?? null,
    targetSaidiAtDate: targetAtDate?.saidi ?? null,
    saifiOnTrack: targetAtDate ? forecastSaifi <= targetAtDate.saifi : null,
    saidiOnTrack: targetAtDate ? forecastSaidi <= targetAtDate.saidi : null,
  };
}

export async function getWorstFeeders(batchId?: string, limit = 10) {
  const batch = await resolveBatch(batchId);

  const grouped = await prisma.outageEvent.groupBy({
    by: ["feederCode"],
    where: { uploadBatchId: batch.id, feederCode: { not: null }, ...EVALUATED_TRUE },
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
