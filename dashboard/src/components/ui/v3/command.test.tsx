import { vi } from 'vitest';
import {
  Command,
  CommandCreateItem,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/v3/command';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

mockPointerEvent();

/**
 * `CommandCreateItem` is a repo-local addition to the shadcn-generated
 * `command.tsx`. This pins the `value` prop — which lets several create rows
 * coexist without colliding — so it survives a shadcn regeneration of the file.
 */
describe('CommandCreateItem', () => {
  it('keeps multiple create rows independent when given distinct values', async () => {
    const user = new TestUserEvent();
    const onText = vi.fn();
    const onSql = vi.fn();
    render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandEmpty>none</CommandEmpty>
          <CommandCreateItem
            value="create-text"
            onCreate={onText}
            label={(query) => `${query} as text`}
          />
          <CommandCreateItem
            value="create-sql"
            onCreate={onSql}
            label={(query) => `${query} as SQL`}
          />
        </CommandList>
      </Command>,
    );

    await user.type(screen.getByPlaceholderText('Search...'), 'now()');

    expect(
      screen.getByRole('option', { name: 'now() as text' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'now() as SQL' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'now() as SQL' }));

    expect(onSql).toHaveBeenCalledWith('now()');
    expect(onText).not.toHaveBeenCalled();
  });
});
