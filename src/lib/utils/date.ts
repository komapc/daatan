/**
 * Date utilities for timezone-aware input handling.
 *
 * Problem: <input type="date"> returns a naive "YYYY-MM-DD" string with no
 * timezone. Appending "T23:59:59.999Z" treats it as UTC end-of-day, which is
 * wrong for non-UTC users (e.g. a user in UTC+3 sees their "today" shifted).
 *
 * Solution: always interpret date-picker strings as local time, then let
 * `.toISOString()` convert to UTC for storage.
 */

/**
 * Convert a "YYYY-MM-DD" string from <input type="date"> to a Date at
 * 23:59:59.999 in the user's local timezone.
 */
export function localEndOfDay(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  // month is 1-based in date strings, 0-based in Date constructor
  return new Date(year, month - 1, day, 23, 59, 59, 999)
}

/**
 * Format a Date for <input type="datetime-local"> (value="YYYY-MM-DDTHH:MM")
 * using the user's local timezone. Needed when loading a UTC datetime from the
 * server — toISOString() would give UTC which the input then misinterprets.
 */
export function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}
