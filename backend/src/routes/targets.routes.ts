import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { Role, TargetCategory } from "@prisma/client";

export const targetsRouter = Router();

targetsRouter.use(requireAuth);

// Target.year is stored as Gregorian, matching OutageEvent/UploadBatch dates
// (see the BE-year comment in parser.service.ts), but the UI's "ปี (พ.ศ.)"
// field is Buddhist Era, so it's converted at this API boundary in both
// directions rather than asking the frontend to do date-system math.
const BE_OFFSET = 543;
const beToCe = (year: number) => (year > 2400 ? year - BE_OFFSET : year);
const ceToBe = (year: number) => (year < 2400 ? year + BE_OFFSET : year);

targetsRouter.get("/", asyncHandler(async (_req, res) => {
  const targets = await prisma.target.findMany({ orderBy: [{ year: "desc" }, { category: "asc" }] });
  res.json(targets.map((t) => ({ ...t, year: ceToBe(t.year) })));
}));

const upsertSchema = z.object({
  year: z.number().int().min(2000).max(3000),
  category: z.nativeEnum(TargetCategory),
  saifiTarget: z.number().nonnegative(),
  saidiTarget: z.number().nonnegative(),
  maifiTarget: z.number().nonnegative().optional(),
});

targetsRouter.put("/", requireRole(Role.ADMIN), asyncHandler(async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { category, saifiTarget, saidiTarget, maifiTarget } = parsed.data;
  const year = beToCe(parsed.data.year);

  const target = await prisma.target.upsert({
    where: { year_category: { year, category } },
    create: { year, category, saifiTarget, saidiTarget, maifiTarget, createdById: req.user!.id },
    update: { saifiTarget, saidiTarget, maifiTarget },
  });

  res.json({ ...target, year: ceToBe(target.year) });
}));

targetsRouter.get("/monthly", asyncHandler(async (req, res) => {
  const year = beToCe(Number(req.query.year));
  const category = (req.query.category as TargetCategory) ?? TargetCategory.GENERAL;
  if (!Number.isFinite(year)) {
    return res.status(400).json({ error: "year ไม่ถูกต้อง" });
  }

  const rows = await prisma.monthlyTarget.findMany({
    where: { year, category },
    orderBy: { month: "asc" },
  });
  res.json(rows.map((r) => ({ ...r, year: ceToBe(r.year) })));
}));

const monthlyRowSchema = z.object({
  month: z.number().int().min(1).max(12),
  cumulativeSaifiTarget: z.number().nonnegative(),
  cumulativeSaidiTarget: z.number().nonnegative(),
});

const bulkMonthlySchema = z.object({
  year: z.number().int().min(2000).max(3000),
  category: z.nativeEnum(TargetCategory),
  rows: z.array(monthlyRowSchema).min(1).max(12),
});

targetsRouter.put("/monthly/bulk", requireRole(Role.ADMIN), asyncHandler(async (req, res) => {
  const parsed = bulkMonthlySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { category, rows } = parsed.data;
  const year = beToCe(parsed.data.year);

  const saved = await prisma.$transaction(
    rows.map((row) =>
      prisma.monthlyTarget.upsert({
        where: { year_month_category: { year, month: row.month, category } },
        create: {
          year,
          month: row.month,
          category,
          cumulativeSaifiTarget: row.cumulativeSaifiTarget,
          cumulativeSaidiTarget: row.cumulativeSaidiTarget,
          createdById: req.user!.id,
        },
        update: {
          cumulativeSaifiTarget: row.cumulativeSaifiTarget,
          cumulativeSaidiTarget: row.cumulativeSaidiTarget,
        },
      })
    )
  );

  res.json(saved.map((r) => ({ ...r, year: ceToBe(r.year) })));
}));
