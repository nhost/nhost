import { Inter } from '@next/font/google'
import { NextSeo, NextSeoProps } from 'next-seo'
import { DetailedHTMLProps, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { Footer } from '../Footer'
import { Header } from '../Header'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

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
    <div className={twMerge('flex min-h-screen flex-col', inter.className)}>
      <Header
        slotProps={{
          root: {
            className: 'sticky top-0 left-0 right-0 transform-cpu w-full',
          },
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
