import { isBefore, startOfDay } from 'date-fns';
import { useState } from 'react';
import { TZDate } from 'react-day-picker';
import { vi } from 'vitest';
import { isTZDate } from '@/components/common/TimePicker/time-picker-utils';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import DateTimePicker, { type DateTimePickerProps } from './DateTimePicker';

vi.mock('@/utils/timezoneUtils', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actualTimezoneUtils = await vi.importActual<any>(
    '@/utils/timezoneUtils',
  );
  return {
    ...actualTimezoneUtils,
    guessTimezone: () => 'Europe/Helsinki',
  };
});

const earliestBackupDate = '2025-03-13T02:00:05.000Z';

function TestComponent(
  props: Omit<DateTimePickerProps, 'dateTime' | 'onDateTimeChange'>,
) {
  const [dateTime, setDateTime] = useState<string | null>(earliestBackupDate);

  function isCalendarDayDisabled(date: Date | TZDate) {
    if (isTZDate(date)) {
      const utcDay = new Date(date.getTime()).toISOString();
      const tzDate = new TZDate(utcDay, date.timeZone);
      const earliestBackupDateInTz = new TZDate(
        earliestBackupDate,
        date.timeZone,
      );
      return isBefore(startOfDay(tzDate), startOfDay(earliestBackupDateInTz));
    }

    return isBefore(
      startOfDay(new Date(date.getTime())),
      startOfDay(new Date(earliestBackupDate)),
    );
  }

  return (
    <>
      <h1 data-testid="utcDate">{dateTime}</h1>
      <DateTimePicker
        {...props}
        isCalendarDayDisabled={isCalendarDayDisabled}
        dateTime={dateTime}
        onDateTimeChange={setDateTime}
      />
    </>
  );
}

function ControlledDateTimePicker({
  initialDateTime = null,
  ...props
}: Omit<DateTimePickerProps, 'dateTime' | 'onDateTimeChange'> & {
  initialDateTime?: string | null;
}) {
  const [dateTime, setDateTime] = useState<string | null>(initialDateTime);

  return (
    <>
      <span data-testid="value">{dateTime ?? 'empty'}</span>
      <button
        type="button"
        onClick={() => setDateTime('2025-06-20T12:00:00.000Z')}
      >
        external set june
      </button>
      <DateTimePicker
        {...props}
        dateTime={dateTime}
        onDateTimeChange={setDateTime}
      />
    </>
  );
}

describe('DateTimePicker', () => {
  it('shows the empty label when there is no value', () => {
    render(<ControlledDateTimePicker emptyLabel="Select a date" />);

    expect(screen.getByTestId('dateTimePickerTrigger')).toHaveTextContent(
      'Select a date',
    );
  });

  it('emits null when the Clear button is clicked', async () => {
    render(
      <ControlledDateTimePicker
        initialDateTime="2025-04-10T12:00:00.000Z"
        clearable
      />,
    );
    const user = new TestUserEvent();

    await user.click(screen.getByTestId('dateTimePickerTrigger'));
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent('empty'),
    );
    expect(screen.getByTestId('dateTimePickerTrigger')).toHaveTextContent(
      'Select a date',
    );
  });

  it('renders a destructive trigger border when error is set', () => {
    render(<ControlledDateTimePicker error />);

    expect(screen.getByTestId('dateTimePickerTrigger')).toHaveClass(
      'border-destructive',
    );
  });

  it('reflects an external value change when reopened', async () => {
    render(
      <ControlledDateTimePicker initialDateTime="2025-04-10T12:00:00.000Z" />,
    );
    const user = new TestUserEvent();

    await user.click(screen.getByTestId('dateTimePickerTrigger'));
    expect(screen.getByText('April 2025')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'external set june' }));
    await user.click(screen.getByTestId('dateTimePickerTrigger'));

    expect(screen.getByText('June 2025')).toBeInTheDocument();
  });

  test('when the date changes datetime is emitted in utc string format', async () => {
    render(<TestComponent />);
    const user = new TestUserEvent();

    await user.click(await screen.findByTestId('dateTimePickerTrigger'));

    expect(
      await screen.findByRole('button', { name: 'Select' }),
    ).toBeInTheDocument();

    expect(screen.getByText('March 2025')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Go to the Next Month' }),
    );
    expect(screen.getByText('April 2025')).toBeInTheDocument();

    await user.click(screen.getByText('13'));

    const hoursInput = screen.getByLabelText('Hours');
    await user.type(hoursInput, '11');

    const minutesInput = screen.getByLabelText('Minutes');
    await user.type(minutesInput, '12');

    const secondsInput = screen.getByLabelText('Seconds');
    await user.type(secondsInput, '13');

    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(async () =>
      expect(
        screen.queryByRole('button', { name: 'Select' }),
      ).not.toBeInTheDocument(),
    );

    expect(screen.getByTestId('utcDate')).toHaveTextContent(
      '2025-04-13T08:12:13.000Z',
    );
  });

  test('timezone can be changed and the calendar is updated', async () => {
    await waitFor(() => render(<TestComponent withTimezone />));
    const user = new TestUserEvent();

    await user.click(await screen.findByTestId('dateTimePickerTrigger'));

    expect(await screen.findByText(/Timezone:/)).toBeInTheDocument();

    expect(
      await screen.findByTestId('timezoneSettingsButton'),
    ).toBeInTheDocument();

    expect(await screen.findByText(/Timezone: /i)).toHaveTextContent(
      'Timezone: UTC+02:00',
    );
    expect(await screen.getByText('12')).toBeDisabled();

    await user.click(await screen.findByTestId('timezoneSettingsButton'));
    const tzInput = await screen.findByPlaceholderText('Search timezones...');
    expect(tzInput).toBeInTheDocument();

    await user.type(tzInput, 'America/Chicago{ArrowDown}{Enter}');

    expect(
      screen.queryByPlaceholderText('Search timezones...'),
    ).not.toBeInTheDocument();

    expect(await screen.findByText(/Timezone: /i)).toHaveTextContent(
      'Timezone: UTC-05:00',
    );

    const selectedDay = screen.getByText('12');
    expect(selectedDay).not.toBeDisabled();
    expect(await screen.getByText('11')).toBeDisabled();
    const gridCell = selectedDay.closest('[role="gridcell"]');
    expect(gridCell).toHaveClass('[&>button]:bg-primary');
  });

  test('Displays the correct time zone offset when changing the selected date from standard time (ST) to daylight saving time (DST)', async () => {
    await waitFor(() => render(<TestComponent withTimezone />));
    const user = new TestUserEvent();

    await user.click(await screen.findByTestId('dateTimePickerTrigger'));

    expect(await screen.findByText(/Timezone:/)).toBeInTheDocument();
    expect(
      await screen.findByTestId('timezoneSettingsButton'),
    ).toBeInTheDocument();

    expect(await screen.findByText(/Timezone: /i)).toHaveTextContent(
      'Timezone: UTC+02:00',
    );

    expect(screen.getByText('March 2025')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Go to the Next Month' }),
    );

    expect(screen.getByText('April 2025')).toBeInTheDocument();

    await user.click(screen.getByText('18'));

    expect(await screen.findByText(/Timezone: /i)).toHaveTextContent(
      'Timezone: UTC+03:00',
    );

    await user.click(
      screen.getByRole('button', { name: 'Go to the Previous Month' }),
    );

    expect(screen.getByText('March 2025')).toBeInTheDocument();

    await user.click(screen.getByText('21'));

    expect(await screen.findByText(/Timezone: /i)).toHaveTextContent(
      'Timezone: UTC+02:00',
    );
  });
});
