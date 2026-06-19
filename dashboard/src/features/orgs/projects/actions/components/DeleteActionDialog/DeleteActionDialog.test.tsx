import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  createExportActionsMetadataHandler,
  HASURA_API_URL,
  sampleMutationAction,
} from '@/tests/msw/mocks/rest/exportActionsMetadataQuery';
import {
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import DeleteActionDialog from './DeleteActionDialog';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  push: vi.fn(),
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

const server = setupServer(
  createExportActionsMetadataHandler(),
  http.post(`${HASURA_API_URL}/apis/migrate`, async ({ request }) => {
    migrationBody = (await request.json()) as typeof migrationBody;
    return HttpResponse.json({ message: 'success' });
  }),
);

function mockRouterQuery(query: Record<string, string>) {
  mocks.useRouter.mockReturnValue({
    basePath: '',
    pathname:
      '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions/[actionSlug]',
    route:
      '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions/[actionSlug]',
    asPath: '/orgs/xyz/projects/test-project/graphql/actions/login',
    isReady: true,
    query: { orgSlug: 'xyz', appSubdomain: 'test-project', ...query },
    push: mocks.push,
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isFallback: false,
  });
}

describe('DeleteActionDialog', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    mockPointerEvent();
    migrationBody = null;
    mocks.push.mockClear();
    queryClient.clear();
  });

  afterEach(() => {
    server.resetHandlers();
    toast.remove();
  });

  afterAll(() => server.close());

  it('drops the action and navigates to the list when the deleted action is the one being viewed', async () => {
    mockRouterQuery({ actionSlug: 'login' });
    const setOpen = vi.fn();
    const user = new TestUserEvent();

    render(
      <DeleteActionDialog
        open
        setOpen={setOpen}
        actionToDelete={sampleMutationAction}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(migrationBody).not.toBeNull());
    expect(migrationBody?.name).toBe('delete_action_login');
    expect(migrationBody?.up).toEqual([
      { type: 'drop_action', args: { name: 'login' } },
    ]);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        '/orgs/xyz/projects/test-project/graphql/actions',
      ),
    );
    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
  });

  it('does not navigate when deleting an action other than the one being viewed', async () => {
    mockRouterQuery({ actionSlug: 'getProfile' });
    const setOpen = vi.fn();
    const user = new TestUserEvent();

    render(
      <DeleteActionDialog
        open
        setOpen={setOpen}
        actionToDelete={sampleMutationAction}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(migrationBody).not.toBeNull());
    expect(migrationBody?.name).toBe('delete_action_login');
    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('surfaces an error and still closes the dialog when the request fails', async () => {
    server.use(
      http.post(`${HASURA_API_URL}/apis/migrate`, () =>
        HttpResponse.json({ error: 'delete failed on server' }, { status: 500 }),
      ),
    );
    mockRouterQuery({ actionSlug: 'login' });
    const setOpen = vi.fn();
    const user = new TestUserEvent();

    render(
      <DeleteActionDialog
        open
        setOpen={setOpen}
        actionToDelete={sampleMutationAction}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText('delete failed on server'),
    ).toBeInTheDocument();
    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
