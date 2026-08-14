import type { ParsedEventRow } from "./parser.service.js";
import { EXCLUDED_STATUSES } from "./evaluation.service.js";

export type AnomalyCode =
  | "SHEET_RULE_MISMATCH" // file's own ประเมิน/ไม่ประเมิน classification disagrees with the computed rule
  | "RESTORE_BEFORE_OUTAGE"
  | "NEGATIVE_OR_ZERO_DURATION"
  | "DURATION_MISMATCH"
  | "MISSING_RESTORE_TIME";

const DURATION_MISMATCH_TOLERANCE_MINUTES = 5;

export function detectAnomalies(
  event: ParsedEventRow,
  ruleEvaluated: boolean,
  sheetEvaluated: boolean | null
): AnomalyCode[] {
  const flags: AnomalyCode[] = [];

  if (sheetEvaluated !== null && sheetEvaluated !== ruleEvaluated) flags.push("SHEET_RULE_MISMATCH");

  if (event.restoreFullAt && event.restoreFullAt.getTime() < event.outageAt.getTime()) {
    flags.push("RESTORE_BEFORE_OUTAGE");
  }

  // Zero duration is normal for T/R, TR1, TR2 - those are automatic
  // protection operations that clear within a second by design (verified
  // against real รายงาน 52 data: 3190 of 3250 zero-duration rows were
  // exactly these statuses). Flagging them just buried the ~60 zero-duration
  // rows on statuses like Operate/D/F that are worth a human looking at.
  const isTransientStatus = event.status !== undefined && EXCLUDED_STATUSES.has(event.status);
  if (event.durationMinutes !== undefined && event.durationMinutes <= 0 && !isTransientStatus) {
    flags.push("NEGATIVE_OR_ZERO_DURATION");
  }

  if (!event.restoreFirstAt && !event.restoreFullAt) {
    flags.push("MISSING_RESTORE_TIME");
  }

  if (event.durationMinutes !== undefined && event.restoreFullAt) {
    const computedMinutes = (event.restoreFullAt.getTime() - event.outageAt.getTime()) / 60000;
    if (Math.abs(computedMinutes - event.durationMinutes) > DURATION_MISMATCH_TOLERANCE_MINUTES) {
      flags.push("DURATION_MISMATCH");
    }
  }

  return flags;
}
