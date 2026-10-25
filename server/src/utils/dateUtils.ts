/**
 * Date and timezone helper utilities for attendance management.
 */

export interface MonthInfo {
  year: number;
  month: number; // 1-indexed (1 = January, 12 = December)
  monthStr: string; // 'YYYY-MM'
  todayStr: string; // 'YYYY-MM-DD'
}

/**
 * Returns the current calendar year, month, and today date string
 * in the organization's configured timezone (default: Asia/Kolkata).
 */
export function getOrgCurrentMonth(timeZone: string = 'Asia/Kolkata'): MonthInfo {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.format(new Date()); // "YYYY-MM-DD" in en-CA
    const [y, m, d] = parts.split('-').map(Number);
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;
    const todayStr = `${monthStr}-${String(d).padStart(2, '0')}`;
    return { year: y, month: m, monthStr, todayStr };
  } catch (err) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;
    const todayStr = `${monthStr}-${String(d).padStart(2, '0')}`;
    return { year: y, month: m, monthStr, todayStr };
  }
}

/**
 * Validates whether a date string (YYYY-MM-DD) falls within the current calendar month
 * in the specified organization timezone.
 */
export function isCurrentCalendarMonth(dateStr: string, timeZone: string = 'Asia/Kolkata'): boolean {
  if (!dateStr || !dateStr.includes('-')) return false;
  const targetMonth = dateStr.substring(0, 7);
  const { monthStr } = getOrgCurrentMonth(timeZone);
  return targetMonth === monthStr;
}

/**
 * Checks if a date string (YYYY-MM-DD) falls in a previous calendar month.
 */
export function isPreviousCalendarMonth(dateStr: string, timeZone: string = 'Asia/Kolkata'): boolean {
  if (!dateStr || !dateStr.includes('-')) return false;
  const targetMonth = dateStr.substring(0, 7);
  const { monthStr } = getOrgCurrentMonth(timeZone);
  return targetMonth < monthStr;
}

/**
 * Checks if a date string (YYYY-MM-DD) is in the future.
 */
export function isFutureDate(dateStr: string, timeZone: string = 'Asia/Kolkata'): boolean {
  if (!dateStr || !dateStr.includes('-')) return false;
  const { todayStr } = getOrgCurrentMonth(timeZone);
  return dateStr > todayStr;
}
