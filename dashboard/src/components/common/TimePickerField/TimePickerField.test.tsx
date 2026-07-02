import { useState } from 'react';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import TimePickerField, { type TimePickerFieldProps } from './TimePickerField';

function TestComponent({
  initialTime = null,
  ...props
}: Omit<TimePickerFieldProps, 'time' | 'onTimeChange'> & {
  initialTime?: string | null;
}) {
  const [time, setTime] = useState<string | null>(initialTime);

  return (
    <>
      <span data-testid="value">{time ?? 'empty'}</span>
      <TimePickerField {...props} time={time} onTimeChange={setTime} />
    </>
  );
}

describe('TimePickerField', () => {
  it('shows the empty label when there is no value', () => {
    render(<TestComponent emptyLabel="Select a time" />);

    expect(screen.getByTestId('timePickerTrigger')).toHaveTextContent(
      'Select a time',
    );
  });

  it('emits the picked time as a HH:mm:ss string', async () => {
    render(<TestComponent initialTime="00:00:00" />);
    const user = new TestUserEvent();

    await user.click(screen.getByTestId('timePickerTrigger'));

    await user.type(screen.getByLabelText('Hours'), '11');
    await user.type(screen.getByLabelText('Minutes'), '12');
    await user.type(screen.getByLabelText('Seconds'), '13');

    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Select' }),
      ).not.toBeInTheDocument(),
    );

    expect(screen.getByTestId('value')).toHaveTextContent('11:12:13');
  });

  it('emits null when the Clear button is clicked', async () => {
    render(<TestComponent initialTime="08:30:00" clearable />);
    const user = new TestUserEvent();

    await user.click(screen.getByTestId('timePickerTrigger'));
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent('empty'),
    );
    expect(screen.getByTestId('timePickerTrigger')).toHaveTextContent(
      'Select a time',
    );
  });

  it('displays a timetz value including its offset', () => {
    render(<TestComponent initialTime="08:30:00+05" />);

    expect(screen.getByTestId('timePickerTrigger')).toHaveTextContent(
      '08:30:00+05',
    );
  });

  it('displays a time value with fractional seconds', () => {
    render(<TestComponent initialTime="08:30:00.123456" />);

    expect(screen.getByTestId('timePickerTrigger')).toHaveTextContent(
      '08:30:00.123456',
    );
  });

  it('preserves fractional seconds when selecting a time', async () => {
    render(<TestComponent initialTime="08:30:00.123456" />);
    const user = new TestUserEvent();

    await user.click(screen.getByTestId('timePickerTrigger'));
    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent('08:30:00.123456'),
    );
  });

  it('renders a destructive trigger border when error is set', () => {
    render(<TestComponent error />);

    expect(screen.getByTestId('timePickerTrigger')).toHaveClass(
      'border-destructive',
    );
  });

  it('edits and emits UTC time with a +00 offset', async () => {
    render(<TestComponent initialTime="08:30:00.123456+00" utc />);
    const user = new TestUserEvent();

    await user.click(screen.getByTestId('timePickerTrigger'));

    expect(screen.getByLabelText('Hours')).toHaveValue('08');
    expect(screen.getByLabelText('Minutes')).toHaveValue('30');

    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent(
        '08:30:00.123456+00',
      ),
    );
  });

  it('shows a UTC indicator on the trigger when utc is true', () => {
    render(<TestComponent initialTime="08:30:00" utc />);

    expect(screen.getByTestId('timePickerTrigger')).toHaveTextContent('UTC');
  });
});
