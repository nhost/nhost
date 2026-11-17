import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { EditLogicalModelPermissionsForm } from '@/features/orgs/projects/database/native-queries/components/EditLogicalModelPermissionsForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

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
let logicalModels: LogicalModelItem[] = [model];

let unexpectedRequests: string[] = [];

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
  http.post(`${API}/apis/migrate`, () =>
    HttpResponse.json({ name: '0_update_native_query_metadata' }),
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
    <EditLogicalModelPermissionsForm logicalModelName={logicalModel.name} />,
  );
  await screen.findByRole('heading', { name: 'Roles & Actions overview' });
  return view;
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
    mockScrollIntoViewAndPointerCapture();
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    logicalModels = [model];
    queryClient.clear();
    unexpectedRequests = [];
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    vi.restoreAllMocks();
    act(() => toast.remove());
    expect(unexpectedRequests).toEqual([]);
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
      '/orgs/test-org/projects/test-project/auth/settings?tab=roles-and-permissions',
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
  });

  it('opens the selected role, switches roles from the editor and returns to the overview on Cancel', async () => {
    const user = new TestUserEvent();
    await renderForm();

    await user.click(getPermissionButton('user'));
    expect(screen.getByLabelText('Role:')).toHaveTextContent('user');
    expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();

    screen.getByLabelText('Role:').focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(screen.getByLabelText('Role:')).toHaveTextContent('editor'),
    );
    expect(screen.getByRole('checkbox', { name: 'id' })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.getByRole('heading', { name: 'Roles & Actions overview' }),
    ).toBeInTheDocument();
  });

  it('returns to the overview after saving or deleting and starts there on reopen', async () => {
    const user = new TestUserEvent();
    const view = await renderForm();
    await user.click(getPermissionButton('public'));
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Roles & Actions overview' });

    await user.click(getPermissionButton('user'));
    await user.click(
      screen.getByRole('button', { name: 'Delete Permissions' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('heading', { name: 'Roles & Actions overview' });

    view.unmount();
    await renderForm();
    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.queryByLabelText('Role:')).not.toBeInTheDocument();
  });
});
