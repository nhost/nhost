export function parseInputValue(value: string): unknown {
  if (value === '') {
    return '';
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function displayInputValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined) {
    return '';
  }
  return JSON.stringify(value);
}
