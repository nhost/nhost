export default function normalizeColumns(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((column) => column.toString());
  }

  if (typeof value === 'object') {
    const foreignKeyObject = value as Record<string, unknown>;

    if ('columns' in foreignKeyObject && foreignKeyObject.columns) {
      return normalizeColumns(foreignKeyObject.columns);
    }

    if ('column' in foreignKeyObject && foreignKeyObject.column) {
      return [String(foreignKeyObject.column)];
    }
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
}
