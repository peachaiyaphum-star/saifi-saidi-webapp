import type { Prisma } from "@prisma/client";
import type { ParsedEventRow } from "./parser.service.js";

// A human review on the Analyze page (evaluatedOverride) always wins over the
// computed rule (evaluated) below - shared by the dashboard aggregations and
// the Analyze page's list/filter endpoint so "evaluated" means the same
// thing everywhere.
export const EVALUATED_TRUE_FILTER: Prisma.OutageEventWhereInput = {
  OR: [{ evaluatedOverride: true }, { AND: [{ evaluatedOverride: null }, { evaluated: true }] }],
};

export const EVALUATED_FALSE_FILTER: Prisma.OutageEventWhereInput = {
  OR: [{ evaluatedOverride: false }, { AND: [{ evaluatedOverride: null }, { evaluated: false }] }],
};

/**
 * PEA's SAIFI/SAIDI counting rule for "รายงาน 50" events, as specified by
 * the user (not derivable from the report file itself - some file formats,
 * e.g. the raw HTML export, don't carry a precomputed ประเมิน/ไม่ประเมิน
 * split at all, so this is the single source of truth for both formats).
 *
 * An event counts toward SAIFI/SAIDI only if ALL of the following hold:
 *   1. ประเภทเหตุการณ์ (event type) is exactly "ไฟฟ้าขัดข้อง"
 *   2. กฟฟ.รับผิดชอบ (responsible office) is one of the 11 offices in scope
 *   3. สาเหตุย่อย (sub-cause) is not one of the excluded force-majeure /
 *      natural-disaster / non-real-event / severe-accident causes
 *   4. สถานะ (status) is not T/R, T/R1, or T/R2
 */

const INCLUDED_EVENT_TYPE = "ไฟฟ้าขัดข้อง";

const INCLUDED_OFFICES = new Set([
  "กฟจ.ชัยภูมิ",
  "กฟอ.หนองบัวแดง",
  "กฟอ.บำเหน็จณรงค์",
  "กฟอ.ภักดีชุมพล",
  "กฟอ.คอนสวรรค์",
  "กฟอ.จัตุรัส",
  "กฟย.อ.เนินสง่า", // spelled "กฟอ.เนินสง่า" in the request, but the actual report data uses this form
  "กฟอ.หนองบัวระเหว",
  "กฟอ.เทพสถิตย์",
  "กฟอ.บ้านเขว้า",
  "กฟอ.แก้งคร้อ",
]);

export const EXCLUDED_SUB_CAUSES = new Set([
  // เหตุสุดวิสัย
  "สงคราม/จลาจล",
  "สุดวิสัยเกินกว่าเกณฑ์/มาตรฐานที่ กฟภ. กำหนด",
  // แหล่งจ่ายผลิตขัดข้อง
  "แหล่งจ่ายไฟฟ้าจากหน่วยงานภายนอกขัดข้อง",
  "กำลังผลิตโรงไฟฟ้าลดลง/Blackout (UF Relay)",
  // ไม่ใช่เหตุการณ์จริง
  "ไม่ใช่เหตุการณ์จริง",
  // ภัยธรรมชาติ
  "แผ่นดินไหว",
  "ไฟป่าจากภัยธรรมชาติ",
  "คลื่นยักษ์ (สึนามิ)",
  "ดินถล่ม/โคลนถล่ม",
  "น้ำท่วม (อุทกภัย)",
  "พายุโซนร้อน/ใต้ฝุ่น",
  "พายุฤดูร้อน/พายุดีเปรสชั่น",
  "ลูกเห็บ",
  // อุบัติเหตุร้ายแรง
  "โรงงานระเบิด",
  "ไฟดับบริเวณกว้างจากยานพาหนะ",
]);

// The report data itself is inconsistent here: the base code keeps its
// slash ("T/R") but the numbered variants drop it ("TR1", "TR2") - verified
// against real report data, not just the requested "T/R, T/R1, T/R2".
export const EXCLUDED_STATUSES = new Set(["T/R", "TR1", "TR2"]);

export function computeEvaluated(event: ParsedEventRow): boolean {
  if (event.eventType !== INCLUDED_EVENT_TYPE) return false;
  if (!event.officeName || !INCLUDED_OFFICES.has(event.officeName)) return false;
  if (event.subCause && EXCLUDED_SUB_CAUSES.has(event.subCause)) return false;
  if (event.status && EXCLUDED_STATUSES.has(event.status)) return false;
  return true;
}

/**
 * SAIFI/SAIDI counting rule for "รายงาน 52" rows (one row per event x
 * affected site, from a different source system than รายงาน 50). It reuses
 * the exact same excluded sub-cause and status sets - verified against real
 * data that รายงาน 52 uses the identical cause taxonomy and status codes -
 * but the area-scope check differs: รายงาน 52 rows carry an AffectedAreaID
 * that's uniformly "NE3_P" across every in-scope row, so that's used
 * directly instead of matching against a name whitelist (avoiding a repeat
 * of the "กฟย.อ." vs "กฟอ." spelling mismatch already hit once with
 * รายงาน 50's office names).
 */
const REPORT52_INCLUDED_AREA_ID = "NE3_P";

export function computeEvaluatedReport52(row: {
  subCause?: string;
  status?: string;
  affectedAreaId?: string;
}): boolean {
  if (row.affectedAreaId !== REPORT52_INCLUDED_AREA_ID) return false;
  if (row.subCause && EXCLUDED_SUB_CAUSES.has(row.subCause)) return false;
  if (row.status && EXCLUDED_STATUSES.has(row.status)) return false;
  return true;
}
