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

const ScheduleShortcuts: Record<string, string> = {
  '@reboot': 'At startup',
  '@restart': 'At startup',
  '@hourly': 'Every hour',
  '@daily': 'Every day at midnight',
  '@midnight': 'Every day at midnight',
  '@weekly': 'Every Sunday at midnight',
  '@monthly': 'On the first of every month',
  '@yearly': 'Every January 1',
  '@annually': 'Every January 1',
};

export function describeCronSchedule(schedule: string): string {
  const value = schedule.trim();
  const shortcut = ScheduleShortcuts[value];
  if (typeof shortcut === 'string') {
    return shortcut;
  }
  const seconds = /^(\d+)\s+seconds?$/.exec(value);
  if (seconds) {
    return `Every ${seconds[1]} ${seconds[1] === '1' ? 'second' : 'seconds'}`;
  }
  const [minute, hour, day, month, weekday, ...rest] = value.split(/\s+/);
  if (!weekday || rest.length || month !== '*') {
    return schedule;
  }
  if (weekday === '*' && minute === '0') {
    const hourlyStep = /^\*\/(\d+)$/.exec(hour);
    if (day === '*' && hourlyStep) {
      return `Every ${hourlyStep[1]} hours`;
    }
    if (hour === '0' && /^\d{1,2}$/.test(day)) {
      return `Monthly, on day ${Number(day)}`;
    }
  }
  if (day !== '*') {
    return schedule;
  }
  if (weekday === '*' && hour === '*') {
    if (minute === '*') {
      return 'Every minute';
    }
    const step = /^\*\/(\d+)$/.exec(minute);
    if (step) {
      return `Every ${step[1]} minutes`;
    }
    if (minute === '0') {
      return 'Every hour';
    }
    if (/^\d{1,2}$/.test(minute)) {
      return `At minute ${minute} of every hour`;
    }
  }
  if (/^\d{1,2}$/.test(minute) && /^\d{1,2}$/.test(hour)) {
    const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    if (weekday === '*') {
      return `Every day at ${time}`;
    }
    if (weekday === '1-5') {
      return `Weekdays at ${time}`;
    }
  }
  return schedule;
}
