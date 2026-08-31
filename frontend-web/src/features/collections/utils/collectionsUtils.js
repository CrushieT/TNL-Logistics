/**
 * Utility functions for Weekly Collections and Thursday billing cycles.
 */

/**
 * Get the upcoming or current Thursday date for the active billing cycle.
 * Billing cycles run Friday through Thursday.
 * For any day in the active week (Fri, Sat, Sun, Mon, Tue, Wed, Thu),
 * returns the Thursday closing this 7-day cycle.
 * @param {Date} [baseDate=new Date()]
 * @returns {Date}
 */
export function getNearestThursday(baseDate = new Date()) {
  const date = new Date(baseDate);
  const day = date.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const daysUntilThursday = (4 - day + 7) % 7;
  date.setDate(date.getDate() + daysUntilThursday);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Format a Thursday cycle date into "Thursday, MMM D-D, YYYY" (e.g. "Thursday, Aug 21-27, 2026")
 * @param {Date} thursdayDate
 * @returns {string}
 */
export function formatCycleDateRange(thursdayDate) {
  const end = new Date(thursdayDate);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `Thursday, ${startMonth} ${startDay}-${endDay}, ${endYear}`;
    }
    return `Thursday, ${startMonth} ${startDay}-${endMonth} ${endDay}, ${endYear}`;
  }
  return `Thursday, ${startMonth} ${startDay}, ${startYear}-${endMonth} ${endDay}, ${endYear}`;
}

/**
 * Generate a list of recent Thursday collection cycles formatted with date ranges.
 * Example: "Thursday, Aug 21-27, 2026"
 * @param {number} [count=8] - Number of cycles to generate
 * @returns {Array<{ isoDate: string, label: string, isCurrent: boolean }>}
 */
export function getRecentThursdays(count = 8) {
  const currentThursday = getNearestThursday(new Date());
  const cycles = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(currentThursday);
    d.setDate(d.getDate() - (i * 7));

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;

    const dateRangeStr = formatCycleDateRange(d);
    const isCurrent = i === 0;
    const label = isCurrent ? `${dateRangeStr} (Current Cycle)` : dateRangeStr;

    cycles.push({
      isoDate,
      label,
      isCurrent,
    });
  }

  return cycles;
}

/**
 * Format currency amount with Philippine Peso symbol.
 * @param {number|string} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const num = Number(amount || 0);
  return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Robustly parse shipment registration date from MySQL DATETIME string, Jackson array, or ISO string.
 * Format examples: "2026-08-24 14:58:37", "2026-08-24T14:58:37", [2026, 8, 24, 14, 58, 37]
 * @param {object} shipment
 * @returns {Date|null}
 */
export function parseShipmentRegistrationDate(shipment) {
  if (!shipment) return null;
  const raw = shipment.dateRegistered ?? shipment.date_registered ?? shipment.createdAt ?? shipment.registrationDate ?? shipment.date;
  if (!raw) return null;

  // Handle Jackson array format: [YYYY, MM, DD, HH, mm, ss]
  if (Array.isArray(raw)) {
    const [year, month, day, hour = 0, min = 0, sec = 0] = raw;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min), Number(sec));
  }

  // Handle string format: "2026-08-24 14:58:37", "2026-08-24T14:58:37", "2026-08-24"
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}):(\d{2}))?/);
    if (match) {
      const [, year, month, day, hour = '0', min = '0', sec = '0'] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min), Number(sec));
    }
    const parsed = new Date(trimmed.replace(' ', 'T'));
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // Handle number timestamp
  if (typeof raw === 'number') {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}
