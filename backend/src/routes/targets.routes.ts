import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Role, TargetCategory } from "@prisma/client";

export const targetsRouter = Router();

targetsRouter.use(requireAuth);

targetsRouter.get("/", async (_req, res) => {
  const targets = await prisma.target.findMany({ orderBy: [{ year: "desc" }, { category: "asc" }] });
  res.json(targets);
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
  const { year, category, saifiTarget, saidiTarget, maifiTarget } = parsed.data;

  const target = await prisma.target.upsert({
    where: { year_category: { year, category } },
    create: { year, category, saifiTarget, saidiTarget, maifiTarget, createdById: req.user!.id },
    update: { saifiTarget, saidiTarget, maifiTarget },
  });

  res.json(target);
});
