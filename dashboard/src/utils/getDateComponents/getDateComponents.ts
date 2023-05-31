/**
 * Returns components of a date.
 *
 * @param date - Date to get components from.
 * @param options.adjustTimezone - Whether to adjust the date to UTC.
 * @returns Components of the date.
 */
export default function getDateComponents(
  date?: Date,
  options?: { adjustTimezone?: boolean },
): {
  year?: string;
  month?: string;
  day?: string;
  hour?: string;
  minute?: string;
  second?: string;
} {
  if (!date || Number.isNaN(date.getTime())) {
    return {
      year: undefined,
      month: undefined,
      day: undefined,
      hour: undefined,
      minute: undefined,
      second: undefined,
    };
  }

  const finalDate = options?.adjustTimezone
    ? new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000)
    : date;

  return {
    year: String(finalDate.getFullYear()),
    month: String(finalDate.getMonth() + 1).padStart(2, '0'),
    day: String(finalDate.getDate()).padStart(2, '0'),
    hour: String(finalDate.getHours()).padStart(2, '0'),
    minute: String(finalDate.getMinutes()).padStart(2, '0'),
    second: String(finalDate.getSeconds()).padStart(2, '0'),
  };
}
