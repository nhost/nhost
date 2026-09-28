import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import LogicalModelPermissionForm from '@/features/orgs/projects/database/native-queries/components/LogicalModelPermissionForm/LogicalModelPermissionForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import type {
  CreateLogicalModelSelectPermissionArgs,
  LogicalModelItem,
  LogicalModelSelectPermission,
  MigrationRequest,
} from '@/utils/hasura-api/generated/schemas';

const model: LogicalModelItem = {
  name: 'author',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    { name: 'name', type: { scalar: 'text', nullable: true } },
    { name: 'profile', type: { logical_model: 'profile', nullable: true } },
  ],
};

let migrationBodies: MigrationRequest[] = [];
let migrationFinished: Promise<void> | undefined;
let releaseMigration: VoidFunction | undefined;

const server = setupServer(
  tokenQuery,
  tableQuery,
  hasuraMetadataQuery,
  getProjectQuery,
  permissionVariablesQuery,
  http.post(
    'https://local.hasura.local.nhost.run/apis/migrate',
    async ({ request }) => {
      migrationBodies.push((await request.json()) as MigrationRequest);
      await migrationFinished;
      return HttpResponse.json({ name: '0_update_native_query_metadata' });
    },
  ),
);

vi.mock('next/router', async () => {
  const { mockRouter } = await import('@/tests/mocks');
  return {
    useRouter: () => ({
      ...mockRouter,
      query: { ...mockRouter.query, dataSourceSlug: 'default' },
    }),
  };
});
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: {
      subdomain: 'test-project',
      region: 'local',
      config: { hasura: { adminSecret: 'secret' } },
    },
    loading: false,
  }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => false,
}));
vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({
    useGetMetadataResourceVersion: () => ({ data: 244 }),
  }),
);

function renderForm(
  permission?: LogicalModelSelectPermission,
  comment?: string,
) {
  const onCancel = vi.fn();
  const onRoleChange = vi.fn();
  render(
    // biome-ignore lint/a11y/useValidAriaRole: This component's role prop names a permission role, not an ARIA role.
    <LogicalModelPermissionForm
      model={{
        ...model,
        select_permissions: permission
          ? [{ role: 'user', permission, comment }]
          : undefined,
      }}
      role="user"
      availableRoles={['user', 'auditor']}
      onRoleChange={onRoleChange}
      onCancel={onCancel}
    />,
  );
  return { onCancel, onRoleChange };
}

function holdMigration() {
  const { promise, resolve } = Promise.withResolvers<void>();
  migrationFinished = promise;
  releaseMigration = resolve;
  return resolve;
}

async function waitForSavedPermission(
  expectedArgs: CreateLogicalModelSelectPermissionArgs,
) {
  await waitFor(() =>
    expect(migrationBodies.at(-1)?.up.at(-1)).toEqual({
      type: 'pg_create_logical_model_select_permission',
      args: expectedArgs,
    }),
  );
}

describe('LogicalModelPermissionForm', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
      'https://local.graphql.local.nhost.run/v1';
    server.listen({ onUnhandledRequest: 'error' });
    mockScrollIntoViewAndPointerCapture();
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    migrationBodies = [];
    migrationFinished = undefined;
    releaseMigration = undefined;
  });

  afterEach(() => {
    releaseMigration?.();
    server.resetHandlers();
    act(() => toast.remove());
  });

  afterAll(() => server.close());

  it('shows the stored fields and custom check of the role', () => {
    renderForm({
      columns: ['id'],
      filter: { id: { _eq: 'X-Hasura-User-Id' } },
    });

    expect(screen.getByLabelText('Role:')).toHaveTextContent('user');
    const actionSwitcher = screen.getByLabelText('Action:');
    expect(actionSwitcher).toBeDisabled();
    expect(actionSwitcher).toHaveTextContent('Select');
    expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'name' })).not.toBeChecked();
    expect(screen.getByLabelText('With custom check')).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Select All' }),
    ).toBeInTheDocument();
  });

  it('selects every field for a wildcard permission', () => {
    renderForm({ columns: '*', filter: {} });

    expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'name' })).toBeChecked();
    expect(screen.getByLabelText('Without any checks')).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Deselect All' }),
    ).toBeInTheDocument();
  });

  it('disables Save until the permission changes and again after reverting', async () => {
    const user = new TestUserEvent();
    renderForm({ columns: '*', filter: {} });

    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await user.click(screen.getByLabelText('With custom check'));
    expect(save).toBeEnabled();

    await user.click(screen.getByLabelText('Without any checks'));
    expect(save).toBeDisabled();
  });

  it('saves an unrestricted filter when switching off a stored custom check', async () => {
    const user = new TestUserEvent();
    renderForm({
      columns: ['id'],
      filter: { id: { _eq: 'X-Hasura-User-Id' } },
    });

    await user.click(screen.getByLabelText('Without any checks'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'user',
      permission: { columns: ['id'], filter: {} },
    });
  });

  it('validates the JSON custom check and saves the serialized filter', async () => {
    const user = new TestUserEvent();
    renderForm({ columns: ['id'], filter: {} });

    await user.click(screen.getByLabelText('With custom check'));
    await user.click(screen.getByRole('button', { name: 'JSON' }));
    const jsonEditor = screen.getByRole('textbox');
    await user.clear(jsonEditor);
    await user.paste('{');
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();

    await user.clear(jsonEditor);
    await user.paste('{"_and":[]}');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(/please add at least one rule/i),
    ).toBeInTheDocument();
    expect(migrationBodies).toEqual([]);

    const filter = { id: { _eq: 'X-Hasura-User-Id' } };
    await user.clear(jsonEditor);
    await user.paste(JSON.stringify(filter));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'user',
      permission: { columns: ['id'], filter },
    });
  });

  it.each([
    {
      label: '_is_null',
      filter: { id: { _is_null: true } },
    },
    {
      label: 'compound _or alternative',
      filter: {
        _or: [
          {
            id: { _eq: 'X-Hasura-User-Id' },
            name: { _eq: 'private' },
          },
          { name: { _eq: 'public' } },
        ],
      },
    },
    {
      label: 'multi-operator _or alternative',
      filter: {
        _or: [
          { name: { _ilike: '%a%', _neq: 'b' } },
          { id: { _eq: 'X-Hasura-User-Id' } },
        ],
      },
    },
  ])(
    'opens a stored $label filter in Visual and round-trips it',
    async ({ filter }) => {
      const user = new TestUserEvent();
      renderForm({ columns: ['id'], filter });

      expect(screen.getByRole('button', { name: 'Visual' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await user.click(screen.getByRole('checkbox', { name: 'name' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitForSavedPermission({
        source: 'default',
        name: model.name,
        role: 'user',
        permission: { columns: ['id', 'name'], filter },
      });
    },
  );

  it('opens an outer column comparison in Visual and saves it', async () => {
    const user = new TestUserEvent();
    const filter = { id: { _ceq: ['id'] } };
    renderForm({ columns: ['id'], filter });

    const visual = screen.getByRole('button', { name: 'Visual' });
    expect(visual).toBeEnabled();
    expect(visual).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('combobox', {
        name: 'Logical model comparison field',
      }),
    ).toHaveTextContent('id');

    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    await user.click(save);
    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'user',
      permission: { columns: ['id', 'name'], filter },
    });
  });

  it('preserves unedited permission settings and comment when editing', async () => {
    const user = new TestUserEvent();
    const permission = {
      columns: ['id'],
      filter: { id: { _ceq: ['id'] } },
      limit: 25,
      allow_aggregations: true,
      computed_fields: ['display_name'],
      query_root_fields: ['select'],
      subscription_root_fields: ['select'],
    };
    renderForm(permission, 'Preserve this permission comment.');

    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'user',
      comment: 'Preserve this permission comment.',
      permission: { ...permission, columns: ['id', 'name'] },
    });
  });

  it('saves a permission for a role that does not have one yet', async () => {
    const user = new TestUserEvent();
    const { onCancel } = renderForm();

    expect(
      screen.queryByRole('button', { name: 'Delete Permissions' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'id' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'user',
      permission: { columns: ['id'], filter: {} },
    });
    expect(
      await screen.findByText('Select permission saved.'),
    ).toBeInTheDocument();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables Save and Delete Permissions until the save finishes', async () => {
    const user = new TestUserEvent();
    const release = holdMigration();
    const { onCancel } = renderForm({ columns: '*', filter: {} });
    const save = screen.getByRole('button', { name: 'Save' });
    const deletePermissions = screen.getByRole('button', {
      name: 'Delete Permissions',
    });

    await user.click(screen.getByRole('checkbox', { name: 'id' }));
    await user.click(save);
    await waitFor(() => expect(migrationBodies).toHaveLength(1));

    expect(save).toBeDisabled();
    expect(deletePermissions).toBeDisabled();
    expect(onCancel).not.toHaveBeenCalled();

    release();

    expect(
      await screen.findByText('Select permission saved.'),
    ).toBeInTheDocument();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables Delete Permissions until the delete finishes', async () => {
    const user = new TestUserEvent();
    const release = holdMigration();
    const { onCancel } = renderForm({ columns: '*', filter: {} });
    const deletePermissions = screen.getByRole('button', {
      name: 'Delete Permissions',
    });

    await user.click(deletePermissions);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(migrationBodies).toHaveLength(1));

    expect(deletePermissions).toBeDisabled();
    expect(onCancel).not.toHaveBeenCalled();

    release();

    expect(
      await screen.findByText('Select permission deleted.'),
    ).toBeInTheDocument();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('guards dirty Cancel and confirmed role switching', async () => {
    const user = new TestUserEvent();
    const { onCancel, onRoleChange } = renderForm({ columns: '*', filter: {} });

    await user.click(screen.getByRole('button', { name: 'Deselect All' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(/unsaved local changes/i)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Unsaved changes' }),
      ).not.toBeInTheDocument(),
    );
    expect(onCancel).not.toHaveBeenCalled();

    await user.click(screen.getByRole('combobox', { name: 'Role:' }));
    await user.click(screen.getByRole('option', { name: 'auditor' }));
    expect(screen.getByText(/unsaved local changes/i)).toBeInTheDocument();
    expect(onRoleChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onRoleChange).toHaveBeenCalledExactlyOnceWith('auditor');
  });
});
