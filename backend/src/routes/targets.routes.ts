import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
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

targetsRouter.get("/", async (_req, res) => {
  const targets = await prisma.target.findMany({ orderBy: [{ year: "desc" }, { category: "asc" }] });
  res.json(targets.map((t) => ({ ...t, year: ceToBe(t.year) })));
});

const upsertSchema = z.object({
  year: z.number().int().min(2000).max(3000),
  category: z.nativeEnum(TargetCategory),
  saifiTarget: z.number().nonnegative(),
  saidiTarget: z.number().nonnegative(),
  maifiTarget: z.number().nonnegative().optional(),
});

targetsRouter.put("/", requireRole(Role.ADMIN), async (req, res) => {
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
});
