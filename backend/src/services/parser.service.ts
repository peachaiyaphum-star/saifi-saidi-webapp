import * as XLSX from "xlsx";

export interface ParsedHeaderMeta {
  region?: string;
  officesText?: string;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface ParsedEventRow {
  eventNo: bigint;
  sequenceNo?: number;
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
  officeName?: string;
  weather?: string;
  customersAffected?: number;
  location?: string;
  repairDetail?: string;
  loadMw?: number;
  eventType?: string;
}

export interface ParsedSummary {
  saifi?: number;
  saidi?: number;
  totalCustomers?: number;
  affectedCustomers?: number;
}

export interface ParseResult {
  meta: ParsedHeaderMeta;
  events: ParsedEventRow[];
  evaluatedIds: Set<string>;
  notEvaluatedIds: Set<string>;
  customerMinutesById: Map<string, number>;
  evaluatedSummary?: ParsedSummary;
  notEvaluatedSummary?: ParsedSummary;
}

const THAI_MONTH_ABBR: Record<string, number> = {
  "ม.ค.": 0, "ก.พ.": 1, "มี.ค.": 2, "เม.ย.": 3, "พ.ค.": 4, "มิ.ย.": 5,
  "ก.ค.": 6, "ส.ค.": 7, "ก.ย.": 8, "ต.ค.": 9, "พ.ย.": 10, "ธ.ค.": 11,
};

const THAI_MONTH_FULL: Record<string, number> = {
  "มกราคม": 0, "กุมภาพันธ์": 1, "มีนาคม": 2, "เมษายน": 3, "พฤษภาคม": 4, "มิถุนายน": 5,
  "กรกฎาคม": 6, "สิงหาคม": 7, "กันยายน": 8, "ตุลาคม": 9, "พฤศจิกายน": 10, "ธันวาคม": 11,
};

const BE_OFFSET = 543;
// PEA's "รายงาน 50" export writes the Buddhist Era year straight into every
// date value (e.g. 2569 instead of Gregorian 2026), both in native Excel date
// cells and in formatted Thai date strings. Every date read from this report
// needs 543 subtracted from its year before it means anything to JS/SQL.
function beToCe(year: number): number {
  return year > 2400 ? year - BE_OFFSET : year;
}

// SheetJS's cellDates option builds Date objects via the *local* Date
// constructor, and Excel's epoch (1899-12-30) predates the standardization of
// most timezones - Node/ICU applies each zone's *historical* offset for
// dates that old (e.g. Asia/Bangkok used LMT +6:42, not today's fixed +7:00).
// That makes ordinary getHours()/getUTCHours() unreliable here regardless of
// which one you pick. So date/time cells are read as raw Excel serials
// (cellDates left off) and converted with pure day-count/fraction-of-day
// arithmetic - no Date object is ever constructed from calendar components
// until the very end, once via Date.UTC, so the result is immune to the
// server's timezone entirely.
function excelSerialToParts(serial: number) {
  const utcDays = Math.floor(serial - 25569); // 25569 = days between 1899-12-30 and 1970-01-01
  const dateInfo = new Date(utcDays * 86400 * 1000);
  const fractionalDay = serial - Math.floor(serial) + 0.0000001;
  let totalSeconds = Math.floor(86400 * fractionalDay);
  const s = totalSeconds % 60;
  totalSeconds -= s;
  const h = Math.floor(totalSeconds / 3600);
  const mi = Math.floor(totalSeconds / 60) % 60;
  return { y: dateInfo.getUTCFullYear(), mo: dateInfo.getUTCMonth(), d: dateInfo.getUTCDate(), h, mi, s };
}

function excelDateSerialToUTCDate(serial: number): Date {
  const p = excelSerialToParts(serial);
  return new Date(Date.UTC(beToCe(p.y), p.mo, p.d, p.h, p.mi, p.s));
}

function combineDateAndTimeSerials(dateSerial: number, timeSerial: number): Date {
  const datePart = excelSerialToParts(dateSerial);
  const timePart = excelSerialToParts(timeSerial);
  return new Date(Date.UTC(beToCe(datePart.y), datePart.mo, datePart.d, timePart.h, timePart.mi, timePart.s));
}

function parseThaiDateTimeString(value: string): Date | undefined {
  // e.g. "1 ม.ค. 2569, 1:21:00" - a plain text cell, so no Excel serial/
  // timezone ambiguity here; still built via Date.UTC to keep every
  // timestamp in this module constructed the same TZ-independent way.
  const match = value
    .trim()
    .match(/^(\d{1,2})\s+([฀-๿.]+)\s+(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return undefined;
  const [, dayStr, monthStr, yearStr, hStr, mStr, sStr] = match;
  const month = THAI_MONTH_ABBR[monthStr];
  if (month === undefined) return undefined;
  return new Date(
    Date.UTC(beToCe(Number(yearStr)), month, Number(dayStr), Number(hStr), Number(mStr), sStr ? Number(sStr) : 0)
  );
}

function cellToNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function cellToString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s === "" ? undefined : s;
}

// For text-formatted date cells (restore timestamps in this report). Native
// numeric date/time cells (outage date & time) are handled separately via
// excelDateSerialToUTCDate/combineDateAndTimeSerials - see the comment above.
function cellToDate(value: unknown): Date | undefined {
  if (typeof value === "string") return parseThaiDateTimeString(value);
  if (typeof value === "number") return excelDateSerialToUTCDate(value);
  return undefined;
}

function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
}

function findHeaderRowIndex(rows: unknown[][], anchor: string): number {
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]?.[0] ?? "").trim() === anchor) return i;
  }
  throw new Error(`ไม่พบแถวหัวตาราง (คอลัมน์ "${anchor}") ในไฟล์ - รูปแบบไฟล์อาจไม่ตรงกับ "รายงาน 50"`);
}

function buildColumnIndex(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((cell, idx) => {
    const name = String(cell ?? "").trim();
    if (name && !map.has(name)) map.set(name, idx); // first occurrence wins (export duplicates some headers)
  });
  return map;
}

function readEventTable(rows: unknown[][]): ParsedEventRow[] {
  const headerIdx = findHeaderRowIndex(rows, "หมายเลขเหตุการณ์");
  const col = buildColumnIndex(rows[headerIdx]);
  const events: ParsedEventRow[] = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const eventNoRaw = row?.[col.get("หมายเลขเหตุการณ์") ?? 0];
    if (eventNoRaw === null || eventNoRaw === undefined || eventNoRaw === "") continue;

    const get = (name: string) => row[col.get(name) ?? -1];

    const outageDateSerial = get("วันที่/เวลาไฟดับ");
    const outageTimeSerial = get("เวลา");
    let outageAt: Date | undefined;
    if (typeof outageDateSerial === "number" && typeof outageTimeSerial === "number") {
      outageAt = combineDateAndTimeSerials(outageDateSerial, outageTimeSerial);
    } else if (typeof outageDateSerial === "number") {
      outageAt = excelDateSerialToUTCDate(outageDateSerial);
    }
    if (!outageAt) continue; // unusable row, skip rather than crash the whole import

    events.push({
      eventNo: BigInt(Math.trunc(Number(eventNoRaw))),
      sequenceNo: cellToNumber(get("ลำดับ")),
      outageAt,
      restoreFirstAt: cellToDate(get("วันที่/เวลา ที่จ่ายไฟคืนระบบได้ครั้งแรก")),
      restoreFullAt: cellToDate(get("วันที่/เวลา ที่จ่ายไฟคืนครบทั้งหมด")),
      durationMinutes: cellToNumber(get("รวมเวลาไฟดับขั้นสุดท้าย (นาที)")),
      equipmentCode: cellToString(get("รหัสอุปกรณ์ที่ทำงาน")),
      feederCode: cellToString(get("ฟีดเดอร์")),
      status: cellToString(get("สถานะ")),
      phase: cellToString(get("เฟส")),
      subCause: cellToString(get("สาเหตุย่อย")),
      causeKnown: cellToString(get("ทราบสาเหตุ")),
      officeName: cellToString(get("กฟฟ.รับผิดชอบ")),
      weather: cellToString(get("สภาพอากาศ")),
      customersAffected: cellToNumber(get("ผชฟ. ถูกกระทบ (ราย)")),
      location: cellToString(get("สถานที่จุดเกิดเหตุ")),
      repairDetail: cellToString(get("รายละเอียดการแก้ไข")),
      loadMw: cellToNumber(get("ค่าโหลด (MW)")),
      eventType: cellToString(get("ประเภทเหตุการณ์")),
    });
  }

  return events;
}

function readSummaryBlock(rows: unknown[][]): ParsedSummary | undefined {
  // First two non-header rows of "ประเมิน"/"ไม่ประเมิน": a label row then a value row
  const labelRow = rows[0];
  const valueRow = rows[1];
  if (!labelRow || !valueRow) return undefined;
  const col = buildColumnIndex(labelRow);
  const at = (name: string) => {
    const idx = col.get(name);
    return idx === undefined ? undefined : cellToNumber(valueRow[idx]);
  };
  return {
    saifi: at("SAIFI"),
    saidi: at("SAIDI"),
    totalCustomers: at("ผชฟ.ทั้งหมด"),
    affectedCustomers: at("ผชฟ.ถูกกระทบ"),
  };
}

function readIdsAndCustomerMinutes(rows: unknown[][]): { ids: Set<string>; minutes: Map<string, number> } {
  const headerIdx = findHeaderRowIndex(rows, "หมายเลขเหตุการณ์");
  const col = buildColumnIndex(rows[headerIdx]);
  const ids = new Set<string>();
  const minutes = new Map<string, number>();

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const eventNoRaw = row?.[col.get("หมายเลขเหตุการณ์") ?? 0];
    if (eventNoRaw === null || eventNoRaw === undefined || eventNoRaw === "") continue;
    const id = String(Math.trunc(Number(eventNoRaw)));
    ids.add(id);
    const cm = cellToNumber(row[col.get("ผชฟ.*เวลา") ?? -1]);
    if (cm !== undefined) minutes.set(id, cm);
  }

  return { ids, minutes };
}

function parseHeaderMeta(rows: unknown[][]): ParsedHeaderMeta {
  const meta: ParsedHeaderMeta = {};
  for (const row of rows.slice(0, 10)) {
    const cell = cellToString(row?.[0]);
    if (!cell) continue;

    if (cell.startsWith("การไฟฟ้าเขต:")) {
      meta.region = cell.replace("การไฟฟ้าเขต:", "").trim();
    } else if (cell.startsWith("กฟฟ.:")) {
      meta.officesText = cell.replace("กฟฟ.:", "").trim();
    } else if (cell.startsWith("จาก")) {
      const match = cell.match(
        /จาก\s+(\d{1,2})\s+(\S+)\s+(\d{4}),?\s*(\d{1,2}):(\d{2}).*?ถึง\s+(\d{1,2})\s+(\S+)\s+(\d{4}),?\s*(\d{1,2}):(\d{2})/
      );
      if (match) {
        const [, d1, mo1, y1, h1, mi1, d2, mo2, y2, h2, mi2] = match;
        const m1 = THAI_MONTH_FULL[mo1];
        const m2 = THAI_MONTH_FULL[mo2];
        if (m1 !== undefined)
          meta.periodStart = new Date(Date.UTC(beToCe(Number(y1)), m1, Number(d1), Number(h1), Number(mi1)));
        if (m2 !== undefined)
          meta.periodEnd = new Date(Date.UTC(beToCe(Number(y2)), m2, Number(d2), Number(h2), Number(mi2)));
      }
    }
  }
  return meta;
}

export function parseReport50(buffer: Buffer): ParseResult {
  // cellDates deliberately left off - see the comment on excelSerialToParts
  // for why native date/time cells are read as raw serials instead.
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const mainSheet = workbook.Sheets["50"];
  if (!mainSheet) {
    throw new Error('ไม่พบชีตชื่อ "50" ในไฟล์ที่อัปโหลด - กรุณาตรวจสอบว่าเป็นไฟล์รายงาน 50 ที่ถูกต้อง');
  }
  const mainRows = sheetToRows(mainSheet);
  const meta = parseHeaderMeta(mainRows);
  const events = readEventTable(mainRows);

  let evaluatedIds = new Set<string>();
  let notEvaluatedIds = new Set<string>();
  const customerMinutesById = new Map<string, number>();
  let evaluatedSummary: ParsedSummary | undefined;
  let notEvaluatedSummary: ParsedSummary | undefined;

  const evalSheet = workbook.Sheets["ประเมิน"];
  if (evalSheet) {
    const evalRows = sheetToRows(evalSheet);
    evaluatedSummary = readSummaryBlock(evalRows);
    const { ids, minutes } = readIdsAndCustomerMinutes(evalRows);
    evaluatedIds = ids;
    minutes.forEach((v, k) => customerMinutesById.set(k, v));
  }

  const notEvalSheet = workbook.Sheets["ไม่ประเมิน"];
  if (notEvalSheet) {
    const notEvalRows = sheetToRows(notEvalSheet);
    notEvaluatedSummary = readSummaryBlock(notEvalRows);
    const { ids, minutes } = readIdsAndCustomerMinutes(notEvalRows);
    notEvaluatedIds = ids;
    minutes.forEach((v, k) => customerMinutesById.set(k, v));
  }

  return { meta, events, evaluatedIds, notEvaluatedIds, customerMinutesById, evaluatedSummary, notEvaluatedSummary };
}
