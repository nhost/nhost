import { Container } from '@/components/common/Container'
import { Footer } from '@/components/common/Footer'
import { Header } from '@/components/common/Header'
import { NextSeo, NextSeoProps } from 'next-seo'
import { DetailedHTMLProps, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

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

export function MdxLayout({
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
        <Container className="prose prose-invert max-w-prose py-20">
          {children}
        </Container>
      </main>

      <Footer />
      <NextSeo {...(slotProps?.nextSeo || {})} />
    </div>
  )
}
