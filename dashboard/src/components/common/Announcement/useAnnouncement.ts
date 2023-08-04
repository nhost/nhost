import { useContext } from 'react';
import { AnnouncementContext } from './AnnouncementProvider';

export default function useAnnouncement() {
  const context = useContext(AnnouncementContext);

  if (!context) {
    throw new Error(
      'useAnnouncement must be used within an AnnouncementProvider',
    );
  }

  return context;
}
