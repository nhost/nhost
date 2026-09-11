import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { useDialog } from '@/components/common/DialogProvider';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { EditLogicalModelPermissionsForm } from '@/features/orgs/projects/database/native-queries/components/EditLogicalModelPermissionsForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  fireEvent,
  mockPointerEvent,
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

const jsonOnlyFilter = {
  _or: [
    { id: { _eq: 'X-Hasura-User-Id' } },
    { profile: { active: { _eq: true } } },
  ],
};
const model: LogicalModelItem = {
  name: 'author_result',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    { name: 'name', type: { scalar: 'text', nullable: true } },
  ],
  select_permissions: [
    {
      role: 'user',
      permission: { columns: ['id'], filter: jsonOnlyFilter },
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
        filter: jsonOnlyFilter,
        limit: 25,
        allow_aggregations: true,
        computed_fields: ['display_name'],
        query_root_fields: ['select'],
        subscription_root_fields: ['select'],
      },
    },
  ],
};
const arrayOnlyModel: LogicalModelItem = {
  name: 'array_result',
  fields: [
    {
      name: 'tags',
      type: {
        array: { scalar: 'text', nullable: true },
        nullable: false,
      },
    },
  ],
  select_permissions: [
    {
      role: 'user',
      permission: {
        columns: ['tags'],
        filter: { tags: { _eq: ['existing'] } },
      },
    },
    {
      role: 'viewer',
      permission: { columns: '*', filter: {} },
    },
  ],
};
const mixedModel: LogicalModelItem = {
  name: 'mixed_result',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    {
      name: 'tags',
      type: {
        array: { scalar: 'text', nullable: true },
        nullable: false,
      },
    },
  ],
};
let logicalModels: LogicalModelItem[] = [model];
let selectedSource = 'default';

let migrationBodies: MigrationRequest[] = [];
let unexpectedRequests: string[] = [];
let migrationStatus = 200;
let migrationFinished: Promise<void> | undefined;

const server = setupServer(
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

function DrawerHarness() {
  const { openDrawer } = useDialog();
  return (
    <button
      type="button"
      onClick={() =>
        openDrawer({
          title: 'Logical model permissions',
          component: (
            <EditLogicalModelPermissionsForm
              source="default"
              logicalModelName={model.name}
            />
          ),
        })
      }
    >
      Open permissions drawer
    </button>
  );
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
    selectedSource = 'default';
    mockPointerEvent();
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
      expect(body.datasource).toBe(selectedSource);
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

    expect(screen.getByText('admin select: full access')).toHaveClass(
      'sr-only',
    );
    expect(
      screen.queryByRole('button', { name: 'admin select: full access' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'viewer select: full access' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'user select: partial access' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'auditor select: partial access' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'editor select: no access' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('auditor')).toHaveLength(1);
    expect(screen.queryByText('admin', { selector: 'button' })).toBeNull();

    await user.click(
      screen.getByRole('button', { name: 'auditor select: partial access' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Selected role & action' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Role:')).toHaveTextContent('auditor');
    const actionSwitcher = screen.getByLabelText('Action:');
    expect(actionSwitcher).toBeDisabled();
    actionSwitcher.focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
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

    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await user.click(screen.getByLabelText('With custom check'));
    expect(save).toBeEnabled();

    await user.click(screen.getByLabelText('Without any checks'));
    expect(save).toBeDisabled();
  });

  it('isolates same-named model columns, check paths and permission writes by source', async () => {
    selectedSource = 'analytics';
    const user = new TestUserEvent();
    render(
      <EditLogicalModelPermissionsForm
        source="analytics"
        logicalModelName={model.name}
      />,
    );
    await user.click(
      await screen.findByRole('button', { name: /editor select: no access/i }),
    );
    expect(
      screen.queryByRole('checkbox', { name: 'id' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'name' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'analytics_id' }));
    await user.click(screen.getByLabelText('With custom check'));
    fireEvent.click(screen.getByRole('button', { name: 'Add check' }));
    const columnsGroup = (await screen.findByText('Columns')).closest(
      '[cmdk-group]',
    );
    expect(columnsGroup).not.toBeNull();
    expect(
      within(columnsGroup as HTMLElement).getByText('analytics_id'),
    ).toBeVisible();
    expect(within(columnsGroup as HTMLElement).queryByText('id')).toBeNull();
    await user.keyboard('{Escape}');
    await user.click(screen.getByLabelText('Without any checks'));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitForSavedPermission({
      source: 'analytics',
      name: model.name,
      role: 'editor',
      permission: { columns: ['analytics_id'], filter: {} },
    });
  });

  it('switches roles and renders existing column values', async () => {
    const user = new TestUserEvent();
    await renderForm();

    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );
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
    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );
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
    await user.click(
      screen.getByRole('button', { name: /editor select: no access/i }),
    );
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
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );

    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );

    await waitForSavedPermission({
      source: 'default',
      name: extendedPermissionModel.name,
      role: 'user',
      comment: 'Preserve this permission comment.',
      permission: {
        columns: ['id', 'name'],
        filter: jsonOnlyFilter,
        limit: 25,
        allow_aggregations: true,
        computed_fields: ['display_name'],
        query_root_fields: ['select'],
        subscription_root_fields: ['select'],
      },
    });
  });

  it('explains array-only row-check limitations without blocking field selection', async () => {
    const user = new TestUserEvent();
    await renderForm(arrayOnlyModel);
    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );

    const customCheck = screen.getByLabelText('With custom check');
    expect(customCheck).toBeDisabled();
    expect(customCheck).toHaveAccessibleDescription(
      /no fields supported in row checks.*without any checks.*array fields cannot be used/i,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This logical model has no fields supported in row checks.',
    );
    expect(screen.queryByRole('button', { name: 'Add check' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Visual' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'JSON' })).toBeNull();

    const tags = screen.getByRole('checkbox', { name: 'tags' });
    expect(tags).toBeChecked();
    await user.click(tags);
    expect(tags).not.toBeChecked();
    expect(customCheck).toBeDisabled();
  });

  it('preserves an unsupported filter until it is explicitly cleared', async () => {
    const user = new TestUserEvent();
    await renderForm(arrayOnlyModel);
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );

    expect(screen.getByLabelText('With custom check')).toBeChecked();
    expect(screen.getByLabelText('With custom check')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete Permissions' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Filter JSON')).toBeNull();

    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    expect(migrationBodies).toEqual([]);

    await user.click(screen.getByLabelText('Without any checks'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(/unsaved local changes/i)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Unsaved changes' }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitForSavedPermission({
      source: 'default',
      name: arrayOnlyModel.name,
      role: 'user',
      permission: { columns: ['tags'], filter: {} },
    });
  });

  it('authors supported scalar checks while omitting mixed-model arrays', async () => {
    const user = new TestUserEvent();
    await renderForm(mixedModel);
    await user.click(
      screen.getByRole('button', { name: /editor select: no access/i }),
    );
    await user.click(screen.getByLabelText('With custom check'));
    const addCheck = screen.getByRole('button', { name: 'Add check' });
    expect(addCheck).toBeEnabled();
    fireEvent.click(addCheck);
    expect(addCheck).toHaveAttribute('aria-expanded', 'true');

    const columnsGroup = (await screen.findByText('Columns')).closest(
      '[cmdk-group]',
    ) as HTMLElement | null;
    expect(columnsGroup).not.toBeNull();
    const idOption = within(columnsGroup!).getByText('id');
    expect(idOption).toBeVisible();
    expect(within(columnsGroup!).queryByText('tags')).toBeNull();
    await TestUserEvent.fireClickEvent(idOption);
    await user.click(
      screen.getByRole('combobox', { name: 'Logical model value' }),
    );
    await user.type(
      screen.getByPlaceholderText('Choose variable...'),
      'allowed',
    );
    await user.click(await screen.findByText('allowed'));
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );

    await waitForSavedPermission({
      source: 'default',
      name: mixedModel.name,
      role: 'editor',
      permission: {
        columns: '*',
        filter: { id: { _eq: 'allowed' } },
      },
    });
  });

  it('locks a JSON-only filter out of Visual mode and preserves it exactly', async () => {
    const user = new TestUserEvent();
    await renderForm();
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );

    const visual = screen.getByRole('button', { name: 'Visual' });
    expect(visual).toBeDisabled();
    expect(visual).toHaveAccessibleDescription(/only be edited in JSON mode/i);
    expect(screen.getByLabelText('Filter JSON')).toHaveValue(
      JSON.stringify(jsonOnlyFilter, null, 2),
    );
    await user.click(visual);
    expect(screen.getByLabelText('Filter JSON')).toHaveValue(
      JSON.stringify(jsonOnlyFilter, null, 2),
    );
  });

  it('uses supported JSON edits as the baseline for later visual edits', async () => {
    const user = new TestUserEvent();
    await renderForm();
    await user.click(
      screen.getByRole('button', { name: /editor select: no access/i }),
    );
    await user.click(screen.getByLabelText('With custom check'));
    await TestUserEvent.fireClickEvent(screen.getByText('Add check'));
    const columnsGroup = (await screen.findByText('Columns')).closest(
      '[cmdk-group]',
    ) as HTMLElement | null;
    expect(columnsGroup).not.toBeNull();
    await TestUserEvent.fireClickEvent(within(columnsGroup!).getByText('id'));
    await user.click(screen.getByRole('button', { name: 'JSON' }));

    fireEvent.change(screen.getByLabelText('Filter JSON'), {
      target: { value: JSON.stringify({ name: { _eq: 'from JSON' } }) },
    });
    await user.click(screen.getByRole('button', { name: 'Visual' }));

    expect(screen.getByLabelText('Logical model field')).toHaveTextContent(
      'name',
    );
    await user.click(
      screen.getByRole('combobox', { name: 'Logical model value' }),
    );
    await user.type(
      screen.getByPlaceholderText('Choose variable...'),
      'edited visually',
    );
    await user.click(await screen.findByText('edited visually'));
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );

    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'editor',
      permission: {
        columns: '*',
        filter: { name: { _eq: 'edited visually' } },
      },
    });
  });

  it('validates JSON and saves the complete edited permission', async () => {
    const user = new TestUserEvent();
    await renderForm();
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );
    await user.click(screen.getByRole('button', { name: 'JSON' }));

    fireEvent.change(screen.getByLabelText('Filter JSON'), {
      target: { value: '{' },
    });
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    for (const emptyGroupFilter of ['{"_and":[]}', '{"_or":[]}', '{"_not":{}}']) {
      fireEvent.change(screen.getByLabelText('Filter JSON'), {
        target: { value: emptyGroupFilter },
      });
      expect(
        screen.getByText(/empty _and, _or, and _not groups match every row/i),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    }
    expect(migrationBodies).toEqual([]);

    const nextFilter = { id: { _eq: 'X-Hasura-User-Id' } };
    fireEvent.change(screen.getByLabelText('Filter JSON'), {
      target: { value: JSON.stringify(nextFilter) },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'user',
      permission: { columns: ['id'], filter: nextFilter },
    });
  });

  it.each([
    'add',
    'edit',
    'delete',
  ] as const)('waits for the local %s migration before showing success and leaving the editor', async (type) => {
    const user = new TestUserEvent();
    const completion = Promise.withResolvers<void>();
    migrationFinished = completion.promise;
    await renderForm();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const role = type === 'add' ? 'public' : 'viewer';
    await user.click(
      screen.getByRole('button', {
        name:
          type === 'add'
            ? 'public select: no access'
            : 'viewer select: full access',
      }),
    );

    const save = screen.getByRole('button', { name: 'Save' });
    const deletePermissions = screen.queryByRole('button', {
      name: 'Delete Permissions',
    });
    try {
      if (type === 'delete') {
        await user.click(deletePermissions!);
        await user.click(screen.getByRole('button', { name: 'Delete' }));
      } else {
        await user.click(screen.getByRole('checkbox', { name: 'id' }));
        expect(save).toBeEnabled();
        fireEvent.submit(save.closest('form')!);
      }
      await waitFor(() => expect(migrationBodies).toHaveLength(1));
      expect(invalidate).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Role:')).toHaveTextContent(role);
      expect(save).toBeDisabled();
      if (deletePermissions) {
        expect(deletePermissions).toBeDisabled();
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
    expect(
      screen.getByText(
        `Select permission ${type === 'add' ? 'created' : type === 'edit' ? 'updated' : 'deleted'}.`,
      ),
    ).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({
      queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
    });
  });

  it('keeps a failed creation dirty and retries the preserved draft without early invalidation', async () => {
    const user = new TestUserEvent();
    migrationStatus = 500;
    await renderForm();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await user.click(
      screen.getByRole('button', { name: /public select: no access/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    fireEvent.submit(save.closest('form')!);

    await screen.findByText('migration failed');
    expect(migrationBodies).toHaveLength(1);
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.queryByText('Select permission created.')).toBeNull();
    expect(screen.getByLabelText('Role:')).toHaveTextContent('public');
    expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'name' })).toBeChecked();
    expect(save).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const confirmation = await screen.findByRole('dialog', {
      name: 'Unsaved changes',
    });
    await user.click(
      within(confirmation).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());

    migrationStatus = 200;
    expect(save).toBeEnabled();
    fireEvent.submit(save.closest('form')!);
    await screen.findByRole('heading', { name: 'Roles & Actions overview' });
    expect(migrationBodies).toHaveLength(2);
    expect(migrationBodies[1]).toEqual(migrationBodies[0]);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({
      queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
    });
    expect(screen.getByText('Select permission created.')).toBeInTheDocument();
  });

  it('creates and deletes permissions and resets to the roles view on reopen', async () => {
    const user = new TestUserEvent();
    const view = await renderForm();
    await user.click(
      screen.getByRole('button', { name: /public select: no access/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'public',
      permission: { columns: '*', filter: {} },
    });

    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );
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

  it('preserves untouched wildcard and explicit-all representations', async () => {
    const user = new TestUserEvent();
    await renderForm();

    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitForSavedPermission(
      expect.objectContaining({
        permission: { columns: '*', filter: {} },
      }),
    );

    await user.click(
      screen.getByRole('button', { name: /auditor select: partial access/i }),
    );
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitForSavedPermission(
      expect.objectContaining({
        permission: { columns: ['id', 'name'], filter: {} },
      }),
    );
  });

  it('keeps individual all-selection explicit and converts explicit-all through the bulk toggle', async () => {
    const user = new TestUserEvent();
    await renderForm();
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );

    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitForSavedPermission(
      expect.objectContaining({
        permission: expect.objectContaining({ columns: ['id', 'name'] }),
      }),
    );

    await user.click(
      screen.getByRole('button', { name: /auditor select: partial access/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(screen.getByRole('checkbox', { name: 'id' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'name' })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitForSavedPermission(
      expect.objectContaining({
        permission: expect.objectContaining({ columns: '*' }),
      }),
    );
  });

  it('saves an empty field selection after bulk deselection', async () => {
    const user = new TestUserEvent();
    await renderForm();
    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );

    await user.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(screen.getByRole('checkbox', { name: 'id' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'name' })).not.toBeChecked();
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitForSavedPermission(
      expect.objectContaining({
        permission: { columns: [], filter: {} },
      }),
    );
  });

  it('saves a new permission without selected fields', async () => {
    const user = new TestUserEvent();
    await renderForm();
    await user.click(
      screen.getByRole('button', { name: /public select: no access/i }),
    );

    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitForSavedPermission({
      source: 'default',
      name: model.name,
      role: 'public',
      permission: { columns: [], filter: {} },
    });
  });

  it('guards dirty Cancel and confirmed role switching', async () => {
    const user = new TestUserEvent();
    await renderForm();
    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );
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

  it('keeps the drawer open after a rejected close and closes after confirmation', async () => {
    const user = new TestUserEvent();
    render(<DrawerHarness />);
    await user.click(
      screen.getByRole('button', { name: 'Open permissions drawer' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: /viewer select: full access/i,
      }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'name' }));

    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.getByText(/unsaved local changes/i)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Unsaved changes' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Role:')).toHaveTextContent('viewer');

    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() =>
      expect(screen.queryByLabelText('Role:')).not.toBeInTheDocument(),
    );
  });

  it('does not delete when confirmation is rejected', async () => {
    const user = new TestUserEvent();
    await renderForm();
    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Delete Permissions' }),
    );
    await user.keyboard('{Escape}');

    expect(migrationBodies).toEqual([]);
    expect(screen.getByLabelText('Role:')).toHaveTextContent('viewer');
  });

  it('keeps dirty close protection after a failed edit and retries the same permission', async () => {
    const user = new TestUserEvent();
    migrationStatus = 500;
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(<DrawerHarness />);
    await user.click(
      screen.getByRole('button', { name: 'Open permissions drawer' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: /viewer select: full access/i,
      }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await screen.findByText('migration failed');
    expect(migrationBodies).toHaveLength(1);
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.queryByText('Select permission updated.')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'name' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();

    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    const confirmation = await screen.findByRole('dialog', {
      name: 'Unsaved changes',
    });
    await user.click(
      within(confirmation).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());

    migrationStatus = 200;
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    fireEvent.submit(save.closest('form')!);
    await screen.findByRole('heading', { name: 'Roles & Actions overview' });
    expect(migrationBodies).toHaveLength(2);
    expect(migrationBodies[1]).toEqual(migrationBodies[0]);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({
      queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
    });
    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(
      screen.queryByRole('dialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
  });

  it('keeps dirty close protection after a failed delete and permits retry', async () => {
    const user = new TestUserEvent();
    migrationStatus = 500;
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(<DrawerHarness />);
    await user.click(
      screen.getByRole('button', { name: 'Open permissions drawer' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: /viewer select: full access/i,
      }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    await user.click(
      screen.getByRole('button', { name: 'Delete Permissions' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText('migration failed');
    expect(migrationBodies).toHaveLength(1);
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.queryByText('Select permission deleted.')).toBeNull();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Delete permissions' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('checkbox', { name: 'name' })).not.toBeChecked();

    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    const confirmation = await screen.findByRole('dialog', {
      name: 'Unsaved changes',
    });
    await user.click(
      within(confirmation).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());

    migrationStatus = 200;
    await user.click(
      screen.getByRole('button', { name: 'Delete Permissions' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('heading', { name: 'Roles & Actions overview' });
    expect(migrationBodies).toHaveLength(2);
    expect(migrationBodies[1]).toEqual(migrationBodies[0]);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({
      queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
    });
    expect(screen.getByText('Select permission deleted.')).toBeInTheDocument();
  });
});
