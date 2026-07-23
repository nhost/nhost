import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { CreateNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/NativeQueryForms';
import { render, screen, TestUserEvent } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  router: {
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: 'default',
    },
    push: vi.fn(),
    events: { on: vi.fn(), off: vi.fn() },
  },
  mutateAsync: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    loading: false,
    project: {
      subdomain: 'local',
      region: 'local',
      config: { hasura: { adminSecret: 'secret' } },
    },
  }),
}));
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.mutateAsync,
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);

const server = setupServer(
  http.post(
    'https://local.hasura.local.nhost.run/v1/metadata',
    () =>
      HttpResponse.json({
        metadata: {
          version: 3,
          sources: [
            {
              name: 'default',
              kind: 'postgres',
              logical_models: [],
              native_queries: [],
              tables: [],
            },
          ],
        },
        resource_version: 1,
      }),
  ),
);

describe('NativeQueryForms', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  afterAll(() => server.close());

  it('guides users to create a logical model before a native query', async () => {
    const user = new TestUserEvent();
    const onCancel = vi.fn();
    render(<CreateNativeQueryForm onCancel={onCancel} />);

    expect(
      await screen.findByText('Create a logical model first'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Native queries need a logical model that describes their return fields.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to Logical Models' }));
    expect(onCancel).toHaveBeenCalled();
    expect(mocks.router.push).toHaveBeenCalledWith(
      '/orgs/test/projects/local/database/native-queries/default',
    );
  });
});
