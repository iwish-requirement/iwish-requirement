const BUSINESS_TIME_ZONE_OFFSET_MINUTES = 8 * 60;
const MINUTE_MS = 60 * 1000;

export interface IsoRange {
  start: string;
  end: string;
}

export interface FromToIsoRange {
  from: string;
  to: string;
}

function toUtcIsoFromBusinessParts(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): string {
  return new Date(
    Date.UTC(year, monthIndex, day, hour, minute, second, millisecond) -
      BUSINESS_TIME_ZONE_OFFSET_MINUTES * MINUTE_MS,
  ).toISOString();
}

function parseDateInput(value: string | null | undefined): { year: number; monthIndex: number; day: number } | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) {
    return null;
  }
  return { year, monthIndex, day };
}

function parsePeriod(value: string | null | undefined): { year: number; monthIndex: number } | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  return { year, monthIndex };
}

function getBusinessNowParts(now = new Date()): { year: number; monthIndex: number; day: number } {
  const businessNow = new Date(now.getTime() + BUSINESS_TIME_ZONE_OFFSET_MINUTES * MINUTE_MS);
  return {
    year: businessNow.getUTCFullYear(),
    monthIndex: businessNow.getUTCMonth(),
    day: businessNow.getUTCDate(),
  };
}

export function getCurrentBusinessPeriod(now = new Date()): string {
  const { year, monthIndex } = getBusinessNowParts(now);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function getBusinessDayStartIso(value: string | null | undefined): string | null {
  const parsed = parseDateInput(value);
  if (!parsed) {
    return null;
  }
  return toUtcIsoFromBusinessParts(parsed.year, parsed.monthIndex, parsed.day);
}

export function getBusinessDayEndExclusiveIso(value: string | null | undefined): string | null {
  const parsed = parseDateInput(value);
  if (!parsed) {
    return null;
  }
  return toUtcIsoFromBusinessParts(parsed.year, parsed.monthIndex, parsed.day + 1);
}

export function getBusinessMonthRange(period: string | null | undefined): IsoRange {
  const parsed = parsePeriod(period);
  const fallback = getBusinessNowParts();
  const year = parsed?.year ?? fallback.year;
  const monthIndex = parsed?.monthIndex ?? fallback.monthIndex;
  return {
    start: toUtcIsoFromBusinessParts(year, monthIndex, 1),
    end: toUtcIsoFromBusinessParts(year, monthIndex + 1, 1),
  };
}

export function getBusinessMonthFromToRange(period: string | null | undefined): FromToIsoRange {
  const range = getBusinessMonthRange(period);
  return { from: range.start, to: range.end };
}

export function shiftBusinessPeriod(period: string, offsetMonths: number): string {
  const parsed = parsePeriod(period);
  if (!parsed) {
    return period;
  }
  const shifted = new Date(Date.UTC(parsed.year, parsed.monthIndex + offsetMonths, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getBusinessTrendMonths(currentPeriod: string, count: number): string[] {
  const parsed = parsePeriod(currentPeriod);
  if (!parsed || count <= 0) {
    return [];
  }
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(shiftBusinessPeriod(currentPeriod, -i));
  }
  return months;
}

export function getBusinessMonthKeyFromTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return null;
  }
  const businessDate = new Date(time + BUSINESS_TIME_ZONE_OFFSET_MINUTES * MINUTE_MS);
  return `${businessDate.getUTCFullYear()}-${String(businessDate.getUTCMonth() + 1).padStart(2, "0")}`;
}
