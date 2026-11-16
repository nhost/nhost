import { AnnouncementProvider } from '@/providers/AnnouncementProvider'
import '@/styles/globals.css'
import '@code-hike/mdx/dist/index.css'
import { baseUrl } from '@/utils/utils'
import { NextPage } from 'next'
import PlausibleProvider from 'next-plausible'
import { DefaultSeo } from 'next-seo'
import type { AppProps } from 'next/app'
import { ReactElement } from 'react'
import Analytics from '@/components/analytics/analytics'

export type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactElement
}
export interface LandingPageProps extends AppProps {
  Component: NextPageWithLayout
}

export default function App({ Component, pageProps }: LandingPageProps) {
  const getLayout = Component.getLayout || ((page: ReactElement) => page)

  return (
    <AnnouncementProvider>
      <DefaultSeo
        defaultTitle="Nhost: Launch in minutes. Scale without limits"
        titleTemplate="%s | Nhost"
        description="Nhost is a fully managed, extensible backend platform designed for speed, flexibility, and scale - without the infrastructure headaches."
        openGraph={{
          images: [
            {
              url: `${baseUrl()}/images/og-new.png`,
              alt: 'Nhost: Launch in minutes. Scale without limits',
            },
          ],
        }}
        twitter={{
          handle: '@nhost',
          site: '@nhost',
          cardType: 'summary_large_image',
        }}
      />

      {process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' && <Analytics />}

      {getLayout(
        <PlausibleProvider
          domain="nhost.io"
          enabled={process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'}
        >
          <Component {...pageProps} />
        </PlausibleProvider>,
      )}
    </AnnouncementProvider>
  )
}
