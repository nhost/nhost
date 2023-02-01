import { NextSeo, NextSeoProps } from 'next-seo'
import { DetailedHTMLProps, HTMLProps } from 'react'
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

export default function Layout({ children, slotProps, ...props }: LayoutProps) {
  return (
    <div className="pt-20" {...props}>
      <Header
        slotProps={{
          root: {
            className:
              'fixed top-0 left-0 right-0 bg-black bg-opacity-[1%] backdrop-blur',
          },
        }}
      />

      <main>{children}</main>

      <Footer />
      <NextSeo {...(slotProps?.nextSeo || {})} />
    </div>
  )
}
