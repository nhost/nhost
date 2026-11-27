import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import NewTicket from '@/features/support/components/NewTicket';
import { SupportArea } from '@/features/support/components/SupportArea';
import TicketDetail from '@/features/support/components/TicketDetail';
import TicketList from '@/features/support/components/TicketList';
import {
  type DashboardSupportEventsQuery,
  type DashboardSupportTicketQuery,
  SupportSeverities_Enum,
  SupportTicketEventKinds_Enum,
  SupportTicketStatuses_Enum,
} from '@/generated/graphql';
import { useAuth } from '@/providers/Auth';
import {
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
  mockSession,
} from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { expectInputValue } from '@/tests/supportEditor';
import {
  act,
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({ useRouter: vi.fn() }));
vi.mock('next/router', () => ({ useRouter: mocks.useRouter }));
interface SubscriptionOptions {
  document: { definitions: { name?: { value: string } }[] };
  variables: Record<string, unknown>;
  enabled?: boolean;
  onData: (data: unknown) => void;
  onReconnect?: VoidFunction;
}
const subscriptions = vi.hoisted(() => new Map<string, SubscriptionOptions>());
vi.mock('@/features/support/hooks/useSupportSubscription', () => ({
  useSupportSubscription: (options: SubscriptionOptions) => {
    const name = options.document.definitions[0]?.name?.value;
    if (name && options.enabled !== false) {
      subscriptions.set(name, options);
    }
  },
}));
function emit(name: string, data: unknown) {
  act(() => subscriptions.get(name)!.onData(data));
}

const ticketId = '7d442aba-6e61-4854-b354-0d5ec8d198d8';
const organizationID = '0d9c1e17-4983-4d38-b793-1be03368bec1';
const otherOrganizationID = '28ba74e2-b51a-4875-8913-9339a6da5026';
const projectID = '250375e1-2ac2-48ed-8ac8-eb5f30a7f01a';
const originalClaims = structuredClone(mockSession.decodedToken);
const originalToken = mockSession.accessToken;
function sessionToken(roles: string[], expiresIn = 3600) {
  return `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: mockSession.user!.id, exp: Math.floor(Date.now() / 1000) + expiresIn, 'https://hasura.io/jwt/claims': { 'x-hasura-user-id': mockSession.user!.id, 'x-hasura-default-role': 'user', 'x-hasura-allowed-roles': roles } }))}.test-signature`;
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
const allSeverities = ['low', 'normal', 'high', 'urgent'];
const initialPlans = [
  { id: 'plan-starter', name: 'Starter', supportAllowedSeverities: [] },
  { id: 'plan-pro', name: 'Pro', supportAllowedSeverities: ['low'] },
  { id: 'plan-team', name: 'Team', supportAllowedSeverities: allSeverities },
  {
    id: 'plan-enterprise',
    name: 'Enterprise',
    supportAllowedSeverities: allSeverities,
  },
];
let supportPlans = structuredClone(initialPlans);
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
              authorRole: 'support',
              createdAt: '2026-01-02T12:00:00Z',
            },
          ],
        },
      });
    },
  ),
  nhostGraphQLLink.query(
    'dashboardSupportAttachments',
    ({ request, variables }) => {
      requests.push({
        operation: 'attachments',
        role: request.headers.get('x-hasura-role'),
        variables,
      });
      return HttpResponse.json({
        data: { supportTicket: { attachments: [] } },
      });
    },
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
                      isFree: false,
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
                isFree: true,
                supportAllowedSeverities: otherOrganizationSeverities,
              },
              apps: [],
            },
          ],
          plans: supportPlans,
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
  mockSession.accessToken = sessionToken(['user', 'support']);
  mockSession.decodedToken = {
    ...originalClaims,
    'https://hasura.io/jwt/claims': {
      'x-hasura-allowed-roles': ['user', 'support'],
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
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  toast.remove();
  mockSession.accessToken = sessionToken(['user']);
  queryClient.clear();
  ticket = structuredClone(initialTicket);
  organizationSeverities = ['low', 'normal', 'high', 'urgent'];
  otherOrganizationSeverities = ['low'];
  supportPlans = structuredClone(initialPlans);
  event = structuredClone(initialEvent);
  requests = [];
  subscriptions.clear();
  mockSession.decodedToken = structuredClone(originalClaims);
  mockScrollIntoViewAndPointerCapture();
  mocks.useRouter.mockReturnValue({
    ...mockRouter,
    query: { ticketId },
    isReady: true,
    push,
    replace,
  });
  vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
});
afterEach(() => {
  toast.remove();
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
  expect(heading).toBeVisible();
  expect(heading).not.toHaveClass('sr-only');
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

describe('native dashboard support', () => {
  it.each([
    { page: 'new', current: 'New ticket' },
    { page: 'ticket', current: initialTicket.title },
  ])('shows the breadcrumb on the $page page', async ({ page, current }) => {
    render(page === 'new' ? <NewTicket /> : <TicketDetail />);
    if (page === 'ticket') {
      await screen.findByRole('heading', { name: initialTicket.title });
    } else if (page === 'new') {
      await screen.findByRole('heading', { name: 'New ticket' });
    }
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(
      within(nav).queryByRole('link', { name: 'Home' }),
    ).not.toBeInTheDocument();
    expect(
      within(nav)
        .getAllByRole('listitem')
        .filter((item) => item.getAttribute('aria-hidden') !== 'true'),
    ).toHaveLength(3);
    expect(
      within(nav).getByRole('link', { name: 'All tickets' }),
    ).toHaveAttribute('href', '/support/tickets');
    const last = within(nav).getByText(current);
    expect(last).toHaveAttribute('aria-current', 'page');
    expect(last.tagName).toBe('LI');
    expect(within(nav).getByRole('link', { name: 'Support' })).toHaveAttribute(
      'href',
      '/support',
    );
    expect(screen.queryByText('← Support')).not.toBeInTheDocument();
  });

  it('shows the breadcrumb on the ticket queue', async () => {
    render(<TicketList />);
    await screen.findByRole('link', { name: /Storage upload fails/ });
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(
      within(nav)
        .getAllByRole('listitem')
        .filter((item) => item.getAttribute('aria-hidden') !== 'true'),
    ).toHaveLength(2);
    expect(within(nav).getByRole('link', { name: 'Support' })).toHaveAttribute(
      'href',
      '/support',
    );
    expect(
      within(nav).queryByRole('link', { name: 'All tickets' }),
    ).not.toBeInTheDocument();
    expect(within(nav).getByText('All tickets')).toHaveAttribute(
      'aria-current',
      'page',
    );
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
        screen.getByRole('combobox', { name: 'Search tickets' }),
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
        expect(loading.closest('.min-h-28')).toBeInTheDocument();
        expect(
          screen.queryAllByRole('link', { name: 'Create ticket' }),
        ).toHaveLength(agent ? 1 : 0);
        expect(
          screen.getByRole('combobox', { name: 'Search tickets' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Status' }),
        ).toBeInTheDocument();
        expectHelpFooter(false);
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
    expect(
      screen.getByRole('combobox', { name: 'Search tickets' }),
    ).toHaveValue('Missing');
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
          screen.getByRole('combobox', { name: 'Search tickets' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Status' }),
        ).toBeInTheDocument();
        if (agent) {
          expect(
            screen.getByRole('checkbox', { name: 'Assigned to me' }),
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
      screen.getByRole('combobox', { name: 'Search tickets' }),
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
      screen.queryByRole('checkbox', { name: 'Assigned to me' }),
    ).not.toBeInTheDocument();
    expect(requests[0]).toMatchObject({
      operation: 'list',
      role: 'user',
      variables: { offset: 0 },
    });
  });
  it('exposes global agent queues only for the native support role', async () => {
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
      role: 'support',
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
      screen.getByRole('checkbox', { name: 'Assigned to me', checked: true }),
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
    mockSession.accessToken = sessionToken(['user', 'supports']);
    mockSession.decodedToken = {
      ...originalClaims,
      'https://hasura.io/jwt/claims': {
        'x-hasura-allowed-roles': ['user', 'supports'],
      },
    };
    render(<TicketList />);
    await screen.findByRole('link', { name: /Storage upload fails/ });
    expect(screen.queryByText('Agent')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Assigned to me' }),
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
      screen.queryByText(/Your Pro plan includes Low\./, {
        ignore: 'script, style, [hidden]',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'See plans' }),
    ).not.toBeInTheDocument();
    const help = screen.getByRole('button', {
      name: 'Normal plan availability',
    });
    expect(help).toHaveAccessibleDescription(
      'Normal. Your Pro plan includes Low. Available with Team and Enterprise.',
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

  it('opens billing in a new tab to upgrade a Starter organization', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await screen.findByRole('heading', { name: 'New ticket' });
    await select(user, 'Organization', 'Other org');
    await user.pointer({
      target: await screen.findByRole('button', {
        name: 'Normal plan availability',
      }),
    });
    const link = within(
      await screen.findByRole('dialog', { name: 'Normal plan availability' }),
    ).getByRole('link', { name: /See plans/ });
    expect(link).toHaveAccessibleName(/opens in a new tab/);
    expect(link).toHaveAttribute(
      'href',
      '/orgs/other-org/billing?openUpgradeModal=true',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
  it('refreshes plan entitlements when the in-place upgrade dialog closes', async () => {
    organizationSeverities = ['low'];
    server.use(
      nhostGraphQLLink.query('getOrganization', () =>
        HttpResponse.json({
          data: {
            organizations: [
              { ...mockOrganization, name: 'Acme', slug: 'acme' },
            ],
          },
        }),
      ),
      nhostGraphQLLink.query('getOrganizationPlans', () =>
        HttpResponse.json({ data: { plans: [] } }),
      ),
    );
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeDisabled();
    await user.pointer({
      target: screen.getByRole('button', { name: 'Normal plan availability' }),
    });
    await user.click(
      within(
        await screen.findByRole('dialog', { name: 'Normal plan availability' }),
      ).getByRole('link', { name: 'See plans' }),
    );
    const upgrade = await screen.findByRole('dialog', {
      name: 'Upgrade Organization Acme',
    });
    organizationSeverities = ['low', 'normal', 'high', 'urgent'];
    await user.click(within(upgrade).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Normal' })).toBeEnabled(),
    );
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

  it('names only the plans whose entitlements include a locked severity', async () => {
    organizationSeverities = ['normal', 'high'];
    supportPlans = [
      { id: 'plan-pro', name: 'Pro', supportAllowedSeverities: ['low'] },
      {
        id: 'plan-team',
        name: 'Team',
        supportAllowedSeverities: ['low', 'normal', 'high'],
      },
      {
        id: 'plan-enterprise',
        name: 'Enterprise',
        supportAllowedSeverities: allSeverities,
      },
    ];
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    const card = (name: string) =>
      within(screen.getByRole('radio', { name }).closest('label')!);
    expect(card('Low').getByText('Pro')).toBeInTheDocument();
    expect(card('Urgent').getByText('Enterprise')).toBeInTheDocument();
    const help = screen.getByRole('button', {
      name: 'Urgent plan availability',
    });
    expect(help).toHaveAccessibleDescription(
      'Urgent. Your Pro plan includes Normal and High. Available with Enterprise.',
    );
    await user.pointer({ target: help });
    const popup = await screen.findByRole('dialog', {
      name: 'Urgent plan availability',
    });
    expect(
      within(popup).getByText(/Your Pro plan includes Normal and High\./),
    ).toBeInTheDocument();
    expect(within(popup).getByText('Enterprise')).toBeInTheDocument();
    expect(within(popup).queryByText('Team')).not.toBeInTheDocument();
    expect(
      within(popup).getByRole('link', { name: 'See plans' }),
    ).toBeInTheDocument();
  });

  it('says when no plan includes a severity and offers no upgrade', async () => {
    organizationSeverities = ['low'];
    supportPlans = initialPlans.map((plan) => ({
      ...plan,
      supportAllowedSeverities: ['low'],
    }));
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    for (const name of ['Team', 'Enterprise', 'Pro']) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
    const help = screen.getByRole('button', {
      name: 'Normal plan availability',
    });
    expect(help).toHaveAccessibleDescription(
      'Normal. Your Pro plan includes Low. Not included in any plan.',
    );
    await user.pointer({ target: help });
    const popup = await screen.findByRole('dialog', {
      name: 'Normal plan availability',
    });
    expect(
      within(popup).getByText(/Normal isn't included in any plan\./),
    ).toBeInTheDocument();
    expect(within(popup).queryByRole('link')).not.toBeInTheDocument();
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
    const editor = screen.getByRole('group', { name: 'Description editor' });
    expect(editor).not.toHaveClass('border-red-500');
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    expect(await screen.findByText('Add a title')).toBeInTheDocument();
    expect(screen.getByText('Pick at least one service')).toBeInTheDocument();
    expect(screen.getByText('Describe the issue')).toBeInTheDocument();
    expect(editor).toHaveClass('border-red-500');
    expect(
      screen.getByRole('textbox', { name: 'Description' }),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(requests.some((request) => request.operation === 'create')).toBe(
      false,
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Steps to reproduce',
    );
    await waitFor(() => expect(editor).not.toHaveClass('border-red-500'));
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
  it('renders tickets whose services are built-in object property names', async () => {
    ticket.services = ['constructor', '__proto__', 'valueOf', 'hasOwnProperty'];
    render(<TicketDetail />);
    expect(
      await screen.findByRole('heading', { name: ticket.title }),
    ).toBeInTheDocument();
    expect(screen.getByText('Constructor')).toBeInTheDocument();
    expect(screen.getByText('ValueOf')).toBeInTheDocument();
    expect(screen.getByText('HasOwnProperty')).toBeInTheDocument();
  });
  it('keeps the conversation without tabs when the only event is creation', async () => {
    makeAgent();
    render(<TicketDetail />);
    await screen.findByRole('region', { name: 'Conversation' });
    await waitFor(() =>
      expect(requests.some(({ operation }) => operation === 'events')).toBe(
        true,
      ),
    );
    expect(
      screen.queryByRole('tablist', { name: 'Ticket view' }),
    ).not.toBeInTheDocument();
  });
  it.each([
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
      const tab = await screen.findByRole('tab', { name: 'Activity · 1' });
      await new TestUserEvent().click(tab);
      const activity = screen.getByRole('region', { name: 'Ticket activity' });
      expect(
        within(activity).getByRole('row', {
          name: new RegExp(`Customer Alice.*${label}`),
        }),
      ).toBeInTheDocument();
      expect(
        within(activity).queryByText(/Showing the latest/),
      ).not.toBeInTheDocument();
    },
  );
  it('notes when the activity list is cut at the event limit', async () => {
    makeAgent();
    server.use(
      nhostGraphQLLink.query('dashboardSupportEvents', () =>
        HttpResponse.json<{ data: DashboardSupportEventsQuery }>({
          data: {
            supportTicketEvents: Array.from({ length: 100 }, (_, index) => ({
              ...initialEvent,
              id: `event-${index}`,
              kind: SupportTicketEventKinds_Enum.StatusChanged,
            })),
          },
        }),
      ),
    );
    render(<TicketDetail />);
    await new TestUserEvent().click(
      await screen.findByRole('tab', { name: 'Activity · 100' }),
    );
    expect(
      within(screen.getByRole('region', { name: 'Ticket activity' })).getByText(
        'Showing the latest 100 events.',
      ),
    ).toBeInTheDocument();
  });
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
                authorRole: 'support',
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
  it('keeps an unsent reply while a ticket refresh fails', async () => {
    const user = new TestUserEvent();
    render(<TicketDetail />);
    const reply = await screen.findByRole('textbox', { name: 'Your reply' });
    await user.type(reply, 'Keep this draft');
    server.use(
      nhostGraphQLLink.query('dashboardSupportTicket', () =>
        HttpResponse.json({ errors: [{ message: 'Gateway timeout' }] }),
      ),
    );
    await queryClient.invalidateQueries({ queryKey: ['support'] });
    expect(
      await screen.findByText(
        'Unable to load this ticket. Your access may have changed.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: ticket.title }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Your reply' }),
    ).not.toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('textbox', { name: 'Your reply' })).toBe(
      reply,
    );
    expectInputValue(reply, 'Keep this draft');
  });
  it('shows the reply placeholder while the editor is empty', async () => {
    render(<TicketDetail />);
    const reply = await screen.findByRole('textbox', { name: 'Your reply' });
    expect(reply).toHaveAttribute('aria-placeholder', 'Write a reply…');
    expect(within(reply).getByText('Write a reply…')).toBeInTheDocument();
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
        role: 'support',
        variables: {
          id: ticketId,
          version: 1,
          changes: { assigneeID: mockSession.user!.id },
        },
      }),
    );
  });
  it('asks for confirmation before marking a ticket as resolved', async () => {
    makeAgent();
    const user = new TestUserEvent();
    render(<TicketDetail />);
    await user.click(
      await screen.findByRole('button', { name: 'Mark as resolved' }),
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(requests.some(({ operation }) => operation === 'update')).toBe(
      false,
    );
    await user.click(screen.getByRole('button', { name: 'Mark as resolved' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Mark as resolved',
      }),
    );
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'update'),
      ).toMatchObject({
        role: 'support',
        variables: {
          id: ticketId,
          version: 1,
          changes: { status: 'resolved' },
        },
      }),
    );
  });
  it('unassigns a ticket with the agent role', async () => {
    makeAgent();
    ticket.assigneeID = 'agent-id';
    ticket.assigneeName = 'Support Bob';
    render(<TicketDetail />);
    await new TestUserEvent().click(
      await screen.findByRole('button', { name: 'Unassign' }),
    );
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'update'),
      ).toMatchObject({
        role: 'support',
        variables: {
          id: ticketId,
          version: 1,
          changes: { assigneeID: null },
        },
      }),
    );
  });
  it('does not offer unassigning to customers', async () => {
    ticket.assigneeID = 'agent-id';
    ticket.assigneeName = 'Support Bob';
    render(<TicketDetail />);
    await screen.findByRole('heading', { name: ticket.title });
    expect(
      screen.queryByRole('button', { name: 'Unassign' }),
    ).not.toBeInTheDocument();
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
        role: 'support',
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
            role: 'support',
          }),
          expect.objectContaining({
            operation: 'comments',
            role: 'support',
          }),
          expect.objectContaining({
            operation: 'events',
            role: 'support',
          }),
        ]),
      );
    });
    await select(user, 'Change ticket status', 'Resolved');
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'update'),
      ).toMatchObject({
        role: 'support',
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
  it('keeps working when a request refreshes an expiring session', async () => {
    makeAgent();
    // Expires inside the 60-second refresh margin, so the next request refreshes.
    mockSession.accessToken = sessionToken(['user', 'support'], 30);
    const { decodedToken: _, ...refreshed } = mockSession;
    server.use(
      http.post('https://local.auth.local.nhost.run/v1/token', () =>
        // Like the real endpoint, the refreshed session has no decodedToken.
        HttpResponse.json({
          ...refreshed,
          accessToken: sessionToken(['user', 'support']),
        }),
      ),
    );
    render(<TicketDetail />);
    expect(
      await screen.findByRole('heading', { name: ticket.title }),
    ).toBeInTheDocument();
    expect(
      requests.find((request) => request.operation === 'detail'),
    ).toMatchObject({ role: 'support' });
  });
  describe('live updates', () => {
    function count(operation: string) {
      return requests.filter((request) => request.operation === operation)
        .length;
    }
    function ticketSignal(changes: Record<string, unknown> = {}) {
      return {
        supportTicket: {
          id: ticketId,
          updatedAt: ticket.updatedAt,
          attachments: [],
          ...changes,
        },
      };
    }
    async function openTicket() {
      render(<TicketDetail />);
      await screen.findByRole('heading', { name: ticket.title });
      await waitFor(() => {
        expect(count('comments')).toBe(1);
        expect(count('attachments')).toBe(1);
        expect(subscriptions.has('dashboardSupportTicketChanges')).toBe(true);
      });
      expect(
        subscriptions.get('dashboardSupportTicketChanges')!.variables,
      ).toEqual({ id: ticketId });
    }

    it('refetches the ticket, replies and activity only when the ticket changed', async () => {
      makeAgent();
      await openTicket();
      await waitFor(() => expect(count('events')).toBe(1));
      emit('dashboardSupportTicketChanges', ticketSignal());
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect([count('detail'), count('comments'), count('events')]).toEqual([
        1, 1, 1,
      ]);

      ticket.updatedAt = '2026-01-03T12:00:00Z';
      emit(
        'dashboardSupportTicketChanges',
        ticketSignal({ updatedAt: ticket.updatedAt }),
      );
      await waitFor(() =>
        expect([count('detail'), count('comments'), count('events')]).toEqual([
          2, 2, 2,
        ]),
      );
      expect(count('attachments')).toBe(1);
    });

    it('refetches the attachment list when a file is added elsewhere', async () => {
      await openTicket();
      emit(
        'dashboardSupportTicketChanges',
        ticketSignal({ attachments: [{ id: 'new-file' }] }),
      );
      await waitFor(() => expect(count('attachments')).toBe(2));
      expect(count('detail')).toBe(1);
    });

    it('hides a ticket the viewer can no longer access', async () => {
      await openTicket();
      server.use(
        nhostGraphQLLink.query('dashboardSupportTicket', () =>
          HttpResponse.json({
            data: { supportTicket: null, supportTicketTransitions: [] },
          }),
        ),
      );
      emit('dashboardSupportTicketChanges', { supportTicket: null });
      expect(
        await screen.findByRole('heading', { name: 'Ticket not found' }),
      ).toBeInTheDocument();
    });

    it('refreshes everything after reconnecting', async () => {
      await openTicket();
      act(() =>
        subscriptions.get('dashboardSupportTicketChanges')!.onReconnect?.(),
      );
      await waitFor(() => {
        expect(count('detail')).toBe(2);
        expect(count('comments')).toBe(2);
      });
    });

    it('refetches the queue when its tickets change', async () => {
      render(<TicketList />);
      await waitFor(() => {
        expect(count('list')).toBeGreaterThan(0);
        expect(subscriptions.has('dashboardSupportQueueChanges')).toBe(true);
      });
      const listed = requests.filter(({ operation }) => operation === 'list');
      expect(
        subscriptions.get('dashboardSupportQueueChanges')!.variables,
      ).toEqual({ where: listed.at(-1)!.variables.where });
      const before = count('list');
      emit('dashboardSupportQueueChanges', {
        supportTicketsAggregate: {
          aggregate: { count: 1, max: { updatedAt: ticket.updatedAt } },
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(count('list')).toBe(before);
      emit('dashboardSupportQueueChanges', {
        supportTicketsAggregate: {
          aggregate: { count: 2, max: { updatedAt: '2026-01-03T12:00:00Z' } },
        },
      });
      await waitFor(() => expect(count('list')).toBeGreaterThan(before));
    });
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
        role: 'support',
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
        role: 'support',
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
        screen.getByRole('combobox', { name: 'Search tickets' }),
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
