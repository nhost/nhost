import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import NewTicket from '@/features/support/components/NewTicket';
import { SupportArea } from '@/features/support/components/SupportArea';
import SupportViewSwitch from '@/features/support/components/SupportViewSwitch';
import TicketDetail from '@/features/support/components/TicketDetail';
import TicketList from '@/features/support/components/TicketList';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import { resetSampleTickets } from '@/features/support/utils/sample-tickets';
import {
  DashboardReserveSupportAttachmentDocument,
  type DashboardReserveSupportAttachmentMutation,
  type DashboardSupportEventsQuery,
  DashboardSupportTicketDocument,
  type DashboardSupportTicketQuery,
  DashboardSupportTicketsDocument,
  type DashboardSupportTicketsQuery,
  SupportSeverities_Enum,
  SupportTicketEventKinds_Enum,
  SupportTicketStatuses_Enum,
} from '@/generated/graphql';
import { useAuth } from '@/providers/Auth';
import { useNhostClient } from '@/providers/nhost';
import { mockMatchMediaValue, mockRouter, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { expectInputValue } from '@/tests/supportEditor';
import {
  act,
  mockScrollIntoViewAndPointerCapture,
  Providers,
  queryClient,
  render,
  renderHook,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({ useRouter: vi.fn() }));
vi.mock('next/router', () => ({ useRouter: mocks.useRouter }));

const ticketId = '7d442aba-6e61-4854-b354-0d5ec8d198d8';
const organizationID = '0d9c1e17-4983-4d38-b793-1be03368bec1';
const otherOrganizationID = '28ba74e2-b51a-4875-8913-9339a6da5026';
const projectID = '250375e1-2ac2-48ed-8ac8-eb5f30a7f01a';
const originalClaims = structuredClone(mockSession.decodedToken);
const originalToken = mockSession.accessToken;
function sessionToken(roles: string[]) {
  return `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: mockSession.user!.id, exp: Math.floor(Date.now() / 1000) + 3600, 'https://hasura.io/jwt/claims': { 'x-hasura-user-id': mockSession.user!.id, 'x-hasura-default-role': 'user', 'x-hasura-allowed-roles': roles } }))}.test-signature`;
}
const initialTicket: NonNullable<DashboardSupportTicketQuery['supportTicket']> =
  {
    id: ticketId,
    number: 42,
    title: 'Storage upload fails',
    description: '<script>not executed</script>\nReproduction steps',
    status: SupportTicketStatuses_Enum.New,
    severity: SupportSeverities_Enum.Normal,
    services: ['storage'],
    organizationID,
    organizationName: 'Acme',
    projectID,
    projectName: 'Production',
    requesterID: mockSession.user!.id,
    requesterName: 'Customer Alice',
    assigneeID: null,
    assigneeName: null,
    version: 1,
    createdAt: '2026-01-01T12:00:00Z',
    updatedAt: '2026-01-01T12:00:00Z',
    resolvedAt: null,
    closedAt: null,
    organization: {
      plan: { supportAllowedSeverities: ['low', 'normal', 'high', 'urgent'] },
    },
  };
const initialEvent: DashboardSupportEventsQuery['supportTicketEvents'][number] =
  {
    id: 'event-1',
    actorName: 'Customer Alice',
    kind: SupportTicketEventKinds_Enum.Created,
    oldValue: null,
    newValue: 'new',
    createdAt: initialTicket.createdAt,
  };
let organizationSeverities: string[] | null = [
  'low',
  'normal',
  'high',
  'urgent',
];
let otherOrganizationSeverities: string[] = ['low'];
let ticket = structuredClone(initialTicket);
let event = structuredClone(initialEvent);
let requests: {
  operation: string;
  role: string | null;
  variables: Record<string, unknown>;
}[] = [];
const push = vi.fn().mockResolvedValue(true);
const replace = vi.fn().mockResolvedValue(true);
const server = setupServer(
  http.post('https://local.auth.local.nhost.run/v1/token', () =>
    HttpResponse.json({ ...mockSession }),
  ),
  nhostGraphQLLink.query(
    'dashboardSupportTickets',
    ({ request, variables }) => {
      requests.push({
        operation: 'list',
        role: request.headers.get('x-hasura-role'),
        variables,
      });
      return HttpResponse.json({ data: { supportTickets: [ticket] } });
    },
  ),
  nhostGraphQLLink.query('dashboardSupportTicket', ({ request, variables }) => {
    requests.push({
      operation: 'detail',
      role: request.headers.get('x-hasura-role'),
      variables,
    });
    return HttpResponse.json({
      data: {
        supportTicket: ticket,
        supportTicketTransitions:
          ticket.status === 'closed'
            ? []
            : [
                {
                  fromStatus: ticket.status,
                  toStatus:
                    ticket.status === 'resolved'
                      ? 'waiting_for_support'
                      : 'resolved',
                },
              ],
      },
    });
  }),
  nhostGraphQLLink.query(
    'dashboardSupportComments',
    ({ request, variables }) => {
      requests.push({
        operation: 'comments',
        role: request.headers.get('x-hasura-role'),
        variables,
      });
      return HttpResponse.json({
        data: {
          supportComments: [
            {
              id: 'comment-1',
              body: 'We are investigating.',
              authorID: 'agent-id',
              authorName: 'Support Bob',
              authorRole: 'support_agent',
              createdAt: '2026-01-02T12:00:00Z',
            },
          ],
        },
      });
    },
  ),
  nhostGraphQLLink.query('dashboardSupportAttachments', () =>
    HttpResponse.json({ data: { supportTicket: { attachments: [] } } }),
  ),
  nhostGraphQLLink.query('dashboardSupportEvents', ({ request, variables }) => {
    requests.push({
      operation: 'events',
      role: request.headers.get('x-hasura-role'),
      variables,
    });
    return HttpResponse.json<{ data: DashboardSupportEventsQuery }>({
      data: { supportTicketEvents: [event] },
    });
  }),
  nhostGraphQLLink.query(
    'dashboardSupportOrganizations',
    ({ request, variables }) => {
      requests.push({
        operation: 'organizations',
        role: request.headers.get('x-hasura-role'),
        variables,
      });
      return HttpResponse.json({
        data: {
          organizations: [
            {
              id: organizationID,
              name: 'Acme',
              slug: 'acme',
              plan:
                organizationSeverities === null
                  ? null
                  : {
                      name: 'Pro',
                      supportAllowedSeverities: organizationSeverities,
                    },
              apps: [{ id: projectID, name: 'Production' }],
            },
            {
              id: otherOrganizationID,
              name: 'Other org',
              slug: 'other-org',
              plan: {
                name: 'Starter',
                supportAllowedSeverities: otherOrganizationSeverities,
              },
              apps: [],
            },
          ],
        },
      });
    },
  ),
  nhostGraphQLLink.mutation(
    'dashboardCreateSupportTicket',
    ({ request, variables }) => {
      requests.push({
        operation: 'create',
        role: request.headers.get('x-hasura-role'),
        variables,
      });
      return HttpResponse.json({
        data: { insertSupportTicket: { id: ticketId } },
      });
    },
  ),
  nhostGraphQLLink.mutation(
    'dashboardReplyToSupportTicket',
    ({ request, variables }) => {
      requests.push({
        operation: 'reply',
        role: request.headers.get('x-hasura-role'),
        variables,
      });
      return HttpResponse.json({
        data: { insertSupportComment: { id: 'new-comment' } },
      });
    },
  ),
  nhostGraphQLLink.mutation(
    'dashboardUpdateSupportTicket',
    ({ request, variables }) => {
      requests.push({
        operation: 'update',
        role: request.headers.get('x-hasura-role'),
        variables,
      });
      return HttpResponse.json({
        data: { updateSupportTickets: { affected_rows: 1 } },
      });
    },
  ),
);

function makeAgent() {
  mockSession.accessToken = sessionToken(['user', 'support_agent']);
  mockSession.decodedToken = {
    ...originalClaims,
    'https://hasura.io/jwt/claims': {
      'x-hasura-allowed-roles': ['user', 'support_agent'],
    },
  };
}
async function select(user: TestUserEvent, label: string, option: string) {
  if (label === 'Severity') {
    await user.click(screen.getByRole('radio', { name: option }));
    return;
  }
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}
async function fillTicket(user: TestUserEvent) {
  await screen.findByRole('heading', { name: 'New ticket' });
  await select(user, 'Organization', 'Acme');
  await user.click(screen.getByRole('button', { name: 'Storage' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Title' }),
    'Uploads fail',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    'Steps to reproduce',
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  resetSampleTickets(mockSession.user!.id);
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  toast.remove();
  window.localStorage.removeItem(
    `support-preview-view:${mockSession.user!.id}`,
  );
  mockSession.accessToken = sessionToken(['user']);
  queryClient.clear();
  ticket = structuredClone(initialTicket);
  organizationSeverities = ['low', 'normal', 'high', 'urgent'];
  otherOrganizationSeverities = ['low'];
  event = structuredClone(initialEvent);
  requests = [];
  mockSession.decodedToken = structuredClone(originalClaims);
  mockScrollIntoViewAndPointerCapture();
  mocks.useRouter.mockReturnValue({
    ...mockRouter,
    query: { ticketId },
    isReady: true,
    push,
    replace,
  });
});
afterEach(() => {
  toast.remove();
  window.localStorage.removeItem(
    `support-preview-view:${mockSession.user!.id}`,
  );
  mockSession.accessToken = originalToken;
  server.resetHandlers();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockSession.decodedToken = structuredClone(originalClaims);
  queryClient.clear();
});
afterAll(() => server.close());

function expectHelpFooter(visible: boolean) {
  const heading = screen.queryByRole('heading', {
    name: 'Other ways to get help',
  });
  if (!visible) {
    expect(heading).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Read the docs/ }),
    ).not.toBeInTheDocument();
    return;
  }
  expect(heading).toBeInTheDocument();
  expect(heading).toHaveClass('sr-only');
  expect(
    screen.getByRole('region', { name: 'Other ways to get help' }),
  ).toContainElement(heading);
  const cards = [
    {
      title: 'Read the docs',
      description: 'Guides and answers for every Nhost feature.',
      href: 'https://docs.nhost.io',
    },
    {
      title: 'Report on GitHub',
      description: 'Found a bug or want a feature? Open an issue.',
      href: 'https://github.com/nhost/nhost/issues/new/choose',
    },
    {
      title: 'Ask the community',
      description: 'Get help from other developers on Discord.',
      href: 'https://discord.com/invite/9V7Qb2U',
    },
  ];
  for (const card of cards) {
    const link = screen.getByRole('link', {
      name: `${card.title} ${card.description} (opens in a new tab)`,
    });
    expect(link).toHaveAttribute('href', card.href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(link).getByText(card.title)).toHaveClass(
      'mt-3',
      'font-semibold',
      'text-sm',
    );
    expect(within(link).getByText(card.description)).not.toHaveClass(
      'font-semibold',
    );
  }
  expect(screen.queryByText(/Need a quick answer/)).not.toBeInTheDocument();
}

describe('temporary Support view preview', () => {
  function supportRoute(pathname = '/support') {
    mocks.useRouter.mockReturnValue({
      ...mockRouter,
      pathname,
      query: { ticketId },
      isReady: true,
      push,
      replace,
    });
  }

  it('never exposes the preview in production, even with a saved agent value', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENV', 'prod');
    supportRoute();
    window.localStorage.setItem(
      `support-preview-view:${mockSession.user!.id}`,
      'agent',
    );
    render(
      <>
        <SupportViewSwitch />
        <TicketList />
      </>,
    );
    await screen.findByRole('link', { name: /Storage upload fails/ });
    expect(
      screen.queryByRole('radiogroup', { name: 'View support as' }),
    ).not.toBeInTheDocument();
    expectHelpFooter(true);
    expect(
      requests.find((request) => request.operation === 'list'),
    ).toMatchObject({ role: 'user' });
  });

  it.each(['dev', 'staging'])(
    'offers customer accounts both views in %s without mixing real and sample lists',
    async (environment) => {
      vi.stubEnv('NEXT_PUBLIC_ENV', environment);
      supportRoute();
      const user = new TestUserEvent();
      render(
        <>
          <SupportViewSwitch />
          <TicketList />
        </>,
      );
      await screen.findByRole('link', { name: /Storage upload fails/ });
      const group = screen.getByRole('radiogroup', { name: 'View support as' });
      expect(
        within(group).getByRole('radio', { name: 'Customer' }),
      ).toHaveAttribute('data-state', 'on');
      const realRequests = requests.length;
      await user.click(within(group).getByRole('radio', { name: 'Agent' }));
      await screen.findByText('Sample data');
      await screen.findByRole('link', {
        name: /Can't connect to Postgres after upgrade/,
      });
      expect(
        screen.queryByRole('link', { name: /Storage upload fails/ }),
      ).not.toBeInTheDocument();
      expectHelpFooter(true);
      expect(requests).toHaveLength(realRequests);
      await user.click(within(group).getByRole('radio', { name: 'Customer' }));
      await screen.findByRole('link', { name: /Storage upload fails/ });
      expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', {
          name: /Can't connect to Postgres after upgrade/,
        }),
      ).not.toBeInTheDocument();
      expectHelpFooter(true);
    },
  );

  it('never calls GraphQL, Storage or session refresh for sample actions', async () => {
    supportRoute();
    window.localStorage.setItem(
      `support-preview-view:${mockSession.user!.id}`,
      'agent',
    );
    const { result } = renderHook(
      () => ({ support: useSupportSession(), client: useNhostClient() }),
      { wrapper: Providers },
    );
    await waitFor(() => expect(result.current.support.user).not.toBeNull());
    expect(result.current.support.isSample).toBe(true);
    expect(result.current.support.isAgent).toBe(true);
    expect(result.current.support.queryKey[2]).toBe('sample');
    const graphql = vi.spyOn(result.current.client.graphql, 'request');
    const refresh = vi.spyOn(result.current.client, 'refreshSession');
    const upload = vi.spyOn(result.current.client.storage, 'uploadFiles');
    const download = vi.spyOn(result.current.client.storage, 'getFile');
    try {
      const data =
        await result.current.support.request<DashboardSupportTicketsQuery>(
          DashboardSupportTicketsDocument,
          { where: {}, offset: 0 },
        );
      const reservation =
        await result.current.support.request<DashboardReserveSupportAttachmentMutation>(
          DashboardReserveSupportAttachmentDocument,
          {
            ticketId: data.supportTickets.find(
              (candidate) => candidate.status === 'new',
            )!.id,
          },
        );
      const id = reservation.insertSupportAttachmentUpload!.id;
      await result.current.support.uploadAttachment(
        id,
        new File(['only in memory'], 'example.txt', { type: 'text/plain' }),
      );
      expect(
        (await result.current.support.downloadAttachment(id)).size,
      ).toBeGreaterThan(0);
      expect(graphql).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
      expect(upload).not.toHaveBeenCalled();
      expect(download).not.toHaveBeenCalled();
    } finally {
      graphql.mockRestore();
      refresh.mockRestore();
      upload.mockRestore();
      download.mockRestore();
    }
  });

  it('keeps ticket creation real and user-scoped while Agent sample view is selected', async () => {
    supportRoute('/support/ticket');
    window.localStorage.setItem(
      `support-preview-view:${mockSession.user!.id}`,
      'agent',
    );
    const user = new TestUserEvent();
    render(
      <>
        <SupportViewSwitch />
        <NewTicket />
      </>,
    );
    await fillTicket(user);
    expect(screen.getByText('Sample data')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'create'),
      ).toMatchObject({ role: 'user' }),
    );
    expect(requests.some((request) => request.role === 'support_agent')).toBe(
      false,
    );
  });

  it('shows not found when switching a real ticket into the sample set', async () => {
    supportRoute('/support/tickets/[ticketId]');
    const user = new TestUserEvent();
    render(
      <>
        <SupportViewSwitch />
        <TicketDetail />
      </>,
    );
    await screen.findByRole('heading', { name: ticket.title });
    const group = screen.getByRole('radiogroup', { name: 'View support as' });
    await user.click(within(group).getByRole('radio', { name: 'Agent' }));
    await screen.findByRole('heading', { name: 'Ticket not found' });
    expect(push).not.toHaveBeenCalled();
    await user.click(within(group).getByRole('radio', { name: 'Customer' }));
    await screen.findByRole('heading', { name: ticket.title });
  });

  it.each(['/support', '/support/ticket', '/support/tickets/[ticketId]'])(
    'shows the switch for agents on %s',
    async (pathname) => {
      makeAgent();
      supportRoute(pathname);
      render(<SupportViewSwitch />);
      const group = await screen.findByRole('radiogroup', {
        name: 'View support as',
      });
      expect(
        within(group).getByRole('radio', { name: 'Agent' }),
      ).toHaveAttribute('data-state', 'on');
      await new TestUserEvent().click(
        within(group).getByRole('radio', { name: 'Agent' }),
      );
      expect(
        within(group).getByRole('radio', { name: 'Agent' }),
      ).toHaveAttribute('data-state', 'on');
    },
  );

  it('does not show the switch outside Support', async () => {
    makeAgent();
    supportRoute('/account');
    render(<SupportViewSwitch />);
    expect(
      screen.queryByRole('radiogroup', { name: 'View support as' }),
    ).not.toBeInTheDocument();
  });

  it('switches all list consumers together and persists the choice for this user', async () => {
    makeAgent();
    supportRoute();
    const user = new TestUserEvent();
    const view = render(
      <>
        <SupportViewSwitch />
        <TicketList />
      </>,
    );
    const group = await screen.findByRole('radiogroup', {
      name: 'View support as',
    });
    await screen.findByRole('button', { name: 'Assigned to me' });
    await user.click(within(group).getByRole('radio', { name: 'Customer' }));
    await screen.findByRole('heading', { name: 'Other ways to get help' });
    expect(
      screen.queryByRole('button', { name: 'Assigned to me' }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        requests.filter((request) => request.operation === 'list').at(-1),
      ).toMatchObject({ role: 'user' }),
    );
    expect(
      window.localStorage.getItem(
        `support-preview-view:${mockSession.user!.id}`,
      ),
    ).toBe('customer');
    view.unmount();
    render(
      <>
        <SupportViewSwitch />
        <TicketList />
      </>,
    );
    const restored = await screen.findByRole('radiogroup', {
      name: 'View support as',
    });
    expect(
      within(restored).getByRole('radio', { name: 'Customer' }),
    ).toHaveAttribute('data-state', 'on');
    await user.click(within(restored).getByRole('radio', { name: 'Agent' }));
    await screen.findByRole('button', { name: 'Assigned to me' });
    expectHelpFooter(true);
    await waitFor(() =>
      expect(
        requests.filter((request) => request.operation === 'list').at(-1),
      ).toMatchObject({ role: 'support_agent' }),
    );
  });

  it('hides ticket management controls and uses user requests in customer preview', async () => {
    makeAgent();
    supportRoute('/support/tickets/[ticketId]');
    const user = new TestUserEvent();
    render(
      <>
        <SupportViewSwitch />
        <TicketDetail />
      </>,
    );
    await screen.findByRole('combobox', { name: 'Change ticket status' });
    expect(
      screen.getByRole('combobox', { name: 'Change ticket severity' }),
    ).toBeInTheDocument();
    await user.click(
      within(
        screen.getByRole('radiogroup', { name: 'View support as' }),
      ).getByRole('radio', { name: 'Customer' }),
    );
    await screen.findByRole('heading', { name: ticket.title });
    await waitFor(() =>
      expect(
        requests.filter((request) => request.operation === 'detail').at(-1),
      ).toMatchObject({ role: 'user' }),
    );
    expect(
      screen.queryByRole('combobox', { name: 'Change ticket status' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Change ticket severity' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assign to me' }),
    ).not.toBeInTheDocument();
  });

  it('shows an inaccessible ticket state in customer view without redirecting', async () => {
    makeAgent();
    supportRoute('/support/tickets/[ticketId]');
    server.use(
      nhostGraphQLLink.query('dashboardSupportTicket', ({ request }) =>
        HttpResponse.json({
          data: {
            supportTicket:
              request.headers.get('x-hasura-role') === 'support_agent'
                ? ticket
                : null,
            supportTicketTransitions: [],
          },
        }),
      ),
    );
    const user = new TestUserEvent();
    render(
      <>
        <SupportViewSwitch />
        <TicketDetail />
      </>,
    );
    await screen.findByRole('button', { name: 'Assign to me' });
    const group = screen.getByRole('radiogroup', { name: 'View support as' });
    await user.click(within(group).getByRole('radio', { name: 'Customer' }));
    await screen.findByRole('heading', { name: 'Ticket not found' });
    expect(
      screen.queryByRole('button', { name: 'Assign to me' }),
    ).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    await user.click(within(group).getByRole('radio', { name: 'Agent' }));
    await screen.findByRole('button', { name: 'Assign to me' });
  });

  it('ignores another user’s saved view', async () => {
    makeAgent();
    supportRoute();
    window.localStorage.setItem(
      'support-preview-view:another-user',
      'customer',
    );
    try {
      render(<SupportViewSwitch />);
      const group = await screen.findByRole('radiogroup', {
        name: 'View support as',
      });
      expect(
        within(group).getByRole('radio', { name: 'Agent' }),
      ).toHaveAttribute('data-state', 'on');
    } finally {
      window.localStorage.removeItem('support-preview-view:another-user');
    }
  });

  it('uses samples instead of real agent requests when the account loses its role', async () => {
    makeAgent();
    supportRoute();
    window.localStorage.setItem(
      `support-preview-view:${mockSession.user!.id}`,
      'agent',
    );
    function RevokeRole() {
      const { session, updateSession } = useAuth();
      return (
        <button
          type="button"
          onClick={() =>
            updateSession({ ...session!, decodedToken: originalClaims })
          }
        >
          Revoke preview role
        </button>
      );
    }
    render(
      <>
        <SupportViewSwitch />
        <RevokeRole />
        <TicketList />
      </>,
    );
    await screen.findByRole('radiogroup', { name: 'View support as' });
    const realRequests = requests.length;
    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Revoke preview role' }),
    );
    await screen.findByText('Sample data');
    await screen.findByRole('link', {
      name: /Can't connect to Postgres after upgrade/,
    });
    expect(
      screen.queryByRole('link', { name: /Storage upload fails/ }),
    ).not.toBeInTheDocument();
    expect(requests).toHaveLength(realRequests);
  });

  it.each([false, true])(
    'blocks explicit agent requests in customer view (real agent=%s)',
    async (agent) => {
      if (agent) {
        makeAgent();
        window.localStorage.setItem(
          `support-preview-view:${mockSession.user!.id}`,
          'customer',
        );
      }
      const { result } = renderHook(() => useSupportSession(), {
        wrapper: Providers,
      });
      await waitFor(() => expect(result.current.user).not.toBeNull());
      await expect(
        result.current.request(
          DashboardSupportTicketDocument,
          { id: ticketId },
          undefined,
          'support_agent',
        ),
      ).rejects.toThrow('Your support access changed');
      expect(requests.some((request) => request.operation === 'detail')).toBe(
        false,
      );
    },
  );
});

describe('native dashboard support', () => {
  it.each([
    { page: 'new', current: 'New ticket' },
    { page: 'ticket', current: '#42' },
  ])('shows the breadcrumb on the $page page', async ({ page, current }) => {
    render(page === 'new' ? <NewTicket /> : <TicketDetail />);
    if (page === 'ticket') {
      await screen.findByRole('heading', { name: initialTicket.title });
    } else if (page === 'new') {
      await screen.findByRole('heading', { name: 'New ticket' });
    }
    if (page === 'ticket') {
      expect(screen.getByRole('link', { name: 'All tickets' })).toHaveAttribute(
        'href',
        '/support',
      );
      return;
    }
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(
      within(nav).queryByRole('link', { name: 'Home' }),
    ).not.toBeInTheDocument();
    expect(
      within(nav)
        .getAllByRole('listitem')
        .filter((item) => item.getAttribute('aria-hidden') !== 'true'),
    ).toHaveLength(2);
    const last = within(nav).getByText(current);
    expect(last).toHaveAttribute('aria-current', 'page');
    expect(last.tagName).toBe('LI');
    expect(within(nav).getByRole('link', { name: 'Support' })).toHaveAttribute(
      'href',
      '/support',
    );
    expect(screen.queryByText('← Support')).not.toBeInTheDocument();
  });

  it.each([false, true])(
    'keeps filters and hides pagination for an empty queue (agent=%s)',
    async (agent) => {
      if (agent) {
        makeAgent();
      }
      server.use(
        nhostGraphQLLink.query('dashboardSupportTickets', () =>
          HttpResponse.json({ data: { supportTickets: [] } }),
        ),
      );
      render(<TicketList />);
      await screen.findByRole('heading', {
        name: agent ? 'No tickets in this queue' : 'No tickets yet',
      });
      expect(
        screen.getByRole('textbox', { name: 'Search tickets' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Status' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Previous' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Next' }),
      ).not.toBeInTheDocument();
      expectHelpFooter(true);
      expect(
        screen.getAllByRole('link', { name: 'Create ticket' }),
      ).toHaveLength(1);
      expect(
        within(screen.getByRole('banner')).queryByRole('link', {
          name: 'Create ticket',
        }) !== null,
      ).toBe(agent);
      expect(
        screen.queryByRole('navigation', { name: 'Breadcrumb' }),
      ).not.toBeInTheDocument();
      const box = screen.getByRole('heading', {
        name: agent ? 'No tickets in this queue' : 'No tickets yet',
      }).parentElement!;
      expect(box).toHaveClass(
        'min-h-80',
        'sm:min-h-112',
        'px-6',
        'py-20',
        'sm:px-8',
        'sm:py-32',
        'rounded-lg',
        'border',
        'items-center',
        'justify-center',
      );
      if (!agent) {
        expect(
          within(box).getByRole('link', { name: 'Create ticket' }),
        ).toHaveAttribute('href', '/support/ticket');
        expect(
          within(box).getByText(
            "Need help? Create a ticket and we'll reply here.",
          ),
        ).toBeInTheDocument();
      }
    },
  );

  it.each([false, true])(
    'keeps the loading frame and only shows the agent header action (agent=%s)',
    async (agent) => {
      if (agent) {
        makeAgent();
      }
      let release = () => {};
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        nhostGraphQLLink.query('dashboardSupportTickets', async () => {
          await pending;
          return HttpResponse.json({ data: { supportTickets: [] } });
        }),
      );
      render(<TicketList />);
      try {
        const loading = await screen.findByText('Loading tickets…');
        expect(loading.closest('.min-h-80')).toHaveClass(
          'sm:min-h-112',
          'px-6',
          'py-20',
          'sm:px-8',
          'sm:py-32',
          'rounded-lg',
          'border',
          'items-center',
          'justify-center',
        );
        expect(
          screen.queryAllByRole('link', { name: 'Create ticket' }),
        ).toHaveLength(agent ? 1 : 0);
        expect(
          screen.getByRole('textbox', { name: 'Search tickets' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Status' }),
        ).toBeInTheDocument();
        expectHelpFooter(true);
      } finally {
        release();
      }
      await screen.findByRole('heading', {
        name: agent ? 'No tickets in this queue' : 'No tickets yet',
      });
      expect(
        screen.getAllByRole('link', { name: 'Create ticket' }),
      ).toHaveLength(1);
    },
  );

  it('keeps filters and allows clearing a search with no matches', async () => {
    mocks.useRouter.mockReturnValue({
      ...mockRouter,
      query: { q: 'Missing' },
      isReady: true,
      push,
      replace,
    });
    server.use(
      nhostGraphQLLink.query('dashboardSupportTickets', () =>
        HttpResponse.json({ data: { supportTickets: [] } }),
      ),
    );
    render(<TicketList />);
    const emptyHeading = await screen.findByRole('heading', {
      name: 'No tickets match',
    });
    expectHelpFooter(true);
    expect(emptyHeading.parentElement).toHaveClass(
      'min-h-80',
      'sm:min-h-112',
      'px-6',
      'py-20',
      'sm:px-8',
      'sm:py-32',
      'rounded-lg',
      'border',
    );
    expect(screen.getAllByRole('link', { name: 'Create ticket' })).toHaveLength(
      1,
    );
    expect(
      within(screen.getByRole('banner')).getByRole('link', {
        name: 'Create ticket',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search tickets' })).toHaveValue(
      'Missing',
    );
    expect(
      screen.queryByRole('textbox', { name: 'Filter by organization' }),
    ).not.toBeInTheDocument();
    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Clear filters' }),
    );
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          q: '',
          organization: '',
          status: 'active',
          page: 0,
        }),
      }),
      undefined,
      { shallow: true },
    );
  });

  it.each([false, true])(
    'keeps loaded controls and content during background refresh (agent=%s)',
    async (agent) => {
      if (agent) {
        makeAgent();
      }
      render(<TicketList />);
      await screen.findByRole('link', { name: /Storage upload fails/ });
      let release = () => {};
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = vi.fn();
      server.use(
        nhostGraphQLLink.query('dashboardSupportTickets', async () => {
          started();
          await pending;
          return HttpResponse.json({ data: { supportTickets: [ticket] } });
        }),
      );
      let refresh: Promise<void> | undefined;
      act(() => {
        refresh = queryClient.invalidateQueries({ queryKey: ['support'] });
      });
      try {
        await waitFor(() => expect(started).toHaveBeenCalled());
        expect(screen.queryByText('Loading tickets…')).not.toBeInTheDocument();
        expect(
          screen.getByRole('link', { name: /Storage upload fails/ }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('textbox', { name: 'Search tickets' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Status' }),
        ).toBeInTheDocument();
        if (agent) {
          expect(
            screen.getByRole('button', { name: 'Assigned to me' }),
          ).toBeInTheDocument();
        }
        expectHelpFooter(true);
      } finally {
        release();
        await act(async () => {
          await refresh;
        });
      }
    },
  );

  it('submits a search with Enter without a Search button', async () => {
    const user = new TestUserEvent();
    render(<TicketList />);
    await screen.findByRole('link', { name: /Storage upload fails/ });
    expect(
      screen.queryByRole('button', { name: 'Search' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Next' }),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Search tickets' }),
      'Uploads{Enter}',
    );
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ q: 'Uploads', page: 0 }),
      }),
      undefined,
      { shallow: true },
    );
  });
  it('loads the customer queue using the native user role and opens tickets in-app', async () => {
    render(<TicketList />);
    const link = await screen.findByRole(
      'link',
      {
        name: /Storage upload fails/,
      },
      { timeout: 10000 },
    );
    expect(link).toHaveAttribute('href', `/support/tickets/${ticketId}`);
    expectHelpFooter(true);
    expect(screen.getByRole('link', { name: 'Create ticket' })).toHaveAttribute(
      'href',
      '/support/ticket',
    );
    expect(
      screen.queryByRole('button', { name: 'Assigned to me' }),
    ).not.toBeInTheDocument();
    expect(requests[0]).toMatchObject({
      operation: 'list',
      role: 'user',
      variables: { offset: 0 },
    });
  });
  it('exposes global agent queues only for the native support_agent role', async () => {
    makeAgent();
    mocks.useRouter.mockReturnValue({
      ...mockRouter,
      query: { queue: 'mine', page: '2' },
      isReady: true,
      push,
      replace,
    });
    render(<TicketList />);
    expect(await screen.findByText('Agent')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: /Storage upload fails/ }),
    ).toBeInTheDocument();
    expect(requests[0]).toMatchObject({
      role: 'support_agent',
      variables: {
        offset: 100,
        where: {
          _and: [
            { status: { _nin: ['resolved', 'closed'] } },
            { assigneeID: { _eq: mockSession.user!.id } },
          ],
        },
      },
    });
    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Assigned to me', pressed: true }),
    );
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ queue: 'all', page: 0 }),
      }),
      undefined,
      { shallow: true },
    );
  });
  it('does not expose agent queues for the retired plural role', async () => {
    mockSession.accessToken = sessionToken(['user', 'support_agents']);
    mockSession.decodedToken = {
      ...originalClaims,
      'https://hasura.io/jwt/claims': {
        'x-hasura-allowed-roles': ['user', 'support_agents'],
      },
    };
    render(<TicketList />);
    await screen.findByRole('link', { name: /Storage upload fails/ });
    expect(screen.queryByText('Agent')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assigned to me' }),
    ).not.toBeInTheDocument();
    expect(requests[0]).toMatchObject({ operation: 'list', role: 'user' });
  });
  it('shows an error instead of an empty queue when access fails', async () => {
    server.use(
      nhostGraphQLLink.query('dashboardSupportTickets', () =>
        HttpResponse.json({ errors: [{ message: 'Access denied' }] }),
      ),
    );
    render(<TicketList />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load support tickets',
    );
    expect(screen.queryByText('No tickets yet')).not.toBeInTheDocument();
    expectHelpFooter(true);
    expect(screen.getAllByRole('link', { name: 'Create ticket' })).toHaveLength(
      1,
    );
    expect(
      within(screen.getByRole('banner')).getByRole('link', {
        name: 'Create ticket',
      }),
    ).toBeInTheDocument();
  });
  it('supports an empty customer queue', async () => {
    server.use(
      nhostGraphQLLink.query('dashboardSupportTickets', () =>
        HttpResponse.json({ data: { supportTickets: [] } }),
      ),
    );
    render(<TicketList />);
    expect(await screen.findByText('No tickets yet')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Next' }),
    ).not.toBeInTheDocument();
  });
  it('creates an organization-wide ticket without requester or attribution fields', async () => {
    makeAgent();
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    await select(user, 'Organization', 'Other org');
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/support/tickets/${ticketId}`),
    );
    expect(requests.find((request) => request.operation === 'create')).toEqual({
      operation: 'create',
      role: 'user',
      variables: {
        input: {
          organizationID: otherOrganizationID,
          projectID: null,
          title: 'Uploads fail',
          description: 'Steps to reproduce',
          services: ['storage'],
          severity: 'low',
        },
      },
    });
    expect(
      requests.find((request) => request.operation === 'organizations')?.role,
    ).toBe('user');
  });
  it.each([0, 1, 2])(
    'selects and locks a single organization with %s projects',
    async (projectCount) => {
      const apps = [
        { id: projectID, name: 'Production' },
        { id: otherOrganizationID, name: 'Staging' },
      ].slice(0, projectCount);
      server.use(
        nhostGraphQLLink.query('dashboardSupportOrganizations', () =>
          HttpResponse.json({
            data: {
              organizations: [
                {
                  id: organizationID,
                  name: 'Acme',
                  plan: { supportAllowedSeverities: ['low'] },
                  apps,
                },
              ],
            },
          }),
        ),
      );
      const user = new TestUserEvent();
      render(<NewTicket />);
      await screen.findByRole('heading', { name: 'New ticket' });
      const org = screen.getByRole('combobox', { name: 'Organization' });
      await waitFor(() => expect(org).toHaveTextContent('Acme'));
      expect(org).toBeDisabled();
      const project = screen.getByRole('combobox', { name: 'Project' });
      await waitFor(() =>
        expect(project).toHaveTextContent(
          projectCount === 1 ? 'Production' : 'No project',
        ),
      );
      if (projectCount === 1) {
        expect(project).toBeDisabled();
      } else {
        expect(project).toBeEnabled();
      }
      if (projectCount === 2) {
        await select(user, 'Project', 'Staging');
      }
      await user.type(
        screen.getByRole('textbox', { name: 'Title' }),
        'Need help',
      );
      await user.type(
        screen.getByRole('textbox', { name: 'Description' }),
        'Details',
      );
      await user.click(screen.getByRole('button', { name: 'Storage' }));
      await user.click(screen.getByRole('button', { name: 'Create ticket' }));
      await waitFor(() =>
        expect(
          requests.find((request) => request.operation === 'create'),
        ).toMatchObject({
          role: 'user',
          variables: {
            input: {
              organizationID,
              projectID:
                projectCount === 1
                  ? projectID
                  : projectCount === 2
                    ? otherOrganizationID
                    : null,
            },
          },
        }),
      );
    },
  );

  it('groups the form in three numbered steps and keeps later groups inactive before an organization is picked', async () => {
    render(<NewTicket />);
    await screen.findByRole('heading', { name: 'New ticket' });
    for (const name of ['Where', 'What', 'Details']) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
    for (const name of ['What', 'Details']) {
      const step = screen.getByRole('group', { name });
      expect(step).toBeDisabled();
      expect(step.closest('[inert]')).toHaveClass('opacity-20');
    }
    expect(
      screen.getByRole('group', { name: 'Where' }).closest('[inert]'),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Attach files' })).toBeDisabled();
    expect(screen.queryByText('Unlock with')).not.toBeInTheDocument();
    const description = screen.getByRole('textbox', { name: 'Description' });
    expect(description).toHaveAttribute('aria-readonly', 'true');
    expect(description).not.toHaveAttribute('placeholder');
    expect(screen.getByRole('textbox', { name: 'Title' })).not.toHaveAttribute(
      'placeholder',
    );
    expect(screen.queryByText('Pick one or more')).not.toBeInTheDocument();
    expectInputValue(description, '');
    expect(
      screen.queryByText('Pick an organization first'),
    ).not.toBeInTheDocument();
    for (const name of ['Low', 'Normal', 'High', 'Urgent']) {
      expect(screen.getByRole('radio', { name })).toBeDisabled();
    }
    const services = screen.getByRole('toolbar', { name: 'Services' });
    expect(within(services).getAllByRole('button')).toHaveLength(12);
    for (const service of within(services).getAllByRole('button')) {
      expect(service).toBeDisabled();
    }
  });

  it('supports multiple service chips, deselection and an error when none are picked', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await screen.findByRole('heading', { name: 'New ticket' });
    await select(user, 'Organization', 'Acme');
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    expect(
      await screen.findByText('Pick at least one service'),
    ).toBeInTheDocument();
    const services = screen.getByRole('toolbar', { name: 'Services' });
    expect(services).toHaveClass('flex-wrap');
    for (const service of within(services).getAllByRole('button')) {
      expect(service).toHaveClass('border-destructive', 'rounded-full');
    }
    const storage = within(services).getByRole('button', { name: 'Storage' });
    const database = within(services).getByRole('button', { name: 'Database' });
    await user.click(storage);
    await user.click(database);
    expect(storage).toHaveAttribute('aria-pressed', 'true');
    expect(database).toHaveAttribute('aria-pressed', 'true');
    await user.click(storage);
    expect(storage).toHaveAttribute('aria-pressed', 'false');
    expect(database).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() =>
      expect(
        screen.queryByText('Pick at least one service'),
      ).not.toBeInTheDocument(),
    );
  });

  it('moves the plan explanation and upgrade link into a keyboard-accessible hover card', async () => {
    organizationSeverities = ['low'];
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    expect(
      screen.queryByText(/Your Pro plan includes Low\./),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'See plans' }),
    ).not.toBeInTheDocument();
    const help = screen.getByRole('button', {
      name: 'Normal plan availability',
    });
    expect(help).toHaveAccessibleDescription(
      'Normal. Needs Team or Enterprise plan.',
    );
    await user.pointer({ target: help });
    const popup = await screen.findByRole('dialog', {
      name: 'Normal plan availability',
    });
    expect(
      within(popup).getByText(/Your Pro plan includes Low\./),
    ).toBeInTheDocument();
    expect(
      within(popup).getByRole('link', { name: 'See plans' }),
    ).toHaveAttribute('href', '/orgs/acme/billing?openUpgradeModal=true');
    act(() => help.focus());
    await user.keyboard('{Tab}');
    expect(
      within(popup).getByRole('link', { name: 'See plans' }),
    ).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Normal plan availability' }),
      ).not.toBeInTheDocument(),
    );
    expect(help).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked();
    organizationSeverities = ['low', 'normal', 'high', 'urgent'];
    await queryClient.invalidateQueries({ queryKey: ['support'] });
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Normal plan availability' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryAllByText('Team')).toHaveLength(0);
    expect(screen.queryByText('Enterprise')).not.toBeInTheDocument();
    expect(screen.queryByText('Unlock with')).not.toBeInTheDocument();
  });

  it('supports keyboard severity selection and clicking the whole card', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    act(() => screen.getByRole('radio', { name: 'Low' }).focus());
    await user.keyboard('{ArrowRight>}');
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked(),
    );
    await user.keyboard('{/ArrowRight}');
    await user.click(screen.getByText('A feature is broken'));
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
  });

  it('locks severities not allowed by the selected organization’s plan', async () => {
    organizationSeverities = ['low'];
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    expect(screen.getByRole('radio', { name: 'Low' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked();
    for (const name of ['Normal', 'High', 'Urgent']) {
      expect(screen.getByRole('radio', { name })).toBeDisabled();
    }
    expect(screen.getAllByText('Team')).toHaveLength(3);
    expect(screen.queryByText('Enterprise')).not.toBeInTheDocument();
    for (const badge of screen.getAllByText('Team')) {
      expect(badge).toHaveClass('border-brand-violet/20', 'text-brand-violet');
    }
    expect(
      screen.getByRole('radio', { name: 'Normal' }),
    ).toHaveAccessibleDescription('Something works, but not well');
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'create'),
      ).toMatchObject({ variables: { input: { severity: 'low' } } }),
    );
  });

  it('selects a permitted fallback and resets disallowed severity when the organization changes', async () => {
    organizationSeverities = ['urgent'];
    otherOrganizationSeverities = ['normal', 'high'];
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Urgent' })).toBeChecked(),
    );
    await select(user, 'Organization', 'Other org');
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked(),
    );
    expect(screen.getByRole('radio', { name: 'Low' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Urgent' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'High' })).toBeEnabled();
  });

  it.each([[], null])(
    'blocks creation for empty or unreadable plan entitlements (%s)',
    async (allowed) => {
      organizationSeverities = allowed;
      const user = new TestUserEvent();
      render(<NewTicket />);
      await fillTicket(user);
      expect(
        screen.getByRole('button', { name: 'Create ticket' }),
      ).toBeDisabled();
      await user.pointer({
        target: screen.getByRole('button', { name: 'Low plan availability' }),
      });
      expect(
        within(
          await screen.findByRole('dialog', { name: 'Low plan availability' }),
        ).getByText(/Support isn't on your .* plan\./),
      ).toBeInTheDocument();
      for (const name of ['Low', 'Normal', 'High', 'Urgent']) {
        expect(screen.getByRole('radio', { name })).toBeDisabled();
      }
      expect(requests.some((request) => request.operation === 'create')).toBe(
        false,
      );
    },
  );

  it('refreshes plan entitlements without retaining a disallowed severity', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    await select(user, 'Severity', 'Urgent');
    organizationSeverities = ['low'];
    await queryClient.invalidateQueries({ queryKey: ['support'] });
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked(),
    );
  });
  it('creates tickets with the raw Markdown description', async () => {
    const user = new TestUserEvent();
    const markdown = '## Reproduction\n\n```json\n{"error":"denied"}\n```';
    render(<NewTicket />);
    await fillTicket(user);
    const description = screen.getByRole('textbox', { name: 'Description' });
    await user.clear(description);
    await user.click(description);
    await user.paste(markdown);
    expectInputValue(description, markdown);
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'create'),
      ).toMatchObject({ variables: { input: { description: markdown } } }),
    );
  });
  it('resets a selected project when the organization changes', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    expect(screen.getByRole('combobox', { name: 'Project' })).toHaveTextContent(
      'Production',
    );
    expect(screen.getByRole('combobox', { name: 'Project' })).toBeDisabled();
    await select(user, 'Organization', 'Other org');
    expect(screen.getByRole('combobox', { name: 'Project' })).toHaveTextContent(
      'No project',
    );
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'create'),
      ).toMatchObject({
        variables: {
          input: { organizationID: otherOrganizationID, projectID: null },
        },
      }),
    );
  });
  it('validates required fields before making a mutation', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await screen.findByRole('heading', { name: 'New ticket' });
    expect(
      screen.getByRole('button', { name: 'Create ticket' }),
    ).toBeDisabled();
    await select(user, 'Organization', 'Acme');
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    expect(await screen.findByText('Add a title')).toBeInTheDocument();
    expect(screen.getByText('Pick at least one service')).toBeInTheDocument();
    expect(requests.some((request) => request.operation === 'create')).toBe(
      false,
    );
  });
  it('renders conversations safely without customer ticket-management controls', async () => {
    render(<TicketDetail />);
    expect(
      await screen.findByRole('heading', { name: 'Storage upload fails' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('We are investigating.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Nhost')).toBeInTheDocument();
    expect(screen.getByText('Reproduction steps')).toBeInTheDocument();
    expect(screen.queryByText(/<script>/)).not.toBeInTheDocument();
    expect(document.querySelector('article script')).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Ticket activity' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assign to me' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Change ticket severity' }),
    ).not.toBeInTheDocument();
  });
  it.each([
    { kind: SupportTicketEventKinds_Enum.Created, label: 'Created' },
    {
      kind: SupportTicketEventKinds_Enum.StatusChanged,
      label: 'Status changed',
    },
    {
      kind: SupportTicketEventKinds_Enum.SeverityChanged,
      label: 'Severity changed',
    },
    {
      kind: SupportTicketEventKinds_Enum.AssignmentChanged,
      label: 'Assignment changed',
    },
  ])(
    'renders $kind enum events in ticket activity',
    async ({ kind, label }) => {
      makeAgent();
      event.kind = kind;
      render(<TicketDetail />);
      await waitFor(() =>
        expect(
          screen.getByRole('region', { name: 'Ticket activity' }),
        ).toHaveTextContent(`Customer Alice · ${label}`),
      );
    },
  );
  it.each([
    SupportTicketStatuses_Enum.New,
    SupportTicketStatuses_Enum.Resolved,
  ])('hides status changes from customers on %s tickets', async (status) => {
    ticket.status = status;
    render(<TicketDetail />);
    await screen.findByRole('heading', { name: ticket.title });
    expect(
      screen.getAllByText(status === 'new' ? 'New' : 'Resolved'),
    ).not.toHaveLength(0);
    expect(
      screen.queryByRole('combobox', { name: 'Change ticket status' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Change ticket severity' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assign to me' }),
    ).not.toBeInTheDocument();
    expect(
      requests.find((request) => request.operation === 'detail'),
    ).toMatchObject({
      role: 'user',
    });
    expect(requests.some((request) => request.operation === 'update')).toBe(
      false,
    );
  });
  it('sends a native customer reply and clears the draft on success', async () => {
    const user = new TestUserEvent();
    render(<TicketDetail />);
    const reply = await screen.findByRole('textbox', { name: 'Your reply' });
    await user.type(reply, '  Here are more details  ');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'reply'),
      ).toMatchObject({
        role: 'user',
        variables: { ticketId, body: 'Here are more details' },
      }),
    );
    await waitFor(() => expectInputValue(reply, ''));
  });
  it('renders Markdown descriptions and comments and sends raw Markdown replies', async () => {
    ticket.description = '## Reproduction\n\n**Upload fails** with `403`.';
    server.use(
      nhostGraphQLLink.query('dashboardSupportComments', () =>
        HttpResponse.json({
          data: {
            supportComments: [
              {
                id: 'comment-markdown',
                authorName: 'Support Bob',
                authorRole: 'support_agent',
                body: '### Investigation\n\n- Check permissions',
                createdAt: initialTicket.createdAt,
              },
            ],
          },
        }),
      ),
    );
    const user = new TestUserEvent();
    render(<TicketDetail />);
    await screen.findByRole('heading', { name: 'Reproduction' });
    await screen.findByRole('heading', { name: 'Investigation' });
    expect(screen.getByText('Upload fails').tagName).toBe('STRONG');
    const markdown = '## Logs\n\n```text\nAccess denied\n```';
    await user.click(screen.getByRole('textbox', { name: 'Your reply' }));
    await user.paste(markdown);
    expectInputValue(
      screen.getByRole('textbox', { name: 'Your reply' }),
      markdown,
    );
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'reply'),
      ).toMatchObject({ variables: { ticketId, body: markdown } }),
    );
  });
  it('preserves a failed reply draft', async () => {
    server.use(
      nhostGraphQLLink.mutation('dashboardReplyToSupportTicket', () =>
        HttpResponse.json({ errors: [{ message: 'Access denied' }] }),
      ),
    );
    const user = new TestUserEvent();
    render(<TicketDetail />);
    const reply = await screen.findByRole('textbox', { name: 'Your reply' });
    await user.type(reply, 'Keep this draft');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send reply' })).toBeEnabled(),
    );
    expectInputValue(reply, 'Keep this draft');
    expect(screen.queryByText('Reply sent')).not.toBeInTheDocument();
  });
  it('assigns a ticket to the current agent with optimistic concurrency', async () => {
    makeAgent();
    render(<TicketDetail />);
    await new TestUserEvent().click(
      await screen.findByRole('button', { name: 'Assign to me' }),
    );
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'update'),
      ).toMatchObject({
        role: 'support_agent',
        variables: {
          id: ticketId,
          version: 1,
          changes: { assigneeID: mockSession.user!.id },
        },
      }),
    );
  });
  it('reports conflicts and reloads instead of claiming an update succeeded', async () => {
    makeAgent();
    server.use(
      nhostGraphQLLink.mutation('dashboardUpdateSupportTicket', () =>
        HttpResponse.json({
          data: { updateSupportTickets: { affected_rows: 0 } },
        }),
      ),
    );
    render(<TicketDetail />);
    await new TestUserEvent().click(
      await screen.findByRole('button', { name: 'Assign to me' }),
    );
    expect(
      await screen.findByText(/This ticket changed or is no longer accessible/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Ticket updated')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        requests.filter((request) => request.operation === 'detail').length,
      ).toBeGreaterThan(1),
    );
  });
  it('offers reopening a resolved ticket only to support agents', async () => {
    makeAgent();
    ticket.status = SupportTicketStatuses_Enum.Resolved;
    const user = new TestUserEvent();
    render(<TicketDetail />);
    await screen.findByRole('heading', { name: ticket.title });
    await select(user, 'Change ticket status', 'Reopen ticket');
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'update'),
      ).toMatchObject({
        role: 'support_agent',
        variables: {
          id: ticketId,
          version: 1,
          changes: { status: 'waiting_for_support' },
        },
      }),
    );
  });
  it('passes the available agent role for ticket reads and status updates', async () => {
    makeAgent();
    const user = new TestUserEvent();
    render(<TicketDetail />);
    await screen.findByRole('heading', { name: ticket.title });
    await waitFor(() => {
      expect(requests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'detail',
            role: 'support_agent',
          }),
          expect.objectContaining({
            operation: 'comments',
            role: 'support_agent',
          }),
          expect.objectContaining({
            operation: 'events',
            role: 'support_agent',
          }),
        ]),
      );
    });
    await select(user, 'Change ticket status', 'Resolved');
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'update'),
      ).toMatchObject({
        role: 'support_agent',
        variables: {
          id: ticketId,
          version: 1,
          changes: { status: 'resolved' },
        },
      }),
    );
  });
  it('makes closed tickets read-only even for agents', async () => {
    makeAgent();
    ticket.status = SupportTicketStatuses_Enum.Closed;
    render(<TicketDetail />);
    expect(
      await screen.findByText(/This ticket is closed and read-only/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Change ticket status' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Your reply' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assign to me' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Change ticket severity' }),
    ).not.toBeInTheDocument();
  });
  it('handles invisible tickets without loading their replies', async () => {
    server.use(
      nhostGraphQLLink.query('dashboardSupportTicket', () =>
        HttpResponse.json({
          data: { supportTicket: null, supportTicketTransitions: [] },
        }),
      ),
    );
    render(<TicketDetail />);
    expect(
      await screen.findByRole('heading', { name: 'Ticket not found' }),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.operation === 'comments')).toBe(
      false,
    );
  });
  it('rejects invalid ticket URLs without issuing GraphQL requests', async () => {
    mocks.useRouter.mockReturnValue({
      ...mockRouter,
      query: { ticketId: 'invalid' },
      isReady: true,
    });
    render(<TicketDetail />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid ticket address',
    );
    expect(requests).toEqual([]);
  });
  it('does not query platform support in local dashboard mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    render(
      <SupportArea>
        <TicketList />
      </SupportArea>,
    );
    expect(
      await screen.findByText(/Sign in to the Nhost platform/),
    ).toBeInTheDocument();
    expect(requests).toEqual([]);
  });
  it('loads older replies without dropping the pagination boundary reply', async () => {
    const offsets: number[] = [];
    server.use(
      nhostGraphQLLink.query('dashboardSupportComments', ({ variables }) => {
        const offset = Number(variables.offset);
        offsets.push(offset);
        return HttpResponse.json({
          data: {
            supportComments: Array.from(
              { length: offset === 0 ? 51 : 1 },
              (_, index) => ({
                id: `reply-${offset + index}`,
                body: `Reply number ${offset + index}`,
                authorID: mockSession.user!.id,
                authorName: 'Customer Alice',
                authorRole: 'user',
                createdAt: '2026-01-02T12:00:00Z',
              }),
            ),
          },
        });
      }),
    );
    render(<TicketDetail />);
    await screen.findByText('Reply number 0');
    expect(screen.queryByText('Reply number 50')).not.toBeInTheDocument();
    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Load earlier replies' }),
    );
    expect(await screen.findByText('Reply number 50')).toBeInTheDocument();
    expect(screen.getAllByText('Reply number 49')).toHaveLength(1);
    expect(offsets).toEqual([0, 50]);
  });
  it('uses the ticket organization’s current plan for agent severity options', async () => {
    makeAgent();
    ticket.organization!.plan.supportAllowedSeverities = ['low'];
    const user = new TestUserEvent();
    render(<TicketDetail />);
    await screen.findByRole('heading', { name: ticket.title });
    expect(
      screen.getByRole('combobox', { name: 'Change ticket severity' }),
    ).toHaveTextContent('Normal');
    await user.click(
      screen.getByRole('combobox', { name: 'Change ticket severity' }),
    );
    for (const name of ['Normal', 'High', 'Urgent']) {
      expect(screen.getByRole('option', { name })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    }
    await user.click(screen.getByRole('option', { name: 'Low' }));
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'update'),
      ).toMatchObject({
        role: 'support_agent',
        variables: { id: ticketId, version: 1, changes: { severity: 'low' } },
      }),
    );
  });
  it('leaves status updates available when the plan allows no severity changes', async () => {
    makeAgent();
    ticket.organization!.plan.supportAllowedSeverities = [];
    const user = new TestUserEvent();
    render(<TicketDetail />);
    await screen.findByRole('heading', { name: ticket.title });
    expect(
      screen.getByText(/does not allow severity changes/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('combobox', { name: 'Change ticket severity' }),
    );
    for (const name of ['Low', 'Normal', 'High', 'Urgent']) {
      expect(screen.getByRole('option', { name })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    }
    await user.keyboard('{Escape}');
    await select(user, 'Change ticket status', 'Resolved');
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'update'),
      ).toMatchObject({ variables: { changes: { status: 'resolved' } } }),
    );
  });
  it('changes severity using the agent role and current ticket version', async () => {
    makeAgent();
    const user = new TestUserEvent();
    render(<TicketDetail />);
    await screen.findByRole('heading', { name: ticket.title });
    await select(user, 'Change ticket severity', 'High');
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'update'),
      ).toMatchObject({
        role: 'support_agent',
        variables: { id: ticketId, version: 1, changes: { severity: 'high' } },
      }),
    );
  });
  it('synchronizes search controls when browser navigation changes the URL', async () => {
    makeAgent();
    const view = render(<TicketList />);
    await screen.findByRole('link', { name: /Storage upload fails/ });
    mocks.useRouter.mockReturnValue({
      ...mockRouter,
      query: { q: 'Sign in', organization: 'Acme' },
      isReady: true,
      push,
      replace,
    });
    view.rerender(<TicketList />);
    await waitFor(() =>
      expectInputValue(
        screen.getByRole('textbox', { name: 'Search tickets' }),
        'Sign in',
      ),
    );
  });
  it('drops cached agent tickets immediately when the token loses the staff role', async () => {
    makeAgent();
    function RevokeRole() {
      const { session, updateSession } = useAuth();
      return (
        <button
          type="button"
          onClick={() =>
            updateSession({ ...session!, decodedToken: originalClaims })
          }
        >
          Revoke role
        </button>
      );
    }
    render(
      <>
        <RevokeRole />
        <TicketList />
      </>,
    );
    expect(await screen.findByText('Agent')).toBeInTheDocument();
    await screen.findByRole('link', { name: /Storage upload fails/ });
    server.use(
      nhostGraphQLLink.query('dashboardSupportTickets', () =>
        HttpResponse.json({ data: { supportTickets: [] } }),
      ),
    );
    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Revoke role' }),
    );
    expect(await screen.findByText('No tickets yet')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Storage upload fails/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Agent')).not.toBeInTheDocument();
  });
});
