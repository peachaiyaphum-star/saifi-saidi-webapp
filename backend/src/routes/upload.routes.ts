import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parseReport50 } from "../services/parser.service.js";
import { detectAnomalies } from "../services/anomaly.service.js";
import { Prisma, Role } from "@prisma/client";

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

uploadRouter.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN, Role.ENGINEER),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "กรุณาแนบไฟล์ 'รายงาน 50' (.xlsx)" });
    }

    let parsed;
    try {
      parsed = parseReport50(req.file.buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "ไม่สามารถอ่านไฟล์ได้";
      return res.status(422).json({ error: message });
    }

    if (parsed.events.length === 0) {
      return res.status(422).json({ error: "ไม่พบข้อมูลเหตุการณ์ไฟฟ้าขัดข้องในไฟล์นี้" });
    }

    let anomalyCount = 0;
    const eventRows = parsed.events.map((event) => {
      const idKey = event.eventNo.toString();
      const evaluated = parsed.evaluatedIds.has(idKey)
        ? true
        : parsed.notEvaluatedIds.has(idKey)
          ? false
          : null;
      const flags = detectAnomalies(event, evaluated);
      if (flags.length > 0) anomalyCount += 1;

      return {
        eventNo: event.eventNo,
        sequenceNo: event.sequenceNo,
        outageAt: event.outageAt,
        restoreFirstAt: event.restoreFirstAt,
        restoreFullAt: event.restoreFullAt,
        durationMinutes: event.durationMinutes,
        equipmentCode: event.equipmentCode,
        feederCode: event.feederCode,
        status: event.status,
        phase: event.phase,
        subCause: event.subCause,
        causeKnown: event.causeKnown,
        officeName: event.officeName,
        weather: event.weather,
        customersAffected: event.customersAffected,
        location: event.location,
        repairDetail: event.repairDetail,
        loadMw: event.loadMw,
        eventType: event.eventType,
        customerMinutes: parsed.customerMinutesById.get(idKey),
        evaluated,
        anomalyFlags: flags.length > 0 ? flags : Prisma.JsonNull,
      };
    });

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.uploadBatch.create({
        data: {
          fileName: req.file!.originalname,
          uploadedById: req.user!.id,
          region: parsed.meta.region,
          officesText: parsed.meta.officesText,
          periodStart: parsed.meta.periodStart,
          periodEnd: parsed.meta.periodEnd,
          fileSaifiEvaluated: parsed.evaluatedSummary?.saifi,
          fileSaidiEvaluated: parsed.evaluatedSummary?.saidi,
          fileSaifiNotEvaluated: parsed.notEvaluatedSummary?.saifi,
          fileSaidiNotEvaluated: parsed.notEvaluatedSummary?.saidi,
          totalCustomers: parsed.evaluatedSummary?.totalCustomers ?? parsed.notEvaluatedSummary?.totalCustomers,
          anomalyCount,
        },
      });

      await tx.outageEvent.createMany({
        data: eventRows.map((row) => ({ ...row, uploadBatchId: created.id })),
      });

      return created;
    });

    res.status(201).json({
      batchId: batch.id,
      eventsImported: eventRows.length,
      anomalyCount,
      meta: parsed.meta,
      evaluatedSummary: parsed.evaluatedSummary,
      notEvaluatedSummary: parsed.notEvaluatedSummary,
    });
  }
);

uploadRouter.get("/", requireAuth, async (_req, res) => {
  const batches = await prisma.uploadBatch.findMany({
    orderBy: { uploadedAt: "desc" },
    include: { uploadedBy: { select: { name: true, email: true } } },
  });
  res.json(batches);
});

uploadRouter.get("/:id", requireAuth, async (req, res) => {
  const batch = await prisma.uploadBatch.findUnique({
    where: { id: req.params.id },
    include: {
      uploadedBy: { select: { name: true, email: true } },
      events: { where: { anomalyFlags: { not: Prisma.JsonNull } } },
    },
  });
  if (!batch) return res.status(404).json({ error: "ไม่พบข้อมูลไฟล์นี้" });
  res.json(batch);
});

uploadRouter.post(
  "/:id/review",
  requireAuth,
  requireRole(Role.ADMIN, Role.ENGINEER),
  async (req, res) => {
    const { decision, notes } = req.body as { decision: "APPROVED" | "REJECTED"; notes?: string };
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return res.status(400).json({ error: "decision ต้องเป็น APPROVED หรือ REJECTED" });
    }

    const batch = await prisma.uploadBatch.update({
      where: { id: req.params.id },
      data: {
        status: decision,
        notes,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
    });

    res.json(batch);
  }
);
