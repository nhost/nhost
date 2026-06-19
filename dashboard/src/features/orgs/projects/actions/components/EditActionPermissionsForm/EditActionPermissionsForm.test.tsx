import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  createExportActionsMetadataHandler,
  HASURA_API_URL,
} from '@/tests/msw/mocks/rest/exportActionsMetadataQuery';
import {
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import EditActionPermissionsForm from './EditActionPermissionsForm';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

let migrationBody: {
  name: string;
  up: Array<{ type: string; args: unknown }>;
} | null = null;

// The `login` fixture action already grants the `user` role.
const rolesHandler = nhostGraphQLLink.query('getRemoteAppRoles', () =>
  HttpResponse.json({
    data: { authRoles: [{ role: 'user' }, { role: 'editor' }] },
  }),
);

const server = setupServer(
  createExportActionsMetadataHandler(),
  rolesHandler,
  http.post(`${HASURA_API_URL}/apis/migrate`, async ({ request }) => {
    migrationBody = (await request.json()) as typeof migrationBody;
    return HttpResponse.json({ message: 'success' });
  }),
);

async function expandRole(user: TestUserEvent, role: string) {
  const row = (await screen.findByText(role)).closest('div');
  const trigger = row?.querySelector('button');
  if (!trigger) {
    throw new Error(`no expand trigger found for role "${role}"`);
  }
  await user.click(trigger);
}

describe('EditActionPermissionsForm', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    mockPointerEvent();
    migrationBody = null;
    queryClient.clear();
    mocks.useRouter.mockReturnValue({
      basePath: '',
      pathname: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
      asPath: '/orgs/xyz/projects/test-project/graphql/actions/login',
      isReady: true,
      query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
      push: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
      beforePopState: vi.fn(),
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      isFallback: false,
    });
  });

  afterEach(() => {
    server.resetHandlers();
    toast.remove();
  });

  afterAll(() => server.close());

  it('grants permission (create_action_permission) for a role that is not yet allowed', async () => {
    const user = new TestUserEvent();
    render(<EditActionPermissionsForm actionName="login" />);

    await expandRole(user, 'public');
    await user.click(screen.getByRole('button', { name: 'Allow' }));

    await waitFor(() => expect(migrationBody).not.toBeNull());
    expect(migrationBody?.name).toBe('save_action_permission_login_public');
    expect(migrationBody?.up).toEqual([
      {
        type: 'create_action_permission',
        args: {
          action: 'login',
          role: 'public',
          definition: { select: { filter: {} } },
        },
      },
    ]);
  });

  it('revokes permission (drop_action_permission) for a role that is already allowed', async () => {
    const user = new TestUserEvent();
    render(<EditActionPermissionsForm actionName="login" />);

    await expandRole(user, 'user');
    await user.click(screen.getByRole('button', { name: 'Delete Permissions' }));

    await waitFor(() => expect(migrationBody).not.toBeNull());
    expect(migrationBody?.name).toBe('delete_action_permission_login_user');
    expect(migrationBody?.up).toEqual([
      {
        type: 'drop_action_permission',
        args: { action: 'login', role: 'user' },
      },
    ]);
  });

  it('surfaces an error when the permission change fails', async () => {
    server.use(
      http.post(`${HASURA_API_URL}/apis/migrate`, () =>
        HttpResponse.json({ error: 'permission update failed' }, { status: 500 }),
      ),
    );
    const user = new TestUserEvent();
    render(<EditActionPermissionsForm actionName="login" />);

    await expandRole(user, 'public');
    await user.click(screen.getByRole('button', { name: 'Allow' }));

    expect(
      await screen.findByText('permission update failed'),
    ).toBeInTheDocument();
  });
});
