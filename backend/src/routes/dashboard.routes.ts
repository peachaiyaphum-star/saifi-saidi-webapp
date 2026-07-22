import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getExecutiveSummary,
  getMonthlyTrend,
  getCauseBreakdown,
  getAreaBreakdown,
  getWorstFeeders,
} from "../services/dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

function batchIdFrom(req: import("express").Request) {
  const id = req.query.batchId;
  return typeof id === "string" ? id : undefined;
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
