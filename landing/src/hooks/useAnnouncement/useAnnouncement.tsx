import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Link } from '@/components/common/Link'
import { useEffect, useState } from 'react'

export default function useAnnouncement() {
  const [showAnnouncement, setShowAnnouncement] = useState(false)

  const announcement = {
    id: 'nhost-launch-month-announcement-seen',
    content: (
      <Link href="/launch-month" className="text-opacity-100">
        <span className="truncate">Nhost Launch Month - February 2023</span>{' '}
        <ArrowRightIcon className="ml-1 h-4 w-4 text-white" />
      </Link>
    ),
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

  return {
    announcement,
    showAnnouncement,
    handleClose,
  }
}
