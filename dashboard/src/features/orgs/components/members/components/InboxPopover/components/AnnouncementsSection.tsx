import { Megaphone } from 'lucide-react';
import Announcement from '@/features/orgs/components/members/components/InboxPopover/components/Announcement';
import type { GetAnnouncementsQuery } from '@/generated/graphql';
import { isEmptyValue } from '@/lib/utils';

export interface AnnouncementsSectionProps {
  announcements: GetAnnouncementsQuery['announcements'];
  loading: boolean;
}

export default function AnnouncementsSection({
  announcements,
  loading,
}: AnnouncementsSectionProps) {
  return (
    <section className="flex flex-col gap-4 border-t px-5 py-4">
      <h3 className="flex items-center gap-2 font-semibold text-muted-foreground text-xs tracking-widest">
        <Megaphone className="h-3 w-3" />
        ANNOUNCEMENTS
      </h3>

      {!loading && isEmptyValue(announcements) && (
        <span className="text-muted-foreground text-xs">
          No new announcements
        </span>
      )}

      {announcements.map((announcement) => (
        <Announcement key={announcement.id} announcement={announcement} />
      ))}
    </section>
  );
}
