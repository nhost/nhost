import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { Providers, renderHook, waitFor } from '@/tests/testUtils';
import useAllRunServices from './useAllRunServices';

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => true,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({ project: { id: 'app-id' } }),
}));

const SERVICE_COUNT = 30;

const runServices = Array.from({ length: SERVICE_COUNT }, (_, index) => ({
  __typename: 'run_service',
  id: `service-${index}-id`,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  subdomain: `service-${index}`,
  config: null,
}));

const server = setupServer();

describe('useAllRunServices', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('returns every Run service without paginating the request', async () => {
    const requestVariables = vi.fn();
    server.use(
      nhostGraphQLLink.query('getAllRunServices', ({ variables }) => {
        requestVariables(variables);

        return HttpResponse.json({
          data: { app: { __typename: 'apps', runServices } },
        });
      }),
    );

    const { result } = renderHook(() => useAllRunServices(), {
      wrapper: Providers,
    });

    await waitFor(() => {
      expect(result.current.services).toHaveLength(SERVICE_COUNT);
    });
    expect(requestVariables).toHaveBeenCalledWith({
      appID: 'app-id',
      resolve: false,
    });
  });
});
