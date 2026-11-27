import { TZDate } from '@date-fns/tz';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import { guessTimezone } from '@/utils/timezoneUtils';
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
  it('Updates only the hour of the date object', async () => {
    render(<TestComponent dateTime="2025-03-10T03:00:05" />);
    expect(await screen.getByText(/Time:/i)).toHaveTextContent(
      'Time: 03:00:05',
    );
    const user = new TestUserEvent();
    const hoursInput = await screen.getByLabelText('Hours');
    await user.type(hoursInput, '18');
    expect(await screen.getByText(/Time:/i)).toHaveTextContent(
      'Time: 18:00:05',
    );
  });

  it('only valid hours(0-23), minutes(0-59) and seconds(0-59) are allowed', async () => {
    render(<TestComponent dateTime="2025-03-10T03:00:05" />);
    const user = new TestUserEvent();
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

  it('Updates only the minutes of the date object', async () => {
    render(<TestComponent dateTime="2025-03-10T03:00:05" />);
    const user = new TestUserEvent();
    const minutesInput = await screen.getByLabelText('Minutes');
    await user.type(minutesInput, '44');
    expect(await screen.getByText(/Time:/i)).toHaveTextContent(
      'Time: 03:44:05',
    );
  });

  it('Updates only the seconds of the date object', async () => {
    render(<TestComponent dateTime="2025-03-10T03:00:05" />);
    const user = new TestUserEvent();
    const secondsInput = await screen.getByLabelText('Seconds');
    await user.type(secondsInput, '11');
    expect(await screen.getByText(/Time:/i)).toHaveTextContent(
      'Time: 03:00:11',
    );
  });

  it("will preserve the date's class after changing the date", async () => {
    render(<TestComponent dateTime="2025-03-10T03:00:05" withTimezone />);
    expect(await screen.getByText(/Date class:/i)).toHaveTextContent(
      'Date class: TZDate',
    );
    const user = new TestUserEvent();

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
