import { NextSeo, NextSeoProps } from 'next-seo'
import { DetailedHTMLProps, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'
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
  return (
    <div className="flex min-h-screen flex-col">
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
