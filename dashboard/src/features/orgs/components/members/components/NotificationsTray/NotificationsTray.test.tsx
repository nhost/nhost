import { mockMatchMediaValue, mockSession } from '@/tests/mocks';
import { getOrganizations } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, waitFor } from '@/tests/testUtils';
import { CheckoutStatus } from '@/utils/__generated__/graphql';

import { setupServer } from 'msw/node';
import { afterAll, beforeAll, vi } from 'vitest';
import NotificationsTray from './NotificationsTray';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const getUseRouterObject = (session_id?: string, isReady = true) => ({
  basePath: '',
  pathname: '/orgs/xyz/projects/test-project',
  route: '/orgs/[orgSlug]/projects/[appSubdomain]',
  asPath: '/orgs/xyz/projects/test-project',
  isLocaleDomain: false,
  isReady,
  isPreview: false,
  query: {
    orgSlug: 'xyz',
    appSubdomain: 'test-project',
    session_id,
  },
  push: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  beforePopState: vi.fn(),
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  isFallback: false,
});

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useOrganizationNewRequestsLazyQuery: vi.fn(),
  usePostOrganizationRequestMutation: vi.fn(),
  useOrganizationMemberInvitesLazyQuery: vi.fn(),
  fetchPostOrganizationResponseMock: vi.fn(),
  userData: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@nhost/nextjs', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actualNhostNextjs = await vi.importActual<any>('@nhost/nextjs');
  return {
    ...actualNhostNextjs,
    userData: mocks.userData,
  };
});

vi.mock('@/utils/__generated__/graphql', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useOrganizationNewRequestsLazyQuery:
      mocks.useOrganizationNewRequestsLazyQuery,
    usePostOrganizationRequestMutation:
      mocks.usePostOrganizationRequestMutation,
    useOrganizationMemberInvitesLazyQuery:
      mocks.useOrganizationMemberInvitesLazyQuery,
  };
});

const server = setupServer(tokenQuery);

beforeAll(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';
});

afterEach(() => {
  queryClient.clear();
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
});

const fetchOrganizationMemberInvitesMock = () => [
  async () => ({ data: { organizationMemberInvites: [] } }),
  {
    loading: true,
    refetch: vi.fn(),
    data: { organizationMemberInvites: [] },
  },
];

const fetchOrganizationNewRequestsResponseMock = async () => ({
  data: {
    organizationNewRequests: [
      {
        id: 'org-request-id-1',
        sessionID: 'session-id-1',
        __typename: 'organization_new_request',
      },
    ],
  },
});

const fetchPostOrganizationResponseMock = vi.fn();

test('if there is NO session_id in the url and the router is ready the billingPostOrganizationRequest is fetched from the server', async () => {
  server.use(getOrganizations);
  mocks.useOrganizationMemberInvitesLazyQuery.mockImplementation(
    fetchOrganizationMemberInvitesMock,
  );

  mocks.useRouter.mockImplementation(() => getUseRouterObject(undefined, true));
  mocks.userData.mockImplementation(() => mockSession.user);
  mocks.useOrganizationNewRequestsLazyQuery.mockImplementation(() => [
    fetchOrganizationNewRequestsResponseMock,
  ]);

  mocks.usePostOrganizationRequestMutation.mockImplementation(() => [
    fetchPostOrganizationResponseMock.mockImplementation(() => ({
      data: {
        billingPostOrganizationRequest: {
          Status: CheckoutStatus.Open,
          Slug: 'newOrgSlug',
          ClientSecret: 'very_secret_secret',
          __typename: 'PostOrganizationRequestResponse',
        },
      },
    })),
  ]);

  render(<NotificationsTray />);
  await waitFor(() => {
    /* Wait for the component to be update */
  });
  expect(fetchPostOrganizationResponseMock).toHaveBeenCalled();
});

test('if the router is not ready the billingPostOrganizationRequest is not fetched from the server', async () => {
  server.use(getOrganizations);
  mocks.useOrganizationMemberInvitesLazyQuery.mockImplementation(
    fetchOrganizationMemberInvitesMock,
  );
  mocks.useRouter.mockImplementation(() =>
    getUseRouterObject(undefined, false),
  );
  mocks.userData.mockImplementation(() => mockSession.user);
  mocks.useOrganizationNewRequestsLazyQuery.mockImplementation(() => [
    fetchOrganizationNewRequestsResponseMock,
  ]);

  mocks.usePostOrganizationRequestMutation.mockImplementation(() => [
    fetchPostOrganizationResponseMock.mockImplementation(() => ({
      data: {
        billingPostOrganizationRequest: {
          Status: CheckoutStatus.Open,
          Slug: 'newOrgSlug',
          ClientSecret: 'very_secret_secret',
          __typename: 'PostOrganizationRequestResponse',
        },
      },
    })),
  ]);

  render(<NotificationsTray />);
  await waitFor(() => {
    /* Wait for the component to be update */
  });
  expect(fetchPostOrganizationResponseMock).not.toHaveBeenCalled();
});

test('if there is a session_id in the url the billingPostOrganizationRequest is NOT fetched from the server ', async () => {
  server.use(getOrganizations);
  mocks.useOrganizationMemberInvitesLazyQuery.mockImplementation(
    fetchOrganizationMemberInvitesMock,
  );
  mocks.useRouter.mockImplementation(() => getUseRouterObject('SESSION_ID'));
  mocks.userData.mockImplementation(() => mockSession.user);
  mocks.useOrganizationNewRequestsLazyQuery.mockImplementation(() => [
    fetchOrganizationNewRequestsResponseMock,
  ]);
  mocks.usePostOrganizationRequestMutation.mockImplementation(() => [
    fetchPostOrganizationResponseMock,
  ]);

  render(<NotificationsTray />);
  await waitFor(() => {
    /* Wait for the component to be update */
  });
  expect(fetchPostOrganizationResponseMock).not.toHaveBeenCalled();
});
