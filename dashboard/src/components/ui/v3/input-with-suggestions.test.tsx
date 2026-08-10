import { useState } from 'react';
import { vi } from 'vitest';
import {
  type InputSuggestion,
  InputWithSuggestions,
} from '@/components/ui/v3/input-with-suggestions';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

mockPointerEvent();

const SUGGESTIONS: InputSuggestion[] = [
  { label: 'now()', value: 'now()' },
  { label: 'gen_random_uuid()', value: 'gen_random_uuid()' },
];

function Harness({
  onChange,
  ...props
}: {
  onChange?: (value: string) => void;
  filterSuggestions?: boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <InputWithSuggestions
      aria-label="Value"
      value={value}
      suggestions={SUGGESTIONS}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      {...props}
    />
  );
}

function getInput() {
  return screen.getByRole('combobox', { name: 'Value' });
}

describe('InputWithSuggestions', () => {
  it('treats the typed text as the value', async () => {
    const user = new TestUserEvent();
    render(<Harness />);

    await user.type(getInput(), "'hello'");

    expect(getInput()).toHaveValue("'hello'");
  });

  it('shows suggestions on focus and fills the input when one is picked', async () => {
    const user = new TestUserEvent();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(getInput());
    await user.click(screen.getByRole('option', { name: 'now()' }));

    expect(onChange).toHaveBeenLastCalledWith('now()');
    expect(getInput()).toHaveValue('now()');
  });

  it('filters suggestions by the typed value', async () => {
    const user = new TestUserEvent();
    render(<Harness />);

    await user.type(getInput(), 'gen');

    expect(
      screen.getByRole('option', { name: 'gen_random_uuid()' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'now()' }),
    ).not.toBeInTheDocument();
  });

  it('does not filter when filterSuggestions is false', async () => {
    const user = new TestUserEvent();
    render(<Harness filterSuggestions={false} />);

    await user.type(getInput(), 'zzz');

    expect(screen.getByRole('option', { name: 'now()' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'gen_random_uuid()' }),
    ).toBeInTheDocument();
  });

  it('navigates with the arrow keys and selects with Enter', async () => {
    const user = new TestUserEvent();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(getInput(), '{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenLastCalledWith('gen_random_uuid()');
    expect(getInput()).toHaveValue('gen_random_uuid()');
  });

  it('closes the list on Escape without changing the value', async () => {
    const user = new TestUserEvent();
    render(<Harness />);

    await user.click(getInput());
    expect(screen.getByRole('option', { name: 'now()' })).toBeInTheDocument();

    await user.type(getInput(), '{Escape}');

    expect(
      screen.queryByRole('option', { name: 'now()' }),
    ).not.toBeInTheDocument();
  });

  it('closes the list when focus leaves the component', async () => {
    const user = new TestUserEvent();
    render(
      <>
        <Harness />
        <button type="button">outside</button>
      </>,
    );

    await user.click(getInput());
    expect(screen.getByRole('option', { name: 'now()' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'outside' }));

    expect(
      screen.queryByRole('option', { name: 'now()' }),
    ).not.toBeInTheDocument();
  });
});
