import type { ParsedEventRow } from "./parser.service.js";

export type AnomalyCode =
  | "UNCLASSIFIED" // event not found in either "ประเมิน" or "ไม่ประเมิน" sheet
  | "RESTORE_BEFORE_OUTAGE"
  | "NEGATIVE_OR_ZERO_DURATION"
  | "DURATION_MISMATCH"
  | "MISSING_RESTORE_TIME";

const DURATION_MISMATCH_TOLERANCE_MINUTES = 5;

export function detectAnomalies(
  event: ParsedEventRow,
  evaluated: boolean | null
): AnomalyCode[] {
  const flags: AnomalyCode[] = [];

  if (evaluated === null) flags.push("UNCLASSIFIED");

  if (event.restoreFullAt && event.restoreFullAt.getTime() < event.outageAt.getTime()) {
    flags.push("RESTORE_BEFORE_OUTAGE");
  }

  if (event.durationMinutes !== undefined && event.durationMinutes <= 0) {
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
