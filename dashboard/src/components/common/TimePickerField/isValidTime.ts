export const TIME_PATTERN =
  /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?([+-]\d{2}(:\d{2})?)?$/;

export default function isValidTime(time: string | null): time is string {
  return typeof time === 'string' && time.length > 0 && TIME_PATTERN.test(time);
}
