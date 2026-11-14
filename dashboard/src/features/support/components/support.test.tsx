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
import { mockMatchMediaValue, mockRouter, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
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
              authorRole: 'support_agents',
              createdAt: '2026-01-02T12:00:00Z',
            },
          ],
        },
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
              apps: [{ id: projectID, name: 'Production' }],
            },
            { id: otherOrganizationID, name: 'Other org', apps: [] },
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
  mockSession.accessToken = sessionToken(['user', 'support_agents']);
  mockSession.decodedToken = {
    ...originalClaims,
    'https://hasura.io/jwt/claims': {
      'x-hasura-allowed-roles': ['user', 'support_agents'],
    },
  };
}
async function select(user: TestUserEvent, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}
async function fillTicket(user: TestUserEvent) {
  await screen.findByRole('heading', { name: 'Create a support ticket' });
  await select(user, 'Organization', 'Acme');
  await user.click(screen.getByRole('checkbox', { name: 'Storage' }));
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
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  toast.remove();
  mockSession.accessToken = sessionToken(['user']);
  queryClient.clear();
  ticket = structuredClone(initialTicket);
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
  mockSession.accessToken = originalToken;
  server.resetHandlers();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockSession.decodedToken = structuredClone(originalClaims);
  queryClient.clear();
});
afterAll(() => server.close());

describe('native dashboard support', () => {
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
    expect(screen.getByRole('link', { name: 'New ticket' })).toHaveAttribute(
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
  it('exposes global agent queues only for the native support_agents role', async () => {
    makeAgent();
    mocks.useRouter.mockReturnValue({
      ...mockRouter,
      query: { queue: 'mine', page: '2' },
      isReady: true,
      push,
      replace,
    });
    render(<TicketList />);
    expect(await screen.findByText('Agent workspace')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: /Storage upload fails/ }),
    ).toBeInTheDocument();
    expect(requests[0]).toMatchObject({
      role: 'support_agents',
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
      screen.getByRole('button', { name: 'Unassigned' }),
    );
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ queue: 'unassigned', page: 0 }),
      }),
      undefined,
      { shallow: true },
    );
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
    expect(screen.queryByText('No tickets found')).not.toBeInTheDocument();
  });
  it('supports an empty customer queue', async () => {
    server.use(
      nhostGraphQLLink.query('dashboardSupportTickets', () =>
        HttpResponse.json({ data: { supportTickets: [] } }),
      ),
    );
    render(<TicketList />);
    expect(await screen.findByText('No tickets found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
  it('creates an organization-wide ticket without requester or attribution fields', async () => {
    makeAgent();
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/support/tickets/${ticketId}`),
    );
    expect(requests.find((request) => request.operation === 'create')).toEqual({
      operation: 'create',
      role: 'user',
      variables: {
        input: {
          organizationID,
          projectID: null,
          title: 'Uploads fail',
          description: 'Steps to reproduce',
          services: ['storage'],
          severity: 'normal',
        },
      },
    });
    expect(
      requests.find((request) => request.operation === 'organizations')?.role,
    ).toBe('user');
  });
  it('resets a selected project when the organization changes', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillTicket(user);
    await select(user, 'Project', 'Production');
    await select(user, 'Organization', 'Other org');
    expect(screen.getByRole('combobox', { name: 'Project' })).toHaveTextContent(
      'Organization-wide / No project',
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
    render(<NewTicket />);
    await screen.findByRole('heading', { name: 'Create a support ticket' });
    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Create ticket' }),
    );
    expect(await screen.findByText('Add a title')).toBeInTheDocument();
    expect(
      screen.getByText('Select at least one affected service'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.operation === 'create')).toBe(
      false,
    );
  });
  it('renders conversations and activity as safe text without customer ticket-management controls', async () => {
    render(<TicketDetail />);
    expect(
      await screen.findByRole('heading', { name: 'Storage upload fails' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('We are investigating.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/<script>not executed<\/script>/),
    ).toBeInTheDocument();
    expect(document.querySelector('article script')).toBeNull();
    expect(
      await screen.findByRole('region', { name: 'Ticket activity' }),
    ).toHaveTextContent('Customer Alice');
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
    await waitFor(() => expect(reply).toHaveValue(''));
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
    expect(reply).toHaveValue('Keep this draft');
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
        role: 'support_agents',
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
        role: 'support_agents',
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
            role: 'support_agents',
          }),
          expect.objectContaining({
            operation: 'comments',
            role: 'support_agents',
          }),
          expect.objectContaining({
            operation: 'events',
            role: 'support_agents',
          }),
        ]),
      );
    });
    await select(user, 'Change ticket status', 'Resolved');
    await waitFor(() =>
      expect(
        requests.find((request) => request.operation === 'update'),
      ).toMatchObject({
        role: 'support_agents',
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
        role: 'support_agents',
        variables: { id: ticketId, version: 1, changes: { severity: 'high' } },
      }),
    );
  });
  it('synchronizes search controls when browser navigation changes the URL', async () => {
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
      expect(
        screen.getByRole('textbox', { name: 'Search tickets' }),
      ).toHaveValue('Sign in'),
    );
    expect(
      screen.getByRole('textbox', { name: 'Filter by organization' }),
    ).toHaveValue('Acme');
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
    expect(await screen.findByText('Agent workspace')).toBeInTheDocument();
    await screen.findByRole('link', { name: /Storage upload fails/ });
    server.use(
      nhostGraphQLLink.query('dashboardSupportTickets', () =>
        HttpResponse.json({ data: { supportTickets: [] } }),
      ),
    );
    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Revoke role' }),
    );
    expect(await screen.findByText('No tickets found')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Storage upload fails/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Agent workspace')).not.toBeInTheDocument();
  });
});
