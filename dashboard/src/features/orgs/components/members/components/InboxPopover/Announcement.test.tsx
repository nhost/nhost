import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import {
  type GetAnnouncementsQuery,
  useGetAnnouncementsQuery,
} from '@/generated/graphql';
import { mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  act,
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import Announcement from './Announcement';

const announcement: GetAnnouncementsQuery['announcements'][number] = {
  id: 'announcement-1',
  href: 'https://example.com/announcement',
  content: 'Important announcement',
  createdAt: '2026-01-01T00:00:00.000Z',
  read: [],
};

const server = setupServer();

mockPointerEvent();

function AnnouncementFromQuery() {
  const { data } = useGetAnnouncementsQuery({ fetchPolicy: 'cache-first' });
  const item = data?.announcements.at(0);

  return item ? <Announcement announcement={item} /> : null;
}

async function performAction(
  action: 'open' | 'read' | 'unread',
  user: TestUserEvent,
) {
  if (action === 'open') {
    await user.click(
      screen.getByRole('link', { name: /important announcement/i }),
    );
    return;
  }

  await user.click(
    screen.getByRole('button', { name: 'Open announcement actions' }),
  );
  await user.click(screen.getByRole('menuitem', { name: `Mark as ${action}` }));
}

describe('Announcement', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
    server.resetHandlers();
  });

  afterEach(() => {
    act(() => toast.remove());
  });

  afterAll(() => {
    server.close();
  });

  it('renders the actions menu outside the announcement link', () => {
    render(<Announcement announcement={announcement} />);

    const announcementLink = screen.getByRole('link', {
      name: /important announcement/i,
    });
    const actionsButton = screen.getByRole('button', {
      name: 'Open announcement actions',
    });

    expect(announcementLink.querySelector('button')).toBeNull();
    expect(actionsButton.closest('a')).toBeNull();
  });

  describe.each([
    { action: 'open', state: 'read', operation: 'insertAnnouncementRead' },
    { action: 'read', state: 'read', operation: 'insertAnnouncementRead' },
    { action: 'unread', state: 'unread', operation: 'deleteAnnouncementRead' },
  ] as const)('$action action', ({ action, state, operation }) => {
    it.each([
      'GraphQL',
      'network',
    ] as const)('shows an error toast on a %s failure', async (failure) => {
      const user = new TestUserEvent();
      const mutationCalled = vi.fn();
      server.use(
        nhostGraphQLLink.mutation(operation, ({ variables }) => {
          mutationCalled(variables);
          return failure === 'network'
            ? HttpResponse.error()
            : HttpResponse.json({
                errors: [{ message: 'Permission denied' }],
              });
        }),
      );

      render(
        <Announcement
          announcement={{
            ...announcement,
            read: state === 'unread' ? [{ id: 'read-1' }] : [],
          }}
        />,
      );

      await performAction(action, user);

      expect(
        await screen.findByText(
          `Failed to mark announcement as ${state}. Please try again.`,
        ),
      ).toBeInTheDocument();
      expect(mutationCalled).toHaveBeenCalledExactlyOnceWith(
        state === 'read'
          ? { announcementID: announcement.id }
          : { id: 'read-1' },
      );
    });

    it('updates the read state without showing a toast on success', async () => {
      const user = new TestUserEvent();
      let currentAnnouncement = {
        ...announcement,
        read: state === 'unread' ? [{ id: 'read-1' }] : [],
      };
      server.use(
        nhostGraphQLLink.query('getAnnouncements', () =>
          HttpResponse.json({
            data: { announcements: [currentAnnouncement] },
          }),
        ),
        nhostGraphQLLink.mutation(operation, () => {
          currentAnnouncement = {
            ...announcement,
            read: state === 'read' ? [{ id: 'read-1' }] : [],
          };
          return HttpResponse.json({
            data:
              state === 'read'
                ? { insertAnnouncementRead: { id: 'read-1' } }
                : {
                    deleteAnnouncementRead: { announcementID: announcement.id },
                  },
          });
        }),
      );

      render(<AnnouncementFromQuery />);

      await screen.findByRole('link', { name: /important announcement/i });
      await performAction(action, user);
      await user.click(
        screen.getByRole('button', { name: 'Open announcement actions' }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole('menuitem', { name: `Mark as ${state}` }),
        ).toHaveAttribute('aria-disabled', 'true');
      });
      expect(
        screen.queryByRole('status', { hidden: true }),
      ).not.toBeInTheDocument();
    });
  });
});
