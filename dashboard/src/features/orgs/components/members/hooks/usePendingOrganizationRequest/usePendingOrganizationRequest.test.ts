import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { CheckoutStatus } from '@/generated/graphql';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { Providers, renderHook, waitFor } from '@/tests/testUtils';
import usePendingOrganizationRequest from './usePendingOrganizationRequest';

const newRequestsHandler = (sessionID: string | null) =>
  nhostGraphQLLink.query('organizationNewRequests', () =>
    HttpResponse.json({
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
    }),
  );

const server = setupServer();

describe('usePendingOrganizationRequest', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
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
