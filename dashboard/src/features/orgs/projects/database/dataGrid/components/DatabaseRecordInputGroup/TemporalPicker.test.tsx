import { useState } from 'react';
import { vi } from 'vitest';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import TemporalPicker from './TemporalPicker';

function ControlledTemporalPicker({
  baseType,
  initialValue,
}: {
  baseType: string;
  initialValue: string | null;
}) {
  const [value, setValue] = useState<string | null>(initialValue);

  return (
    <>
      <TemporalPicker baseType={baseType} value={value} onChange={setValue} />
      <span data-testid="value">{value ?? 'null'}</span>
    </>
  );
}

describe('TemporalPicker', () => {
  it('renders a raw date input for date columns', () => {
    render(
      <TemporalPicker baseType="date" value="2025-04-10" onChange={vi.fn()} />,
    );

    expect(screen.getByRole('combobox')).toHaveValue('2025-04-10');
  });

  it('renders a raw datetime input for timestamp columns', () => {
    render(
      <TemporalPicker
        baseType="timestamp without time zone"
        value="2025-04-10T12:00:00"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox')).toHaveValue('2025-04-10T12:00:00');
  });

  it('renders a raw time input for time columns', () => {
    render(
      <TemporalPicker
        baseType="time without time zone"
        value="08:30:00"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox')).toHaveValue('08:30:00');
  });

  it('opens the date picker when the input is focused', async () => {
    render(
      <TemporalPicker baseType="date" value="2025-04-10" onChange={vi.fn()} />,
    );
    const user = new TestUserEvent();

    await user.click(screen.getByRole('combobox'));

    expect(screen.getByText('April 2025')).toBeInTheDocument();
  });

  it('moves focus into the picker popup on Tab from the input', async () => {
    render(
      <TemporalPicker
        baseType="time without time zone"
        value="08:30:00"
        onChange={vi.fn()}
      />,
    );
    const user = new TestUserEvent();

    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{Tab}');

    await waitFor(() => expect(screen.getByLabelText('Hours')).toHaveFocus());
  });

  it('emits raw strings when typed', async () => {
    render(<ControlledTemporalPicker baseType="date" initialValue={null} />);
    const user = new TestUserEvent();

    await user.type(screen.getByRole('combobox'), '2025-04-10');

    expect(screen.getByTestId('value')).toHaveTextContent('2025-04-10');
  });

  it('writes a yyyy-MM-dd string when picking a date', async () => {
    render(
      <ControlledTemporalPicker baseType="date" initialValue="2025-04-10" />,
    );
    const user = new TestUserEvent();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('13'));
    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent('2025-04-13'),
    );
  });

  it('writes a local timestamp string when picking a timestamp without time zone', async () => {
    render(
      <ControlledTemporalPicker
        baseType="timestamp without time zone"
        initialValue="2025-04-10T12:00:00"
      />,
    );
    const user = new TestUserEvent();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('13'));
    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent(
        '2025-04-13T12:00:00',
      ),
    );
  });

  it('writes a HH:mm:ss string when picking a time', async () => {
    render(
      <ControlledTemporalPicker
        baseType="time without time zone"
        initialValue="00:00:00"
      />,
    );
    const user = new TestUserEvent();

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByLabelText('Hours'), '11');
    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent('11:00:00'),
    );
  });

  it('treats time with time zone columns as timezone-aware time pickers', async () => {
    render(
      <ControlledTemporalPicker
        baseType="time with time zone"
        initialValue="08:30:00+05"
      />,
    );
    const user = new TestUserEvent();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent(/\+00$/),
    );
  });

  it('treats timestamp with time zone columns as timezone-aware datetime pickers', async () => {
    render(
      <TemporalPicker
        baseType="timestamp with time zone"
        value="2025-04-10T12:00:00.000Z"
        onChange={vi.fn()}
      />,
    );
    const user = new TestUserEvent();

    await user.click(screen.getByRole('combobox'));

    expect(screen.getByText(/Timezone:/)).toBeInTheDocument();
  });
});
