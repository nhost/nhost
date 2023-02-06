import { useAnnouncement } from '@/hooks/useAnnouncement'
import { NextSeo, NextSeoProps } from 'next-seo'
import { DetailedHTMLProps, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { Announcement } from '../Announcement'
import { Footer } from '../Footer'
import { Header } from '../Header'

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
  const { announcement, showAnnouncement, handleClose } = useAnnouncement()

  return (
    <div className="flex min-h-screen flex-col">
      {showAnnouncement && (
        <Announcement onClose={handleClose}>
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
