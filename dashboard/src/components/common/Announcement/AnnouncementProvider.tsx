import { Divider } from '@/components/ui/v2/Divider';
import { useGetAnnouncementsQuery } from '@/utils/__generated__/graphql';
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { useInView } from 'react-intersection-observer';
import Announcement from './Announcement';

interface AnnouncementType {
  id: string;
  content: ReactNode;
  href: string;
}

export interface AnnouncementContextProps {
  /**
   * The announcement to show.
   */
  announcement?: AnnouncementType;
  /**
   * Whether or not to show the announcement.
   */
  showAnnouncement?: boolean;
  /**
   * Function to close the announcement.
   */
  handleClose?: () => void;
  /**
   * Whether or not the announcement is in view.
   */
  inView?: boolean;
}

// Note: You can define the active announcement here.
// const announcement: AnnouncementType = {
//   id: 'node-18',
//   href: 'https://github.com/nhost/nhost/discussions/2288',
//   content:
//     "Starting October 1st, we're upgrading to Node.js 18 for improved performance, security, and stability. Learn more.",
// };

export const AnnouncementContext = createContext<AnnouncementContextProps>({});

export default function AnnouncementProvider({ children }: PropsWithChildren) {
  const { ref, inView } = useInView();
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  const { data } = useGetAnnouncementsQuery({
    variables: {
      limit: 1,
    },
  });

  const latestAnnouncement = data?.announcements?.[0];

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !latestAnnouncement ||
      window.localStorage.getItem(latestAnnouncement.id) === '1'
    ) {
      return;
    }

    setShowAnnouncement(true);
  }, [latestAnnouncement]);

  const handleClose = useCallback(() => {
    setShowAnnouncement(false);
    window.localStorage.setItem(latestAnnouncement?.id, '1');
  }, [latestAnnouncement]);

  const announcementValue = useMemo(
    () => ({ showAnnouncement, latestAnnouncement, handleClose, inView }),
    [inView, showAnnouncement, handleClose, latestAnnouncement],
  );

  return (
    <AnnouncementContext.Provider value={announcementValue}>
      {latestAnnouncement && showAnnouncement && (
        <>
          <Announcement
            ref={ref}
            href={latestAnnouncement.href}
            onClose={handleClose}
          >
            {latestAnnouncement.content}
          </Announcement>
          <Divider />
        </>
      )}

      {children}
    </AnnouncementContext.Provider>
  );
}
