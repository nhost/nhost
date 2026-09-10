import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import InboxPopover from '@/features/orgs/components/members/components/InboxPopover/InboxPopover';
import { CheckoutStatus } from '@/generated/graphql';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const server = setupServer();

mockPointerEvent();

describe('InboxPopover', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers(
      nhostGraphQLLink.query('organizationMemberInvites', () =>
        HttpResponse.json({ data: { organizationMemberInvites: [] } }),
      ),
      nhostGraphQLLink.query('getAnnouncements', () =>
        HttpResponse.json({ data: { announcements: [] } }),
      ),
    );
  });

  afterAll(() => {
    server.close();
  });

  it('does not post the pending organization request again when the inbox opens', async () => {
    const user = new TestUserEvent();
    let postOrganizationRequestCalls = 0;

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
        postOrganizationRequestCalls += 1;

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

    render(<InboxPopover />);

    await waitFor(() => {
      expect(postOrganizationRequestCalls).toBe(1);
    });

    await user.click(screen.getByRole('button', { name: 'Inbox' }));

    expect(
      await screen.findByText(
        'You have previously tried to upgrade or create a new organization',
      ),
    ).toBeInTheDocument();
    expect(postOrganizationRequestCalls).toBe(1);
  });
});
