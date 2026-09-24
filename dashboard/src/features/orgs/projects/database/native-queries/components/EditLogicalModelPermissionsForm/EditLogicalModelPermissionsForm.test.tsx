import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { EditLogicalModelPermissionsForm } from '@/features/orgs/projects/database/native-queries/components/EditLogicalModelPermissionsForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import type {
  CreateLogicalModelSelectPermissionArgs,
  LogicalModelItem,
  MigrationRequest,
} from '@/utils/hasura-api/generated/schemas';

const API = 'https://local.hasura.local.nhost.run';
const project = {
  subdomain: 'test-project',
  region: 'local',
  config: { hasura: { adminSecret: 'secret' } },
};

const columnComparisonFilter = { id: { _ceq: ['id'] } };
const model: LogicalModelItem = {
  name: 'author_result',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    { name: 'name', type: { scalar: 'text', nullable: true } },
  ],
  select_permissions: [
    {
      role: 'user',
      permission: { columns: ['id'], filter: columnComparisonFilter },
    },
    {
      role: 'viewer',
      permission: { columns: '*', filter: {} },
    },
    {
      role: 'auditor',
      permission: { columns: ['id', 'name'], filter: {} },
    },
  ],
};
const extendedPermissionModel: LogicalModelItem = {
  ...model,
  select_permissions: [
    {
      role: 'user',
      comment: 'Preserve this permission comment.',
      permission: {
        columns: ['id'],
        filter: columnComparisonFilter,
        limit: 25,
        allow_aggregations: true,
        computed_fields: ['display_name'],
        query_root_fields: ['select'],
        subscription_root_fields: ['select'],
      },
    },
  ],
};
let logicalModels: LogicalModelItem[] = [model];

let migrationBodies: MigrationRequest[] = [];
let unexpectedRequests: string[] = [];
let migrationStatus = 200;
let migrationFinished: Promise<void> | undefined;

const server = setupServer(
  permissionVariablesQuery,
  http.post(`${API}/v1/metadata`, async ({ request }) => {
    const body = (await request.json()) as { type?: string };
    if (body.type !== 'export_metadata') {
      unexpectedRequests.push(`Local metadata write: ${JSON.stringify(body)}`);
      return HttpResponse.json(
        { error: 'Unexpected local metadata write' },
        { status: 500 },
      );
    }
    expect(body).toEqual({ type: 'export_metadata', version: 2, args: {} });
    return HttpResponse.json({
      resource_version: 244,
      metadata: {
        version: 3,
        sources: [
          {
            name: 'analytics',
            kind: 'postgres',
            tables: [],
            logical_models: [
              {
                name: model.name,
                fields: [
                  {
                    name: 'analytics_id',
                    type: { scalar: 'uuid', nullable: false },
                  },
                  {
                    name: 'analytics_name',
                    type: { scalar: 'text', nullable: false },
                  },
                ],
              },
            ],
          },
          {
            name: 'default',
            kind: 'postgres',
            logical_models: logicalModels,
            tables: [],
          },
        ],
      },
    });
  }),
  http.post(`${API}/apis/migrate`, async ({ request }) => {
    migrationBodies.push((await request.json()) as MigrationRequest);
    await migrationFinished;
    return migrationStatus === 200
      ? HttpResponse.json({ name: '0_update_native_query_metadata' })
      : HttpResponse.json({ error: 'migration failed' }, { status: 500 });
  }),
);

vi.mock('@/features/orgs/hooks/useRemoteApplicationGQLClient', () => ({
  useRemoteApplicationGQLClient: () => ({}),
}));
vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: () => ({ org: { slug: 'test-org' } }),
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({ project, loading: false }),
}));
vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();
  return {
    ...actual,
    useGetRemoteAppRolesQuery: () => ({
      data: {
        authRoles: [
          { role: 'user' },
          { role: 'editor' },
          { role: 'viewer' },
          { role: 'auditor' },
          { role: 'auditor' },
          { role: 'admin' },
        ],
      },
      loading: false,
      error: undefined,
    }),
  };
});
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => false,
}));

async function renderForm(logicalModel: LogicalModelItem = model) {
  logicalModels = [logicalModel];
  const view = render(
    <EditLogicalModelPermissionsForm
      source="default"
      logicalModelName={logicalModel.name}
    />,
  );
  await screen.findByRole('heading', { name: 'Roles & Actions overview' });
  return view;
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
  await screen.findByRole('heading', { name: 'Roles & Actions overview' });
}

function getPermissionButton(role: string) {
  const row = screen.getByRole('row', { name: new RegExp(`^${role} `, 'i') });
  return within(row).getByRole('button');
}

describe('EditLogicalModelPermissionsForm', () => {
  beforeAll(() => {
    server.listen({
      onUnhandledRequest(request, print) {
        unexpectedRequests.push(`${request.method} ${request.url}`);
        print.error();
      },
    });
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.setPointerCapture = vi.fn();
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    logicalModels = [model];
    queryClient.clear();
    migrationBodies = [];
    unexpectedRequests = [];
    migrationStatus = 200;
    migrationFinished = undefined;
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    vi.restoreAllMocks();
    act(() => toast.remove());
    expect(unexpectedRequests).toEqual([]);
    for (const body of migrationBodies) {
      expect(body.name).toMatch(
        /^(create|update|drop)_logical_model_select_permission_/,
      );
      expect(body.datasource).toBe('default');
      expect(body.down ?? []).not.toHaveLength(0);
    }
  });

  afterAll(() => server.close());

  it('renders the shared overview with contextual access states', async () => {
    const user = new TestUserEvent();
    await renderForm();

    expect(
      screen.getByRole('heading', { name: 'Roles & Actions overview' }),
    ).toBeInTheDocument();
    expect(screen.getByText('full access')).toBeInTheDocument();
    expect(screen.getByText('partial access')).toBeInTheDocument();
    expect(screen.getByText('no access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings page' })).toHaveAttribute(
      'href',
      '/orgs/test-org/projects/test-project/settings/roles-and-permissions',
    );

    expect(
      within(screen.getByRole('row', { name: /^admin /i })).queryByRole(
        'button',
      ),
    ).not.toBeInTheDocument();
    expect(getPermissionButton('viewer')).toBeInTheDocument();
    expect(getPermissionButton('user')).toBeInTheDocument();
    expect(getPermissionButton('auditor')).toBeInTheDocument();
    expect(getPermissionButton('editor')).toBeInTheDocument();
    expect(screen.getAllByText('auditor')).toHaveLength(1);
    expect(screen.queryByText('admin', { selector: 'button' })).toBeNull();

    await user.click(getPermissionButton('auditor'));
    expect(
      screen.getByRole('heading', { name: 'Selected role & action' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Role:')).toHaveTextContent('auditor');
    const actionSwitcher = screen.getByLabelText('Action:');
    expect(actionSwitcher).toBeDisabled();
    expect(actionSwitcher).toHaveTextContent('Select');
    expect(
      screen.getAllByRole('button', { name: 'Deselect All' }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Select All' }),
    ).not.toBeInTheDocument();
  });

  it('disables pristine permission saves and disables again after reverting', async () => {
    const user = new TestUserEvent();
    await renderForm();

    await user.click(getPermissionButton('viewer'));
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await user.click(screen.getByLabelText('With custom check'));
    expect(save).toBeEnabled();

    await user.click(screen.getByLabelText('Without any checks'));
    expect(save).toBeDisabled();
  });

  it('switches roles and renders existing column values', async () => {
    const user = new TestUserEvent();
    await renderForm();

    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
    await user.click(getPermissionButton('user'));
    expect(screen.getByLabelText('Role:')).toHaveTextContent('user');
    expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'name' })).not.toBeChecked();
    expect(screen.getByLabelText('With custom check')).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Select All' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Deselect All' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(getPermissionButton('viewer'));
    expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'name' })).toBeChecked();
    expect(screen.getByLabelText('Without any checks')).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Deselect All' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Select All' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(getPermissionButton('editor'));
    expect(screen.getByLabelText('Role:')).toHaveTextContent('editor');
    expect(
      screen.getByRole('button', { name: 'Select All' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Deselect All' }),
    ).not.toBeInTheDocument();
  });

  it('preserves unedited permission settings and comment when editing', async () => {
    const user = new TestUserEvent();
    await renderForm(extendedPermissionModel);
    await user.click(getPermissionButton('user'));

    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitForSavedPermission({
      source: 'default',
      name: extendedPermissionModel.name,
      role: 'user',
      comment: 'Preserve this permission comment.',
      permission: {
        columns: ['id', 'name'],
        filter: columnComparisonFilter,
        limit: 25,
        allow_aggregations: true,
        computed_fields: ['display_name'],
        query_root_fields: ['select'],
        subscription_root_fields: ['select'],
      },
    });
  });

  it('opens a column comparison in Visual mode and preserves it exactly', async () => {
    const user = new TestUserEvent();
    await renderForm();
    await user.click(getPermissionButton('user'));

    const visual = screen.getByRole('button', { name: 'Visual' });
    expect(visual).toBeEnabled();
    expect(visual).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('combobox', {
        name: 'Logical model comparison field',
      }),
    ).toHaveTextContent('id');

    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'user',
      permission: {
        columns: ['id', 'name'],
        filter: columnComparisonFilter,
      },
    });
  });

  it('validates JSON and saves the complete edited permission', async () => {
    const user = new TestUserEvent();
    await renderForm();
    await user.click(getPermissionButton('user'));
    await user.click(screen.getByRole('button', { name: 'JSON' }));

    const jsonEditor = screen.getByRole('textbox');
    await user.clear(jsonEditor);
    await user.paste('{');
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();

    await user.clear(jsonEditor);
    await user.paste('{"_and":[]}');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    await user.click(save);
    expect(
      await screen.findByText(/please add at least one rule/i),
    ).toBeInTheDocument();
    expect(migrationBodies).toEqual([]);

    const nextFilter = { id: { _eq: 'X-Hasura-User-Id' } };
    await user.clear(jsonEditor);
    await user.paste(JSON.stringify(nextFilter));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'user',
      permission: { columns: ['id'], filter: nextFilter },
    });
  });

  it.each([
    {
      type: 'add',
      role: 'public',
      message: 'Select permission created.',
      disabledWhilePending: ['Save'],
    },
    {
      type: 'edit',
      role: 'viewer',
      message: 'Select permission updated.',
      disabledWhilePending: ['Save', 'Delete Permissions'],
    },
  ])(
    'waits for the local $type migration before showing success and leaving the editor',
    async ({ role, message, disabledWhilePending }) => {
      const user = new TestUserEvent();
      const completion = Promise.withResolvers<void>();
      migrationFinished = completion.promise;
      await renderForm();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      await user.click(getPermissionButton(role));

      const save = screen.getByRole('button', { name: 'Save' });
      const pendingButtons = disabledWhilePending.map((name) =>
        screen.getByRole('button', { name }),
      );
      try {
        await user.click(screen.getByRole('checkbox', { name: 'id' }));
        expect(save).toBeEnabled();
        await user.click(save);
        await waitFor(() => expect(migrationBodies).toHaveLength(1));
        expect(invalidate).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Role:')).toHaveTextContent(role);
        for (const button of pendingButtons) {
          expect(button).toBeDisabled();
        }
        expect(
          screen.queryByText(/Select permission (created|updated|deleted)\./),
        ).toBeNull();
        expect(
          screen.queryByRole('heading', { name: 'Roles & Actions overview' }),
        ).toBeNull();
      } finally {
        completion.resolve();
      }

      await screen.findByRole('heading', { name: 'Roles & Actions overview' });
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(invalidate).toHaveBeenCalledExactlyOnceWith({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
      });
    },
  );

  it('waits for the local delete migration before showing success and leaving the editor', async () => {
    const user = new TestUserEvent();
    const completion = Promise.withResolvers<void>();
    migrationFinished = completion.promise;
    await renderForm();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await user.click(getPermissionButton('viewer'));

    const save = screen.getByRole('button', { name: 'Save' });
    const deletePermissions = screen.getByRole('button', {
      name: 'Delete Permissions',
    });
    try {
      await user.click(deletePermissions);
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(migrationBodies).toHaveLength(1));
      expect(invalidate).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Role:')).toHaveTextContent('viewer');
      expect(save).toBeDisabled();
      expect(deletePermissions).toBeDisabled();
      expect(
        screen.queryByText(/Select permission (created|updated|deleted)\./),
      ).toBeNull();
      expect(
        screen.queryByRole('heading', { name: 'Roles & Actions overview' }),
      ).toBeNull();
    } finally {
      completion.resolve();
    }

    await screen.findByRole('heading', { name: 'Roles & Actions overview' });
    expect(screen.getByText('Select permission deleted.')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({
      queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
    });
  });

  it('creates and deletes permissions and resets to the roles view on reopen', async () => {
    const user = new TestUserEvent();
    const view = await renderForm();
    await user.click(getPermissionButton('public'));
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'public',
      permission: { columns: ['id', 'name'], filter: {} },
    });

    await user.click(getPermissionButton('user'));
    await user.click(
      screen.getByRole('button', { name: 'Delete Permissions' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('heading', { name: 'Roles & Actions overview' });
    expect(migrationBodies).toHaveLength(2);
    expect(migrationBodies[1].up).toEqual([
      {
        type: 'pg_drop_logical_model_select_permission',
        args: { source: 'default', name: model.name, role: 'user' },
      },
    ]);

    view.unmount();
    await renderForm();
    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.queryByLabelText('Role:')).not.toBeInTheDocument();
  });

  it('guards dirty Cancel and confirmed role switching', async () => {
    const user = new TestUserEvent();
    await renderForm();
    await user.click(getPermissionButton('viewer'));
    await user.click(screen.getByRole('button', { name: 'Deselect All' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(/unsaved local changes/i)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Unsaved changes' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Role:')).toHaveTextContent('viewer');

    screen.getByLabelText('Role:').focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(
      await screen.findByText(/unsaved local changes/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Role:')).toHaveTextContent('auditor'),
    );
  });
});
