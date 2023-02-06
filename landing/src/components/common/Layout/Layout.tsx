import { NextSeo, NextSeoProps } from 'next-seo'
import { DetailedHTMLProps, HTMLProps, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Announcement } from '../Announcement'
import { Footer } from '../Footer'
import { Header } from '../Header'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import { Link } from '../Link'

/**
 * Configure the announcement here.
 */
const announcement = {
  id: 'nhost-launch-month-announcement-seen',
  content: (
    <Link
      href="/launch-month"
      className="font-display flex items-center justify-center self-center text-center text-opacity-100"
    >
      Nhost Launch Month - February 2023{' '}
      <ArrowRightIcon className="ml-1 h-4 w-4 text-white" />
    </Link>
  ),
}

export interface LayoutProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Props passed to component slots.
   */
  slotProps?: {
    /**
     * Props passed to the `<NextSeo />` component.
     */
    nextSeo?: NextSeoProps
  }
}

export default function Layout({
  className,
  children,
  slotProps,
  ...props
}: LayoutProps) {
  const [showAnnouncement, setShowAnnouncement] = useState(false)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      window.localStorage.getItem(announcement.id) === '1'
    ) {
      return
    }

    setShowAnnouncement(true)
  }, [])

  function handleAnnouncementClose() {
    setShowAnnouncement(false)
    window.localStorage.setItem(announcement.id, '1')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {showAnnouncement && (
        <Announcement onClose={handleAnnouncementClose}>
          {announcement.content}
        </Announcement>
      )}

      <Header
        slotProps={{
          root: { className: 'sticky top-0 left-0 right-0 transform-cpu' },
        }}
      />

      <main className={twMerge('flex-auto', className)} {...props}>
        {children}
      </main>

      <Footer />
      <NextSeo {...(slotProps?.nextSeo || {})} />
    </div>
  )
}
