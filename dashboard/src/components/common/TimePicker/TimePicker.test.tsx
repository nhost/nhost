import { render, screen } from '@/tests/orgs/testUtils';
import { guessTimezone } from '@/utils/timezoneUtils';
import { TZDate } from '@date-fns/tz';
import userEvent from '@testing-library/user-event';
import { parseISO } from 'date-fns';
import { format } from 'date-fns-v4';
import { useState } from 'react';
import TimePicker from './TimePicker';

function TestComponent({
  dateTime,
  withTimezone,
}: {
  dateTime: string;
  withTimezone?: boolean;
}) {
  const [date, setDate] = useState(() => {
    if (withTimezone) {
      const tz = guessTimezone();
      return new TZDate(dateTime, tz);
    }
    return parseISO(dateTime);
  });

  return (
    <>
      <h1>Time: {format(date, 'HH:mm:ss')}</h1>
      <h1>Date class: {date instanceof TZDate ? 'TZDate' : 'Date'}</h1>
      <TimePicker date={date} setDate={setDate} />
    </>
  );
}
describe('TimePicker', () => {
  test('Updates only the hour of the date object', async () => {
    render(<TestComponent dateTime="2025-03-10T03:00:05" />);
    expect(await screen.getByText(/Time:/i)).toHaveTextContent(
      'Time: 03:00:05',
    );
    const user = userEvent.setup();
    const hoursInput = await screen.getByLabelText('Hours');
    await user.type(hoursInput, '18');
    expect(await screen.getByText(/Time:/i)).toHaveTextContent(
      'Time: 18:00:05',
    );
  });

  test('only valid hours(0-23), minutes(0-59) and seconds(0-59) are allowed', async () => {
    render(<TestComponent dateTime="2025-03-10T03:00:05" />);
    const user = userEvent.setup();
    const hoursInput = await screen.getByLabelText('Hours');
    await user.type(hoursInput, '30');
    expect(await screen.getByText(/Time:/i)).toHaveTextContent(
      'Time: 23:00:05',
    );
    const minutesInput = await screen.getByLabelText('Minutes');
    await user.type(minutesInput, '66');
    expect(await screen.getByText(/Time:/i)).toHaveTextContent(
      'Time: 23:59:05',
    );
  });

  test('Updates only the minutes of the date object', async () => {
    render(<TestComponent dateTime="2025-03-10T03:00:05" />);
    const user = userEvent.setup();
    const minutesInput = await screen.getByLabelText('Minutes');
    await user.type(minutesInput, '44');
    expect(await screen.getByText(/Time:/i)).toHaveTextContent(
      'Time: 03:44:05',
    );
  });

  test('Updates only the seconds of the date object', async () => {
    render(<TestComponent dateTime="2025-03-10T03:00:05" />);
    const user = userEvent.setup();
    const secondsInput = await screen.getByLabelText('Seconds');
    await user.type(secondsInput, '11');
    expect(await screen.getByText(/Time:/i)).toHaveTextContent(
      'Time: 03:00:11',
    );
  });

  test("will preserve the date's class after changing the date", async () => {
    render(<TestComponent dateTime="2025-03-10T03:00:05" withTimezone />);
    expect(await screen.getByText(/Date class:/i)).toHaveTextContent(
      'Date class: TZDate',
    );
    const user = userEvent.setup();

    const hoursInput = await screen.getByLabelText('Hours');
    await user.type(hoursInput, '18');
    expect(await screen.getByText(/Date class:/i)).toHaveTextContent(
      'Date class: TZDate',
    );
    const secondsInput = await screen.getByLabelText('Seconds');
    await user.type(secondsInput, '11');
    expect(await screen.getByText(/Date class:/i)).toHaveTextContent(
      'Date class: TZDate',
    );
    const minutesInput = await screen.getByLabelText('Minutes');
    await user.type(minutesInput, '44');
    expect(await screen.getByText(/Date class:/i)).toHaveTextContent(
      'Date class: TZDate',
    );
  });
});
