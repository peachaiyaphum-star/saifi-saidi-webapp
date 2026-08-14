import * as XLSX from "xlsx";
import { excelSerialToParts, cellToNumber, cellToString } from "./parser.service.js";
import { computeEvaluatedReport52 } from "./evaluation.service.js";

// รายงาน 52 is a different export entirely from รายงาน 50: an event-impact
// list (one row per event x affected site, since a single outage can hit
// several sites) pulled from PEA's BI/data-warehouse tooling rather than the
// web reporting system. Its dates are genuine Gregorian serials (verified:
// the file's own "Year เป็น 2025 หรือ 2026" filter note, and a decoded
// sample serial landing on today's real date) - unlike รายงาน 50, there is
// no Buddhist-Era offset to undo here.
export interface ParsedReport52Row {
  eventNo: bigint;
  outageAt: Date;
  restoreFirstAt?: Date;
  restoreFullAt?: Date;
  durationMinutes?: number;
  equipmentCode?: string;
  feederCode?: string;
  status?: string;
  phase?: string;
  subCause?: string;
  causeKnown?: string;
  officeName?: string; // affected site name, e.g. "กฟส.แก้งคร้อ"
  weather?: string;
  customersAffected?: number;
  customerMinutes?: number;
  location?: string;
  repairDetail?: string;
  loadMw?: number;
  eventType?: string;
  evaluated: boolean;
}

export interface ParsedReport52Result {
  rows: ParsedReport52Row[];
  periodStart?: Date;
  periodEnd?: Date;
}

function excelSerialToGregorianDate(serial: number): Date {
  const p = excelSerialToParts(serial);
  return new Date(Date.UTC(p.y, p.mo, p.d, p.h, p.mi, p.s));
}

function buildColumnIndex(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((cell, idx) => {
    const name = String(cell ?? "").trim();
    if (name && !map.has(name)) map.set(name, idx);
  });
  return map;
}

export function parseReport52(buffer: Buffer): ParsedReport52Result {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets["Sheet1"];
  if (!sheet) {
    throw new Error('ไม่พบชีต "Sheet1" ในไฟล์ - รูปแบบไฟล์อาจไม่ตรงกับ "รายงาน 52"');
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  const headerIdx = rows.findIndex((r) => String(r?.[0] ?? "").trim() === "EventNumber");
  if (headerIdx === -1) {
    throw new Error('ไม่พบคอลัมน์ "EventNumber" ในไฟล์ - รูปแบบไฟล์อาจไม่ตรงกับ "รายงาน 52"');
  }

  const col = buildColumnIndex(rows[headerIdx]);
  const get = (row: unknown[], name: string) => row[col.get(name) ?? -1];

  const parsed: ParsedReport52Row[] = [];
  let periodStart: Date | undefined;
  let periodEnd: Date | undefined;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const eventNoRaw = row?.[col.get("EventNumber") ?? 0];
    if (eventNoRaw === null || eventNoRaw === undefined || eventNoRaw === "") continue;

    const outageSerial = cellToNumber(get(row, "OutageDateTime"));
    if (outageSerial === undefined) continue; // unusable row, skip rather than crash the whole import
    const outageAt = excelSerialToGregorianDate(outageSerial);

    const restoreFirstSerial = cellToNumber(get(row, "FirstRestoDateTime"));
    const restoreFullSerial = cellToNumber(get(row, "LastRestoDateTime"));

    const subCause = cellToString(get(row, "SubCauseType"));
    const status = cellToString(get(row, "OpDeviceStatus"));
    const affectedAreaId = cellToString(get(row, "AffectedAreaID"));

    parsed.push({
      eventNo: BigInt(Math.trunc(Number(eventNoRaw))),
      outageAt,
      restoreFirstAt: restoreFirstSerial !== undefined ? excelSerialToGregorianDate(restoreFirstSerial) : undefined,
      restoreFullAt: restoreFullSerial !== undefined ? excelSerialToGregorianDate(restoreFullSerial) : undefined,
      durationMinutes: cellToNumber(get(row, "ค่ารวมของ LastStepDuration")),
      equipmentCode: cellToString(get(row, "OpDeviceID")),
      feederCode: cellToString(get(row, "Feeder")),
      status,
      phase: cellToString(get(row, "OpDevicePhase")),
      subCause,
      causeKnown: cellToString(get(row, "KnowUnknowCause")),
      officeName: cellToString(get(row, "DescriptionSAP")),
      weather: cellToString(get(row, "Weather")),
      customersAffected: cellToNumber(get(row, "ค่ารวมของ AffectedCustomer")),
      customerMinutes: cellToNumber(get(row, "ค่ารวมของ AllStepCusXTime")),
      location:
        cellToString(get(row, "SiteDetail")) ?? cellToString(get(row, "FaultDetail")) ?? cellToString(get(row, "Detail")),
      repairDetail: cellToString(get(row, "CorrectionDetail")),
      loadMw: cellToNumber(get(row, "ค่ารวมของ Load(MW)")),
      eventType: "ไฟฟ้าขัดข้อง", // the export is already pre-filtered to this event type
      evaluated: computeEvaluatedReport52({ subCause, status, affectedAreaId }),
    });

    if (!periodStart || outageAt < periodStart) periodStart = outageAt;
    if (!periodEnd || outageAt > periodEnd) periodEnd = outageAt;
  }

  if (parsed.length === 0) {
    throw new Error("ไม่พบข้อมูลเหตุการณ์ในไฟล์รายงาน 52 นี้");
  }

  return { rows: parsed, periodStart, periodEnd };
}
