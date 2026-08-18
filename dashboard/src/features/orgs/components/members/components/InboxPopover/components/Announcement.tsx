import { formatDistance } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/v3/button';
import AnnouncementMenu from '@/features/orgs/components/members/components/InboxPopover/components/AnnouncementMenu';
import {
  GetAnnouncementsDocument,
  type GetAnnouncementsQuery,
  useDeleteAnnouncementReadMutation,
  useInsertAnnouncementReadMutation,
} from '@/generated/graphql';
import { isEmptyValue } from '@/lib/utils';

export interface AnnouncementProps {
  announcement: GetAnnouncementsQuery['announcements'][number];
}

export default function Announcement({ announcement }: AnnouncementProps) {
  const [insertAnnouncementRead] = useInsertAnnouncementReadMutation({
    refetchQueries: [{ query: GetAnnouncementsDocument }],
    awaitRefetchQueries: true,
  });
  const [deleteAnnouncementRead] = useDeleteAnnouncementReadMutation({
    refetchQueries: [{ query: GetAnnouncementsDocument }],
    awaitRefetchQueries: true,
  });

  const isUnread = isEmptyValue(announcement.read);
  const announcementReadId = announcement.read.at(0)?.id;

  const handleSetRead = () =>
    insertAnnouncementRead({
      variables: { announcementID: announcement.id },
    });

  const handleSetUnread = () => {
    if (announcementReadId) {
      deleteAnnouncementRead({ variables: { id: announcementReadId } });
    }
  };

  return (
    <Button
      variant="ghost"
      asChild
      className="h-fit w-full items-start gap-2 rounded-md p-0 text-left"
    >
      <Link
        target="_blank"
        rel="noopener noreferrer"
        href={announcement.href}
        shallow
        onClick={() => {
          if (isUnread) {
            handleSetRead();
          }
        }}
      >
        {isUnread ? (
          <span className="mt-[5px] h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
        ) : (
          <span className="mt-[5px] h-2 w-2 flex-shrink-0" />
        )}
        <div className="flex w-full flex-row justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">
              {formatDistance(new Date(announcement.createdAt), new Date(), {
                addSuffix: true,
              })}
            </span>
            <p className="whitespace-normal text-sm">{announcement.content}</p>
          </div>
          <AnnouncementMenu
            isUnread={isUnread}
            onSetRead={handleSetRead}
            onSetUnread={handleSetUnread}
          />
        </div>
      </Link>
    </Button>
  );
}
