export default function formatPresetForInput(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}
