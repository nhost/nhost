import { vi } from 'vitest';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import SchemaDiagramToolbar, {
  type SchemaDiagramToolbarProps,
} from './SchemaDiagramToolbar';

mockPointerEvent();

function setup(overrides: Partial<SchemaDiagramToolbarProps> = {}) {
  const onRoleChange = vi.fn();
  const onSelectedSchemasChange = vi.fn();
  const onHideEmptyChange = vi.fn();
  const onNamingModeChange = vi.fn();
  const onNewTable = vi.fn();
  const onSelectObject = vi.fn();

  const props: SchemaDiagramToolbarProps = {
    roles: ['admin', 'public', 'user'],
    selectedRole: 'admin',
    onRoleChange,
    schemas: ['public', 'auth'],
    selectedSchemas: ['public', 'auth'],
    onSelectedSchemasChange,
    hideEmpty: false,
    onHideEmptyChange,
    namingMode: 'graphql',
    onNamingModeChange,
    onNewTable,
    canCreateTable: true,
    targetSchema: 'public',
    objects: [
      { kind: 'table', schema: 'public', name: 'users' },
      { kind: 'table', schema: 'public', name: 'posts' },
      {
        kind: 'function',
        schema: 'public',
        name: 'search_users',
        returnSchema: 'public',
      },
      { kind: 'table', schema: 'auth', name: 'sessions' },
    ],
    onSelectObject,
    ...overrides,
  };

  render(<SchemaDiagramToolbar {...props} />);

  return {
    onRoleChange,
    onSelectedSchemasChange,
    onHideEmptyChange,
    onNamingModeChange,
    onNewTable,
    onSelectObject,
  };
}

describe('SchemaDiagramToolbar', () => {
  it('calls onRoleChange when a role is picked from the role select', async () => {
    const { onRoleChange } = setup();
    const user = new TestUserEvent();

    const roleTrigger = screen
      .getByText('admin')
      .closest('[role="combobox"]') as HTMLElement;
    await user.click(roleTrigger);

    const userOption = await screen.findByRole('option', { name: 'user' });
    await user.click(userOption);

    expect(onRoleChange).toHaveBeenCalledWith('user');
  });

  it('calls onSelectedSchemasChange when a schema is toggled', async () => {
    const { onSelectedSchemasChange } = setup();
    const user = new TestUserEvent();

    // First combobox is the role select; second is the schemas multi-select.
    const [, schemasTrigger] = screen.getAllByRole('combobox');
    await user.click(schemasTrigger);

    const publicOption = await screen.findByRole('option', { name: 'public' });
    await user.click(publicOption);

    // Toggling "public" off should leave "auth" selected.
    expect(onSelectedSchemasChange).toHaveBeenCalledWith(['auth']);
  });

  it('calls onHideEmptyChange when the hide-empty switch is flipped for a non-admin role', async () => {
    const { onHideEmptyChange } = setup({ selectedRole: 'user' });
    const user = new TestUserEvent();

    const toggle = screen.getByLabelText('Hide tables without permissions');
    await user.click(toggle);

    expect(onHideEmptyChange).toHaveBeenCalledWith(true);
  });

  it('disables the hide-empty switch when the admin role is selected', () => {
    setup({ selectedRole: 'admin' });

    const toggle = screen.getByLabelText('Hide tables without permissions');
    expect(toggle).toBeDisabled();
  });

  it('disables the New Table button when canCreateTable is false', () => {
    setup({ canCreateTable: false });

    const newTableButton = screen.getByRole('button', { name: /New Table/i });
    expect(newTableButton).toBeDisabled();
    expect(newTableButton).toHaveAttribute('title', 'No schema available');
  });

  it('calls onNewTable when the New Table button is clicked', async () => {
    const { onNewTable } = setup();
    const user = new TestUserEvent();

    const newTableButton = screen.getByRole('button', { name: /New Table/i });
    expect(newTableButton).toHaveAttribute(
      'title',
      'Create a new table in "public"',
    );

    await user.click(newTableButton);
    expect(onNewTable).toHaveBeenCalledTimes(1);
  });

  it('lists tables and functions grouped by schema and fires onSelectObject on pick', async () => {
    const { onSelectObject } = setup();
    const user = new TestUserEvent();

    await user.click(
      screen.getByRole('button', { name: /Search database objects/i }),
    );

    // CommandGroup headings show the schema name once per group.
    await screen.findByRole('option', { name: /public\.users/i });

    const usersOption = screen.getByRole('option', { name: /public\.users/i });
    const postsOption = screen.getByRole('option', { name: /public\.posts/i });
    const functionOption = screen.getByRole('option', {
      name: /public\.search_users/i,
    });
    const sessionsOption = screen.getByRole('option', {
      name: /auth\.sessions/i,
    });
    expect(usersOption).toBeInTheDocument();
    expect(postsOption).toBeInTheDocument();
    expect(functionOption).toBeInTheDocument();
    expect(sessionsOption).toBeInTheDocument();

    await user.click(usersOption);

    expect(onSelectObject).toHaveBeenCalledWith({
      kind: 'table',
      schema: 'public',
      name: 'users',
    });

    // The popover should close after picking an object.
    await waitFor(() => {
      expect(
        screen.queryByRole('option', { name: /public\.users/i }),
      ).toBeNull();
    });
  });

  it('fires onSelectObject with the full function object when a function is picked', async () => {
    const { onSelectObject } = setup();
    const user = new TestUserEvent();

    await user.click(
      screen.getByRole('button', { name: /Search database objects/i }),
    );

    const functionOption = await screen.findByRole('option', {
      name: /public\.search_users/i,
    });
    await user.click(functionOption);

    expect(onSelectObject).toHaveBeenCalledWith({
      kind: 'function',
      schema: 'public',
      name: 'search_users',
      returnSchema: 'public',
    });
  });

  it('shows "No database objects found" when the object list is empty', async () => {
    setup({ objects: [] });
    const user = new TestUserEvent();

    await user.click(
      screen.getByRole('button', { name: /Search database objects/i }),
    );

    await screen.findByText('No database objects found.');
  });
});
