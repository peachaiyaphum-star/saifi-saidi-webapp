import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { TargetCategory } from "@prisma/client";
import {
  getExecutiveSummary,
  getMonthlyTrend,
  getCauseBreakdown,
  getAreaBreakdown,
  getWorstFeeders,
  getCumulativeTrend,
  getForecast,
} from "../services/dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

function batchIdFrom(req: import("express").Request) {
  const id = req.query.batchId;
  return typeof id === "string" ? id : undefined;
}

function categoryFrom(req: import("express").Request): TargetCategory {
  const c = req.query.category;
  return typeof c === "string" && c in TargetCategory ? (c as TargetCategory) : TargetCategory.GENERAL;
}

dashboardRouter.get("/summary", async (req, res) => {
  try {
    res.json(await getExecutiveSummary(batchIdFrom(req)));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

dashboardRouter.get("/trend", async (req, res) => {
  try {
    res.json(await getMonthlyTrend(batchIdFrom(req)));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

dashboardRouter.get("/causes", async (req, res) => {
  try {
    res.json(await getCauseBreakdown(batchIdFrom(req)));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

dashboardRouter.get("/areas", async (req, res) => {
  try {
    res.json(await getAreaBreakdown(batchIdFrom(req)));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

dashboardRouter.get("/worst-feeders", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    res.json(await getWorstFeeders(batchIdFrom(req), limit));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

dashboardRouter.get("/cumulative-trend", async (req, res) => {
  try {
    res.json(await getCumulativeTrend(batchIdFrom(req), categoryFrom(req)));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

dashboardRouter.get("/forecast", async (req, res) => {
  const date = req.query.date;
  if (typeof date !== "string") {
    return res.status(400).json({ error: "ต้องระบุวันที่ (date)" });
  }
  try {
    res.json(await getForecast(date, batchIdFrom(req), categoryFrom(req)));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "คำนวณไม่สำเร็จ" });
  }
});
