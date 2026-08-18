import Announcement from '@/features/orgs/components/members/components/InboxPopover/components/Announcement';
import type { GetAnnouncementsQuery } from '@/generated/graphql';
import { render, screen } from '@/tests/testUtils';

describe('Announcement', () => {
  it('renders the actions menu outside the announcement link', () => {
    const announcement = {
      id: 'announcement-1',
      href: 'https://example.com/announcement',
      content: 'Important announcement',
      createdAt: '2026-01-01T00:00:00.000Z',
      read: [],
    } as GetAnnouncementsQuery['announcements'][number];

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
});
