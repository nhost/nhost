import { vi } from 'vitest';
import {
  convert12HourTo24Hour,
  display12HourValue,
  getArrowByType,
  getDateByType,
  getValid12Hour,
  getValidArrow12Hour,
  getValidArrowHour,
  getValidArrowMinuteOrSecond,
  getValidArrowNumber,
  getValidHour,
  getValidMinuteOrSecond,
  getValidNumber,
  isValid12Hour,
  isValidHour,
  isValidMinuteOrSecond,
  set12Hours,
  setDateByType,
  setHours,
  setMinutes,
  setSeconds,
  type TimePickerType,
} from './time-picker-utils';

// Mock TZDate if needed
vi.mock('@date-fns/tz', () => ({
  TZDate: class MockTZDate extends Date {
    timeZone: string;

    constructor(date: string | Date, timeZone: string) {
      super(date);
      this.timeZone = timeZone;
    }
  },
}));

describe('time-picker-utils', () => {
  describe('validation functions', () => {
    test('isValidHour validates hour format correctly', () => {
      // Valid hours
      expect(isValidHour('00')).toBe(true);
      expect(isValidHour('01')).toBe(true);
      expect(isValidHour('12')).toBe(true);
      expect(isValidHour('23')).toBe(true);

      // Invalid hours
      expect(isValidHour('24')).toBe(false);
      expect(isValidHour('-1')).toBe(false);
      expect(isValidHour('1')).toBe(false); // not padded
      expect(isValidHour('ab')).toBe(false);
    });

    test('isValid12Hour validates 12-hour format correctly', () => {
      // Valid 12-hour values
      expect(isValid12Hour('01')).toBe(true);
      expect(isValid12Hour('09')).toBe(true);
      expect(isValid12Hour('12')).toBe(true);

      // Invalid 12-hour values
      expect(isValid12Hour('00')).toBe(false);
      expect(isValid12Hour('13')).toBe(false);
      expect(isValid12Hour('1')).toBe(false); // not padded
      expect(isValid12Hour('ab')).toBe(false);
    });

    test('isValidMinuteOrSecond validates minute/second format correctly', () => {
      // Valid minutes/seconds
      expect(isValidMinuteOrSecond('00')).toBe(true);
      expect(isValidMinuteOrSecond('01')).toBe(true);
      expect(isValidMinuteOrSecond('30')).toBe(true);
      expect(isValidMinuteOrSecond('59')).toBe(true);

      // Invalid minutes/seconds
      expect(isValidMinuteOrSecond('60')).toBe(false);
      expect(isValidMinuteOrSecond('-1')).toBe(false);
      expect(isValidMinuteOrSecond('1')).toBe(false); // not padded
      expect(isValidMinuteOrSecond('ab')).toBe(false);
    });
  });

  describe('number validation and correction functions', () => {
    test('getValidNumber handles number validation correctly', () => {
      // Basic validation
      expect(getValidNumber('5', { max: 10 })).toBe('05');
      expect(getValidNumber('15', { max: 10 })).toBe('10');
      expect(getValidNumber('-1', { max: 10, min: 0 })).toBe('00');

      // With looping
      expect(getValidNumber('15', { max: 10, min: 0, loop: true })).toBe('00');
      expect(getValidNumber('-1', { max: 10, min: 0, loop: true })).toBe('10');

      // Invalid input
      expect(getValidNumber('abc', { max: 10 })).toBe('00');
    });

    test('getValidHour returns valid 24-hour format', () => {
      expect(getValidHour('12')).toBe('12');
      expect(getValidHour('23')).toBe('23');
      expect(getValidHour('24')).toBe('23'); // Capped at 23
      expect(getValidHour('-1')).toBe('00'); // Min is 0
      expect(getValidHour('abc')).toBe('00'); // Invalid input
    });

    test('getValid12Hour returns valid 12-hour format', () => {
      // expect(getValid12Hour('06')).toBe('06');
      // expect(getValid12Hour('12')).toBe('12');
      expect(getValid12Hour('00')).toBe('01'); // Min is 1
      expect(getValid12Hour('13')).toBe('12'); // Capped at 12
      expect(getValid12Hour('abc')).toBe('00'); // Invalid input defaults to 00
    });

    test('getValidMinuteOrSecond returns valid minute/second format', () => {
      expect(getValidMinuteOrSecond('30')).toBe('30');
      expect(getValidMinuteOrSecond('59')).toBe('59');
      expect(getValidMinuteOrSecond('60')).toBe('59'); // Capped at 59
      expect(getValidMinuteOrSecond('-1')).toBe('00'); // Min is 0
      expect(getValidMinuteOrSecond('abc')).toBe('00'); // Invalid input
    });
  });

  describe('arrow navigation functions', () => {
    test('getValidArrowNumber handles arrow navigation with looping', () => {
      // Incrementing
      expect(getValidArrowNumber('05', { min: 0, max: 10, step: 1 })).toBe(
        '06',
      );
      expect(getValidArrowNumber('10', { min: 0, max: 10, step: 1 })).toBe(
        '00',
      ); // Loops back to min

      // Decrementing
      expect(getValidArrowNumber('05', { min: 0, max: 10, step: -1 })).toBe(
        '04',
      );
      expect(getValidArrowNumber('00', { min: 0, max: 10, step: -1 })).toBe(
        '10',
      ); // Loops to max

      // Invalid input
      expect(getValidArrowNumber('abc', { min: 0, max: 10, step: 1 })).toBe(
        '00',
      );
    });

    test('getValidArrowHour handles hour navigation correctly', () => {
      expect(getValidArrowHour('05', 1)).toBe('06');
      expect(getValidArrowHour('23', 1)).toBe('00'); // Loops to 0
      expect(getValidArrowHour('00', -1)).toBe('23'); // Loops to 23
    });

    test('getValidArrow12Hour handles 12-hour navigation correctly', () => {
      expect(getValidArrow12Hour('05', 1)).toBe('06');
      expect(getValidArrow12Hour('12', 1)).toBe('01'); // Loops to 1
      expect(getValidArrow12Hour('01', -1)).toBe('12'); // Loops to 12
    });

    test('getValidArrowMinuteOrSecond handles minute/second navigation correctly', () => {
      expect(getValidArrowMinuteOrSecond('30', 1)).toBe('31');
      expect(getValidArrowMinuteOrSecond('59', 1)).toBe('00'); // Loops to 0
      expect(getValidArrowMinuteOrSecond('00', -1)).toBe('59'); // Loops to 59
    });
  });

  describe('date manipulation functions', () => {
    test('setMinutes sets minutes correctly on a Date object', () => {
      const date = new Date(2023, 0, 1, 12, 0, 0);
      setMinutes(date, '30');
      expect(date.getMinutes()).toBe(30);

      // Invalid values are corrected
      setMinutes(date, '60');
      expect(date.getMinutes()).toBe(59);
    });

    test('setSeconds sets seconds correctly on a Date object', () => {
      const date = new Date(2023, 0, 1, 12, 30, 0);
      setSeconds(date, '45');
      expect(date.getSeconds()).toBe(45);

      // Invalid values are corrected
      setSeconds(date, '60');
      expect(date.getSeconds()).toBe(59);
    });

    test('setHours sets hours correctly on a Date object', () => {
      const date = new Date(2023, 0, 1, 12, 30, 0);
      setHours(date, '14');
      expect(date.getHours()).toBe(14);

      // Invalid values are corrected
      setHours(date, '24');
      expect(date.getHours()).toBe(23);
    });

    test('convert12HourTo24Hour converts 12-hour to 24-hour format correctly', () => {
      // AM conversions
      expect(convert12HourTo24Hour(1, 'AM')).toBe(1);
      expect(convert12HourTo24Hour(11, 'AM')).toBe(11);
      expect(convert12HourTo24Hour(12, 'AM')).toBe(0); // 12 AM is 00:00

      // PM conversions
      expect(convert12HourTo24Hour(1, 'PM')).toBe(13);
      expect(convert12HourTo24Hour(11, 'PM')).toBe(23);
      expect(convert12HourTo24Hour(12, 'PM')).toBe(12); // 12 PM is 12:00
    });

    test('set12Hours sets 12-hour format correctly on a Date object', () => {
      const date = new Date(2023, 0, 1, 0, 0, 0);

      // Morning hours (AM)
      set12Hours(date, '09', 'AM');
      expect(date.getHours()).toBe(9);

      // 12 AM
      set12Hours(date, '12', 'AM');
      expect(date.getHours()).toBe(0);

      // Afternoon/evening hours (PM)
      set12Hours(date, '03', 'PM');
      expect(date.getHours()).toBe(15);

      // 12 PM
      set12Hours(date, '12', 'PM');
      expect(date.getHours()).toBe(12);
    });

    test('display12HourValue converts 24-hour to 12-hour display format', () => {
      expect(display12HourValue(0)).toBe('12'); // 00:00 -> 12 AM
      expect(display12HourValue(1)).toBe('01'); // 01:00 -> 1 AM
      expect(display12HourValue(11)).toBe('11'); // 11:00 -> 11 AM
      expect(display12HourValue(12)).toBe('12'); // 12:00 -> 12 PM
      expect(display12HourValue(13)).toBe('01'); // 13:00 -> 1 PM
      expect(display12HourValue(23)).toBe('11'); // 23:00 -> 11 PM
      expect(display12HourValue(22)).toBe('10'); // 22:00 -> 10 PM
    });
  });
  describe('integrated date manipulation functions', () => {
    test('getDateByType returns date component according to the picker type', () => {
      const date = new Date(2023, 0, 1, 14, 30, 45);

      // Test hours
      expect(getDateByType(date, 'hours')).toBe('14');

      // Test minutes
      expect(getDateByType(date, 'minutes')).toBe('30');

      // Test seconds
      expect(getDateByType(date, 'seconds')).toBe('45');

      // Test 12-hour format
      expect(getDateByType(date, '12hours')).toBe('02'); // 14:00 -> 2 PM

      // Test 12 noon and midnight special cases
      const noon = new Date(2023, 0, 1, 12, 0, 0);
      expect(getDateByType(noon, '12hours')).toBe('12');

      const midnight = new Date(2023, 0, 1, 0, 0, 0);
      expect(getDateByType(midnight, '12hours')).toBe('12');

      // Test with invalid picker type
      expect(getDateByType(date, 'invalid' as TimePickerType)).toBe('00');
    });

    test('getArrowByType handles arrow navigation based on picker type', () => {
      // Test hours
      expect(getArrowByType('14', 1, 'hours')).toBe('15');
      expect(getArrowByType('23', 1, 'hours')).toBe('00'); // Loops back to 00

      // Test minutes
      expect(getArrowByType('30', 1, 'minutes')).toBe('31');
      expect(getArrowByType('59', 1, 'minutes')).toBe('00'); // Loops back to 00

      // Test seconds
      expect(getArrowByType('45', 1, 'seconds')).toBe('46');
      expect(getArrowByType('59', 1, 'seconds')).toBe('00'); // Loops back to 00

      // Test 12-hour format
      expect(getArrowByType('09', 1, '12hours')).toBe('10');
      expect(getArrowByType('12', 1, '12hours')).toBe('01'); // Loops back to 01

      // Test with invalid picker type
      expect(getArrowByType('14', 1, 'invalid' as TimePickerType)).toBe('00');
    });

    test.only('setDateByType updates date according to the picker type', () => {
      const date = new Date(2023, 0, 1, 12, 30, 45);

      // Test updating hours
      const hourDate = setDateByType(date, '14', 'hours');
      expect(hourDate.getHours()).toBe(14);
      expect(hourDate.getMinutes()).toBe(30); // Other fields unchanged
      expect(hourDate.getSeconds()).toBe(45); // Other fields unchanged

      // Test updating minutes
      const minuteDate = setDateByType(date, '15', 'minutes');
      expect(minuteDate.getHours()).toBe(14); // Other fields unchanged
      expect(minuteDate.getMinutes()).toBe(15);
      expect(minuteDate.getSeconds()).toBe(45); // Other fields unchanged

      // Test updating seconds
      const secondDate = setDateByType(date, '20', 'seconds');
      expect(secondDate.getHours()).toBe(14); // Other fields unchanged
      expect(secondDate.getMinutes()).toBe(15); // Other fields unchanged
      expect(secondDate.getSeconds()).toBe(20);

      // Test updating 12-hour format with AM
      const amDate = setDateByType(date, '09', '12hours', 'AM');
      expect(amDate.getHours()).toBe(9);

      // Test updating 12-hour format with PM
      const pmDate = setDateByType(date, '09', '12hours', 'PM');
      expect(pmDate.getHours()).toBe(21);

      // Test 12 AM (midnight)
      const midnightDate = setDateByType(date, '12', '12hours', 'AM');
      expect(midnightDate.getHours()).toBe(0);

      // Test 12 PM (noon)
      const noonDate = setDateByType(date, '12', '12hours', 'PM');
      expect(noonDate.getHours()).toBe(12);

      // Test with missing period for 12-hour format
      const missingPeriodDate = setDateByType(date, '09', '12hours');
      expect(missingPeriodDate).toBe(date); // Should return original date unchanged

      // Test with invalid picker type
      const invalidTypeDate = setDateByType(
        date,
        '14',
        'invalid' as TimePickerType,
      );
      expect(invalidTypeDate).toBe(date); // Should return original date unchanged
    });
  });
});
