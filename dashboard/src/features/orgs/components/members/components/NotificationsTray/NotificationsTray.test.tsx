import { mockMatchMediaValue } from '@/tests/mocks';
import { getOrganizations } from '@/tests/msw/mocks/graphql/getOrganizationQuery';

import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { mockSession } from '@/tests/orgs/mocks';
import { queryClient, render, waitFor } from '@/tests/orgs/testUtils';
import { CheckoutStatus } from '@/utils/__generated__/graphql';

import { setupServer } from 'msw/node';
import { afterAll, beforeAll, vi } from 'vitest';
import NotificationsTray from './NotificationsTray';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

export const getUseRouterObject = (session_id?: string) => ({
  basePath: '',
  pathname: '/orgs/xyz/projects/test-project',
  route: '/orgs/[orgSlug]/projects/[appSubdomain]',
  asPath: '/orgs/xyz/projects/test-project',
  isLocaleDomain: false,
  isReady: true,
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
  const actualNhostNextjs = await vi.importActual<any>('@nhost/nextjs');
  return {
    ...actualNhostNextjs,
    userData: mocks.userData,
  };
});

vi.mock('@/utils/__generated__/graphql', async () => {
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

test('if there is NO session_id in the url the billingPostOrganizationRequest is fetched from the server', async () => {
  server.use(getOrganizations);
  mocks.useOrganizationMemberInvitesLazyQuery.mockImplementation(
    fetchOrganizationMemberInvitesMock,
  );
  mocks.useRouter.mockImplementation(() => getUseRouterObject());
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
