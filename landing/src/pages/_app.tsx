import '@/styles/globals.css'
import { getDefaultOgUrl } from '@/utils/utils'
import { NextPage } from 'next'
import { DefaultSeo } from 'next-seo'
import type { AppProps } from 'next/app'
import { ReactElement } from 'react'

export type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactElement
}
export interface LandingPageProps extends AppProps {
  Component: NextPageWithLayout
}

export default function App({ Component, pageProps }: LandingPageProps) {
  const getLayout = Component.getLayout || ((page: ReactElement) => page)

  return (
    <>
      <DefaultSeo
        defaultTitle="Nhost: The Open Source Firebase Alternative with GraphQL"
        title="Nhost: The Open Source Firebase Alternative with GraphQL"
        titleTemplate="%s | Nhost"
        description="Nhost is an open source Firebase alternative with GraphQL, built with the following things in mind: Open Source, GraphQL, SQL, Great Developer Experience"
        openGraph={{
          type: 'website',
          images: [
            {
              url: getDefaultOgUrl(),
              width: 1200,
              height: 640,
              alt: 'Nhost: The Open Source Firebase Alternative with GraphQL',
            },
          ],
        }}
        twitter={{
          handle: '@nhost',
          site: '@nhost',
          cardType: 'summary_large_image',
        }}
      />

      {getLayout(<Component {...pageProps} />)}
    </>
  )
}
