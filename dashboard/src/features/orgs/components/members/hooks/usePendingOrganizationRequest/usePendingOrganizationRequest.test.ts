import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import usePendingOrganizationRequest from '@/features/orgs/components/members/hooks/usePendingOrganizationRequest/usePendingOrganizationRequest';
import { CheckoutStatus } from '@/generated/graphql';
import { mockRouter, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { act, Providers, renderHook, waitFor } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

// AuthProvider also gates session initialization on router readiness; keep the
// user authenticated so it cannot mask a missing readiness guard in this hook.
vi.mock('@/hooks/useUserData', () => ({
  useUserData: () => mockSession.user,
}));

const newRequestsHandler = (
  sessionID: string | null,
  onRequest?: VoidFunction,
) =>
  nhostGraphQLLink.query('organizationNewRequests', () => {
    onRequest?.();

    return HttpResponse.json({
      data: {
        organizationNewRequests: sessionID
          ? [
              {
                id: 'req-1',
                sessionID,
                __typename: 'organization_new_request',
              },
            ]
          : [],
      },
    });
  });

const server = setupServer();

describe('usePendingOrganizationRequest', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
    vi.mocked(useRouter).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    server.close();
  });

  it.each([
    { scenario: 'the router is not ready', isReady: false, query: {} },
    {
      scenario: 'the URL contains a checkout session',
      isReady: true,
      query: { session_id: 'SESSION_ID' },
    },
  ])('does not query or post when $scenario', async ({ isReady, query }) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.mocked(useRouter).mockReturnValue({ ...mockRouter, isReady, query });

    const queryCalled = vi.fn();
    const postCalled = vi.fn();
    server.use(
      newRequestsHandler('session-1', queryCalled),
      nhostGraphQLLink.mutation('postOrganizationRequest', () => {
        postCalled();
        return HttpResponse.json({
          data: { billingPostOrganizationRequest: null },
        });
      }),
    );

    const { result, rerender } = renderHook(
      () => usePendingOrganizationRequest(),
      { wrapper: Providers },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(queryCalled).not.toHaveBeenCalled();
    expect(postCalled).not.toHaveBeenCalled();
    expect(result.current).toBeNull();

    vi.mocked(useRouter).mockReturnValue(mockRouter);
    rerender();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(queryCalled).toHaveBeenCalledTimes(1);
    expect(postCalled).toHaveBeenCalledTimes(1);
  });

  it('returns the request when the checkout status is OPEN', async () => {
    server.use(
      newRequestsHandler('session-1'),
      nhostGraphQLLink.mutation('postOrganizationRequest', () =>
        HttpResponse.json({
          data: {
            billingPostOrganizationRequest: {
              Status: CheckoutStatus.Open,
              Slug: 'my-org',
              ClientSecret: 'secret-1',
              __typename: 'PostOrganizationRequestResponse',
            },
          },
        }),
      ),
    );

    const { result } = renderHook(() => usePendingOrganizationRequest(), {
      wrapper: Providers,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        Status: CheckoutStatus.Open,
        ClientSecret: 'secret-1',
      });
    });
  });

  it('returns null when the checkout status is not OPEN', async () => {
    let postCalled = false;
    server.use(
      newRequestsHandler('session-1'),
      nhostGraphQLLink.mutation('postOrganizationRequest', () => {
        postCalled = true;
        return HttpResponse.json({
          data: {
            billingPostOrganizationRequest: {
              Status: CheckoutStatus.Completed,
              Slug: 'my-org',
              ClientSecret: null,
              __typename: 'PostOrganizationRequestResponse',
            },
          },
        });
      }),
    );

    const { result } = renderHook(() => usePendingOrganizationRequest(), {
      wrapper: Providers,
    });

    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
    expect(result.current).toBeNull();
  });

  it('returns null and never posts when there is no pending request', async () => {
    let queryCalled = false;
    let postCalled = false;
    server.use(
      nhostGraphQLLink.query('organizationNewRequests', () => {
        queryCalled = true;
        return HttpResponse.json({
          data: { organizationNewRequests: [] },
        });
      }),
      nhostGraphQLLink.mutation('postOrganizationRequest', () => {
        postCalled = true;
        return HttpResponse.json({
          data: { billingPostOrganizationRequest: null },
        });
      }),
    );

    const { result } = renderHook(() => usePendingOrganizationRequest(), {
      wrapper: Providers,
    });

    await waitFor(() => {
      expect(queryCalled).toBe(true);
    });
    expect(postCalled).toBe(false);
    expect(result.current).toBeNull();
  });
});
