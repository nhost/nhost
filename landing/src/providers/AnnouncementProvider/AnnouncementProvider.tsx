import { Announcement } from '@/components/common/Announcement'
import {
  createContext,
  PropsWithChildren,
  ReactNode,
  useEffect,
  useState,
} from 'react'
import { useInView } from 'react-intersection-observer'

export interface AnnouncementContextProps {
  /**
   * The announcement to show.
   */
  announcement?: {
    id: string
    content: ReactNode
    href: string
  }
  /**
   * Whether or not to show the announcement.
   */
  showAnnouncement?: boolean
  /**
   * Function to close the announcement.
   */
  handleClose?: () => void
  /**
   * Whether or not the announcement is in view.
   */
  inView?: boolean
}

export const AnnouncementContext = createContext<AnnouncementContextProps>({})

export default function AnnouncementProvider({ children }: PropsWithChildren) {
  const { ref, inView } = useInView()
  const [showAnnouncement, setShowAnnouncement] = useState(false)

  const announcement = {
    id: 'nhost-launch-month-announcement-seen',
    content: 'Nhost Launch Month - February 2023',
    href: '/launch-month',
  }

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      window.localStorage.getItem(announcement.id) === '1'
    ) {
      return
    }

    setShowAnnouncement(true)
  }, [announcement.id])

  function handleClose() {
    setShowAnnouncement(false)
    window.localStorage.setItem(announcement.id, '1')
  }

  return (
    <AnnouncementContext.Provider
      value={{ showAnnouncement, announcement, handleClose, inView }}
    >
      {announcement && showAnnouncement && (
        <Announcement ref={ref} href={announcement.href} onClose={handleClose}>
          {announcement.content}
        </Announcement>
      )}

      {children}
    </AnnouncementContext.Provider>
  )
}
