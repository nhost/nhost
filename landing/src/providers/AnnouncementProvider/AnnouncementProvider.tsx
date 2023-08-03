import { Announcement } from '@/components/common/Announcement'
import {
  createContext,
  PropsWithChildren,
  ReactNode,
  useEffect,
  useState,
} from 'react'
import { useInView } from 'react-intersection-observer'

interface Announcement {
  id: string
  content: ReactNode
  href: string
}

export interface AnnouncementContextProps {
  /**
   * The announcement to show.
   */
  announcement?: Announcement
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

// Note: You can define the active announcement here.
const announcement: Announcement = {
  id: 'nhost-run',
  href: '/product/run',
  content:
    'Now you can bring custom and third-party OSS services to run alongside your Nhost projects',
}

export const AnnouncementContext = createContext<AnnouncementContextProps>({})

export default function AnnouncementProvider({ children }: PropsWithChildren) {
  const { ref, inView } = useInView()
  const [showAnnouncement, setShowAnnouncement] = useState(false)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !announcement ||
      window.localStorage.getItem(announcement.id) === '1'
    ) {
      return
    }

    setShowAnnouncement(true)
  }, [])

  function handleClose() {
    setShowAnnouncement(false)
    window.localStorage.setItem(announcement?.id, '1')
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
