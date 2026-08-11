import { vi } from 'vitest';
import { FreeCombobox } from '@/components/ui/v3/free-combobox';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

mockPointerEvent();

const OPTIONS = [{ value: 'now()', label: 'now()' }];

describe('FreeCombobox', () => {
  it('reports source "option" when a listed option is picked', async () => {
    const user = new TestUserEvent();
    const onChange = vi.fn();
    render(
      <FreeCombobox
        value={null}
        onChange={onChange}
        options={OPTIONS}
        aria-label="Value"
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Value' }));
    await user.click(screen.getByRole('option', { name: 'now()' }));

    expect(onChange).toHaveBeenCalledWith('now()', { source: 'option' });
  });

  it('reports source "custom" without an action key for the single customValueLabel path', async () => {
    const user = new TestUserEvent();
    const onChange = vi.fn();
    render(
      <FreeCombobox
        value={null}
        onChange={onChange}
        options={OPTIONS}
        aria-label="Value"
        customValueLabel={(input) => `Create ${input}`}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Value' }));
    await user.type(screen.getByPlaceholderText('Search...'), 'bar');
    await user.click(screen.getByRole('option', { name: 'Create bar' }));

    expect(onChange).toHaveBeenCalledWith('bar', { source: 'custom' });
  });

  it('reports the chosen action key when committing via customValueActions', async () => {
    const user = new TestUserEvent();
    const onChange = vi.fn();
    render(
      <FreeCombobox
        value={null}
        onChange={onChange}
        options={OPTIONS}
        aria-label="Value"
        customValueActions={[
          { key: 'text', label: (input) => `${input} as text` },
          { key: 'sql', label: (input) => `${input} as SQL` },
        ]}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Value' }));
    await user.type(screen.getByPlaceholderText('Search...'), 'foo');
    await user.click(screen.getByRole('option', { name: 'foo as SQL' }));

    expect(onChange).toHaveBeenCalledWith('foo', {
      source: 'custom',
      actionKey: 'sql',
    });
  });
});
