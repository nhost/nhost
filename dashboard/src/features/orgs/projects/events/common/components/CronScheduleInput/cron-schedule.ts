export function getCronScheduleKind(
  schedule: string,
): 'expression' | 'shortcut' | 'interval' {
  const value = schedule.trim();
  if (value.startsWith('@')) {
    return 'shortcut';
  }
  if (/^\d+\s+seconds?$/i.test(value)) {
    return 'interval';
  }
  return 'expression';
}

export function getCronFieldAtCursor(
  schedule: string,
  cursor: number | null,
): number | null {
  if (cursor === null || getCronScheduleKind(schedule) !== 'expression') {
    return null;
  }
  const index = schedule.slice(0, cursor).trimStart().split(/\s+/).length - 1;
  return index < 5 ? index : null;
}
