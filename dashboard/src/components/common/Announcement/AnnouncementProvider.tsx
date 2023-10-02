import { Divider } from '@/components/ui/v2/Divider';
import {
  createContext,
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
const announcement: AnnouncementType = {
  id: 'node-18',
  href: 'https://github.com/nhost/nhost/discussions/2288',
  content:
    "Starting October 1st, we're upgrading to Node.js 18 for improved performance, security, and stability. Learn more.",
};

export const AnnouncementContext = createContext<AnnouncementContextProps>({});

export default function AnnouncementProvider({ children }: PropsWithChildren) {
  const { ref, inView } = useInView();
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !announcement ||
      window.localStorage.getItem(announcement.id) === '1'
    ) {
      return;
    }

    setShowAnnouncement(true);
  }, []);

  function handleClose() {
    setShowAnnouncement(false);
    window.localStorage.setItem(announcement?.id, '1');
  }

  const announcementValue = useMemo(
    () => ({ showAnnouncement, announcement, handleClose, inView }),
    [inView, showAnnouncement],
  );

  return (
    <AnnouncementContext.Provider value={announcementValue}>
      {announcement && showAnnouncement && (
        <>
          <Announcement
            ref={ref}
            href={announcement.href}
            onClose={handleClose}
          >
            {announcement.content}
          </Announcement>
          <Divider />
        </>
      )}

      {children}
    </AnnouncementContext.Provider>
  );
}
