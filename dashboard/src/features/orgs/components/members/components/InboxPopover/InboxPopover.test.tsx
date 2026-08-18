import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import {
  CheckoutStatus,
  Organization_Members_Role_Enum,
  type OrganizationMemberInvitesQuery,
} from '@/generated/graphql';
import { mockMatchMediaValue, mockRouter } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  act,
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import InboxPopover from './InboxPopover';

vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => vi.fn(),
}));

vi.mock('@stripe/stripe-js/pure', () => ({
  loadStripe: Object.assign(
    vi.fn(() => Promise.resolve(null)),
    {
      setLoadParameters: vi.fn(),
    },
  ),
}));

const server = setupServer();
const invite: OrganizationMemberInvitesQuery['organizationMemberInvites'][number] =
  {
    id: 'invite-1',
    email: 'invited@example.com',
    role: Organization_Members_Role_Enum.User,
    createdAt: '2026-01-01T00:00:00.000Z',
    updateAt: '2026-01-01T00:00:00.000Z',
    organization: {
      name: 'Invited organization',
      slug: 'invited-org',
    },
  };

mockPointerEvent();

function mockPendingRequest() {
  const postCalled = vi.fn();
  server.use(
    nhostGraphQLLink.query('organizationNewRequests', () =>
      HttpResponse.json({
        data: {
          organizationNewRequests: [
            {
              id: 'request-1',
              sessionID: 'session-1',
              __typename: 'organization_new_request',
            },
          ],
        },
      }),
    ),
    nhostGraphQLLink.mutation('postOrganizationRequest', () => {
      postCalled();
      return HttpResponse.json({
        data: {
          billingPostOrganizationRequest: {
            Status: CheckoutStatus.Open,
            Slug: 'my-org',
            ClientSecret: 'secret-1',
            __typename: 'PostOrganizationRequestResponse',
          },
        },
      });
    }),
  );
  return postCalled;
}

describe('InboxPopover', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
    vi.mocked(mockRouter.push).mockReset().mockResolvedValue(true);
    server.resetHandlers(
      nhostGraphQLLink.query('organizationMemberInvites', () =>
        HttpResponse.json({ data: { organizationMemberInvites: [] } }),
      ),
      nhostGraphQLLink.query('getAnnouncements', () =>
        HttpResponse.json({ data: { announcements: [] } }),
      ),
      nhostGraphQLLink.query('organizationNewRequests', () =>
        HttpResponse.json({ data: { organizationNewRequests: [] } }),
      ),
      nhostGraphQLLink.query('getOrganizations', () =>
        HttpResponse.json({ data: { organizations: [] } }),
      ),
    );
  });

  afterEach(() => {
    act(() => toast.remove());
  });

  afterAll(() => {
    server.close();
  });

  it('does not post the pending organization request again when the inbox opens', async () => {
    const user = new TestUserEvent();
    const postCalled = mockPendingRequest();

    render(<InboxPopover />);

    await waitFor(() => {
      expect(postCalled).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Inbox' }));

    expect(
      await screen.findByText(
        'You have previously tried to upgrade or create a new organization',
      ),
    ).toBeInTheDocument();
    expect(postCalled).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    'closes the inbox after accepting an invite only if navigation succeeds (%s)',
    async (navigated) => {
      const user = new TestUserEvent();
      const navigation = Promise.withResolvers<boolean>();
      vi.mocked(mockRouter.push).mockReturnValue(navigation.promise);
      let accepted = false;
      server.use(
        nhostGraphQLLink.query('organizationMemberInvites', () =>
          HttpResponse.json({
            data: { organizationMemberInvites: accepted ? [] : [invite] },
          }),
        ),
        nhostGraphQLLink.mutation('organizationMemberInviteAccept', () => {
          accepted = true;
          return HttpResponse.json({
            data: {
              organizationMemberInviteAccept: [
                { __typename: 'organization_members' },
              ],
            },
          });
        }),
      );

      render(<InboxPopover />);

      const inboxTrigger = screen.getByRole('button', { name: 'Inbox' });
      await user.click(inboxTrigger);
      await user.click(await screen.findByRole('button', { name: 'Accept' }));

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          '/orgs/invited-org/projects',
        );
      });
      expect(
        screen.getByRole('button', { name: 'Close inbox' }),
      ).toBeInTheDocument();

      await act(async () => navigation.resolve(navigated));

      await waitFor(() => {
        expect(inboxTrigger).toHaveAttribute(
          'aria-expanded',
          String(!navigated),
        );
      });
      if (navigated) {
        expect(
          screen.queryByRole('button', { name: 'Close inbox', hidden: true }),
        ).not.toBeInTheDocument();
      }
    },
  );

  it('keeps the inbox open and shows an error if accepting an invite fails', async () => {
    const user = new TestUserEvent();
    server.use(
      nhostGraphQLLink.query('organizationMemberInvites', () =>
        HttpResponse.json({ data: { organizationMemberInvites: [invite] } }),
      ),
      nhostGraphQLLink.mutation('organizationMemberInviteAccept', () =>
        HttpResponse.json({
          errors: [{ message: 'Could not accept invitation' }],
        }),
      ),
    );

    render(<InboxPopover />);

    await user.click(screen.getByRole('button', { name: 'Inbox' }));
    await user.click(await screen.findByRole('button', { name: 'Accept' }));

    expect(
      await screen.findByText('Could not accept invitation'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close inbox' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('closes the inbox while checkout stays open and restores focus when checkout closes', async () => {
    const user = new TestUserEvent();
    const postCalled = mockPendingRequest();

    render(<InboxPopover />);

    const inboxTrigger = screen.getByRole('button', { name: 'Inbox' });
    await user.click(inboxTrigger);
    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    const checkout = await screen.findByRole('dialog', {
      name: 'Create Organization Checkout Form',
    });
    expect(inboxTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: 'Close inbox', hidden: true }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(checkout.contains(document.activeElement)).toBe(true);
    });

    await user.keyboard('{Escape}');
    expect(checkout).toBeInTheDocument();
    await user.click(within(checkout).getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(checkout).not.toBeInTheDocument();
      expect(inboxTrigger).toHaveFocus();
    });
    expect(inboxTrigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(inboxTrigger);
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByRole('dialog', {
        name: 'Create Organization Checkout Form',
      }),
    ).toBeInTheDocument();
    expect(postCalled).toHaveBeenCalledTimes(1);
  });
});
