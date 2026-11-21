import { getCronFieldAtCursor, getCronScheduleKind } from './cron-schedule';

describe('cron field selection', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [4, 1],
    [5, 2],
    [7, 3],
    [9, 4],
    [12, 4],
  ])('maps cursor position %i to field %i', (cursor, expected) => {
    expect(getCronFieldAtCursor('0 22 * * 1-5', cursor)).toBe(expected);
  });

  it('handles empty, incomplete, and whitespace-separated expressions', () => {
    expect(getCronFieldAtCursor('', 0)).toBe(0);
    expect(getCronFieldAtCursor('0 ', 2)).toBe(1);
    expect(getCronFieldAtCursor('  0   22 * * MON-FRI', 6)).toBe(1);
    expect(getCronFieldAtCursor('0\t22\t*\t*\t1-5', 5)).toBe(2);
    expect(getCronFieldAtCursor('0 22 * * 1-5 extra', 13)).toBeNull();
    expect(getCronFieldAtCursor('0 22 * * 1-5', null)).toBeNull();
  });

  it.each(['@hourly', ' @daily ', '@reboot', '@restart', '@mi'])(
    'does not highlight a five-field position for shortcut %s',
    (schedule) => {
      expect(getCronScheduleKind(schedule)).toBe('shortcut');
      expect(getCronFieldAtCursor(schedule, schedule.length)).toBeNull();
    },
  );

  it.each(['1 second', '5 seconds', '59 seconds', ' 10 SECONDS '])(
    'recognizes interval %s without interpreting it as a minute and hour',
    (schedule) => {
      expect(getCronScheduleKind(schedule)).toBe('interval');
      expect(getCronFieldAtCursor(schedule, schedule.length)).toBeNull();
    },
  );

  it.each(['0 5 * * *', '0 0 $ * *', '0 22 * JAN MON-FRI'])(
    'keeps expression %s in five-field mode',
    (schedule) => {
      expect(getCronScheduleKind(schedule)).toBe('expression');
    },
  );
});
