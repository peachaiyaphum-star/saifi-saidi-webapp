import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parseReport50 } from "../services/parser.service.js";
import { detectAnomalies } from "../services/anomaly.service.js";
import { computeEvaluated, EVALUATED_TRUE_FILTER, EVALUATED_FALSE_FILTER } from "../services/evaluation.service.js";
import { Prisma, Role } from "@prisma/client";

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// multer/busboy decode multipart headers as latin1 regardless of the actual
// charset, so a non-ASCII (e.g. Thai) filename comes through as mojibake.
// Re-interpreting those latin1 code units as the original UTF-8 bytes
// recovers the real filename.
function fixMultipartFilename(name: string): string {
  return Buffer.from(name, "latin1").toString("utf8");
}

uploadRouter.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN, Role.ENGINEER),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "กรุณาแนบไฟล์ 'รายงาน 50' (.xlsx หรือ .xls)" });
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
      const sheetEvaluated = parsed.evaluatedIds.has(idKey)
        ? true
        : parsed.notEvaluatedIds.has(idKey)
          ? false
          : null;
      // The ประเมิน/ไม่ประเมิน sheets (when present) are only a cross-check now -
      // computeEvaluated() is the authoritative SAIFI/SAIDI counting rule,
      // verified to reproduce those sheets exactly. See evaluation.service.ts.
      const evaluated = computeEvaluated(event);
      const flags = detectAnomalies(event, evaluated, sheetEvaluated);
      if (flags.length > 0) anomalyCount += 1;

      const customerMinutes =
        parsed.customerMinutesById.get(idKey) ??
        (event.customersAffected !== undefined && event.durationMinutes !== undefined
          ? event.customersAffected * event.durationMinutes
          : undefined);

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
        customerMinutes,
        evaluated,
        anomalyFlags: flags.length > 0 ? flags : Prisma.JsonNull,
      };
    });

    // Some file formats (the raw HTML export) don't carry a total-customer
    // count at all, unlike the xlsx export's embedded ผชฟ.ทั้งหมด figure.
    // Carry forward the most recent batch's total as a stand-in - it moves
    // slowly - rather than leaving SAIFI/SAIDI undivided (null).
    let totalCustomers = parsed.evaluatedSummary?.totalCustomers ?? parsed.notEvaluatedSummary?.totalCustomers;
    let totalCustomersSource: "file" | "carried_forward" | "none" = totalCustomers ? "file" : "none";
    if (!totalCustomers) {
      const lastBatch = await prisma.uploadBatch.findFirst({
        where: { totalCustomers: { not: null } },
        orderBy: { uploadedAt: "desc" },
      });
      if (lastBatch?.totalCustomers) {
        totalCustomers = lastBatch.totalCustomers;
        totalCustomersSource = "carried_forward";
      }
    }

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.uploadBatch.create({
        data: {
          fileName: fixMultipartFilename(req.file!.originalname),
          uploadedById: req.user!.id,
          region: parsed.meta.region,
          officesText: parsed.meta.officesText,
          periodStart: parsed.meta.periodStart,
          periodEnd: parsed.meta.periodEnd,
          fileSaifiEvaluated: parsed.evaluatedSummary?.saifi,
          fileSaidiEvaluated: parsed.evaluatedSummary?.saidi,
          fileSaifiNotEvaluated: parsed.notEvaluatedSummary?.saifi,
          fileSaidiNotEvaluated: parsed.notEvaluatedSummary?.saidi,
          totalCustomers,
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
      totalCustomersSource,
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

// Analyze page: browse every imported event for a batch (not just anomalies),
// filter by effective evaluated status, and page through it - a batch can
// have several thousand events, so this never returns the full set at once.
uploadRouter.get("/:id/events", requireAuth, async (req, res) => {
  const batch = await prisma.uploadBatch.findUnique({ where: { id: req.params.id } });
  if (!batch) return res.status(404).json({ error: "ไม่พบข้อมูลไฟล์นี้" });

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
  const evaluatedFilter = typeof req.query.evaluatedFilter === "string" ? req.query.evaluatedFilter : "all";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const and: Prisma.OutageEventWhereInput[] = [{ uploadBatchId: batch.id }];
  if (evaluatedFilter === "true") and.push(EVALUATED_TRUE_FILTER);
  else if (evaluatedFilter === "false") and.push(EVALUATED_FALSE_FILTER);
  else if (evaluatedFilter === "overridden") and.push({ evaluatedOverride: { not: null } });

  if (search) {
    const searchOr: Prisma.OutageEventWhereInput[] = [
      { feederCode: { contains: search, mode: "insensitive" } },
      { officeName: { contains: search, mode: "insensitive" } },
      { subCause: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ];
    if (/^\d+$/.test(search)) {
      try {
        searchOr.push({ eventNo: BigInt(search) });
      } catch {
        // ignore - too large to be a BigInt, just skip the exact-match branch
      }
    }
    and.push({ OR: searchOr });
  }

  const where: Prisma.OutageEventWhereInput = { AND: and };

  const [total, events] = await Promise.all([
    prisma.outageEvent.count({ where }),
    prisma.outageEvent.findMany({
      where,
      orderBy: [{ outageAt: "asc" }, { sequenceNo: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    page,
    pageSize,
    total,
    events: events.map((e) => ({ ...e, effectiveEvaluated: e.evaluatedOverride ?? e.evaluated })),
  });
});

uploadRouter.post(
  "/:id/events/:eventId/override",
  requireAuth,
  requireRole(Role.ADMIN, Role.ENGINEER),
  async (req, res) => {
    const { evaluated } = req.body as { evaluated: boolean | null };
    if (evaluated !== null && typeof evaluated !== "boolean") {
      return res.status(400).json({ error: "evaluated ต้องเป็น true, false, หรือ null (ล้างค่า)" });
    }

    const event = await prisma.outageEvent.findFirst({
      where: { id: req.params.eventId, uploadBatchId: req.params.id },
    });
    if (!event) return res.status(404).json({ error: "ไม่พบเหตุการณ์นี้ในไฟล์ที่ระบุ" });

    const updated = await prisma.outageEvent.update({
      where: { id: event.id },
      data: {
        evaluatedOverride: evaluated,
        overriddenById: evaluated === null ? null : req.user!.id,
        overriddenAt: evaluated === null ? null : new Date(),
      },
    });

    res.json({ ...updated, effectiveEvaluated: updated.evaluatedOverride ?? updated.evaluated });
  }
);
