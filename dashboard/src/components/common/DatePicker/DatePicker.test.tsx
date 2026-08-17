import type { ChangeEvent, FocusEvent, KeyboardEvent } from 'react';
import { useState } from 'react';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import DatePicker, { type DatePickerProps } from './DatePicker';

function TestComponent({
  initialDate = null,
  ...props
}: Omit<DatePickerProps, 'date' | 'onDateChange'> & {
  initialDate?: string | null;
}) {
  const [date, setDate] = useState<string | null>(initialDate);

  return (
    <>
      <span data-testid="value">{date ?? 'empty'}</span>
      <button type="button" onClick={() => setDate('2025-06-20T12:00:00.000Z')}>
        external set june
      </button>
      <DatePicker {...props} date={date} onDateChange={setDate} />
    </>
  );
}

function CustomTriggerComponent() {
  const [date, setDate] = useState<string | null>('2025-04-10T12:00:00.000Z');
  const [inputValue, setInputValue] = useState('2025-04-10');

  return (
    <>
      <span data-testid="value">{date}</span>
      <DatePicker
        date={date}
        onDateChange={setDate}
        triggerSlot={({ triggerProps }) => {
          function handleFocus(event: FocusEvent<HTMLInputElement>) {
            triggerProps.onFocus?.(event);
          }

          function handleBlur(event: FocusEvent<HTMLInputElement>) {
            triggerProps.onBlur?.(event);
          }

          function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
            triggerProps.onKeyDown?.(event);
          }

          function handleChange(event: ChangeEvent<HTMLInputElement>) {
            setInputValue(event.target.value);
          }

          return (
            <input
              role="combobox"
              aria-label="Custom date"
              value={inputValue}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              aria-expanded={triggerProps['aria-expanded']}
              aria-haspopup={triggerProps['aria-haspopup']}
              aria-invalid={triggerProps['aria-invalid']}
            />
          );
        }}
      />
      <button type="button">outside</button>
    </>
  );
}

describe('DatePicker', () => {
  it('shows the empty label when there is no value', () => {
    render(<TestComponent emptyLabel="Select a date" />);

    expect(screen.getByTestId('datePickerTrigger')).toHaveTextContent(
      'Select a date',
    );
  });

  it('shows the picked day on the trigger after selecting', async () => {
    render(<TestComponent initialDate="2025-04-10T12:00:00.000Z" />);
    const user = new TestUserEvent();

    await user.click(screen.getByTestId('datePickerTrigger'));
    await user.click(screen.getByText('13'));
    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Select' }),
      ).not.toBeInTheDocument(),
    );

    expect(screen.getByTestId('datePickerTrigger')).toHaveTextContent(
      'April 13th, 2025',
    );
  });

  it('emits null when the Clear button is clicked', async () => {
    render(<TestComponent initialDate="2025-04-10T12:00:00.000Z" clearable />);
    const user = new TestUserEvent();

    await user.click(screen.getByTestId('datePickerTrigger'));
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent('empty'),
    );
    expect(screen.getByTestId('datePickerTrigger')).toHaveTextContent(
      'Select a date',
    );
  });

  it('does not allow picking a disabled day', async () => {
    render(
      <TestComponent
        initialDate="2025-04-10T12:00:00.000Z"
        isCalendarDayDisabled={(date) => date.getDate() === 15}
      />,
    );
    const user = new TestUserEvent();

    await user.click(screen.getByTestId('datePickerTrigger'));

    expect(screen.getByText('15')).toBeDisabled();
    expect(screen.getByText('14')).not.toBeDisabled();
  });

  it('renders a destructive trigger border when error is set', () => {
    render(<TestComponent error />);

    expect(screen.getByTestId('datePickerTrigger')).toHaveClass(
      'border-destructive',
    );
  });

  it('reflects an external value change when reopened', async () => {
    render(<TestComponent initialDate="2025-04-10T12:00:00.000Z" />);
    const user = new TestUserEvent();

    await user.click(screen.getByTestId('datePickerTrigger'));
    expect(screen.getByText('April 2025')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'external set june' }));
    await user.click(screen.getByTestId('datePickerTrigger'));

    expect(screen.getByText('June 2025')).toBeInTheDocument();
  });

  it('opens a custom input trigger on focus and closes on outside blur', async () => {
    render(<CustomTriggerComponent />);
    const user = new TestUserEvent();

    await user.click(screen.getByRole('combobox', { name: 'Custom date' }));
    expect(screen.getByText('April 2025')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'outside' }));

    await waitFor(() =>
      expect(screen.queryByText('April 2025')).not.toBeInTheDocument(),
    );
  });

  it('keeps a custom input trigger open while interacting with the calendar', async () => {
    render(<CustomTriggerComponent />);
    const user = new TestUserEvent();

    await user.click(screen.getByRole('combobox', { name: 'Custom date' }));
    await user.click(screen.getByText('13'));

    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() =>
      expect(screen.getByTestId('value')).not.toHaveTextContent(
        '2025-04-10T12:00:00.000Z',
      ),
    );
    expect(
      new Date(screen.getByTestId('value').textContent ?? '').getDate(),
    ).toBe(13);
  });

  it('preserves a custom input trigger selection when the input is refocused', async () => {
    render(<CustomTriggerComponent />);
    const user = new TestUserEvent();
    const customTrigger = screen.getByRole('combobox', { name: 'Custom date' });

    await user.click(customTrigger);
    await user.click(screen.getByText('13'));
    await user.click(customTrigger);
    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() =>
      expect(screen.getByTestId('value')).not.toHaveTextContent(
        '2025-04-10T12:00:00.000Z',
      ),
    );
    expect(
      new Date(screen.getByTestId('value').textContent ?? '').getDate(),
    ).toBe(13);
  });
});
