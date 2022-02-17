import Script from 'next/script'
import '@/styles/fonts.css'
import '@/styles/globals.css'
import '@/styles/style.css'
import { DefaultSeo } from 'next-seo'

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"
        strategy="lazyOnload"
        onLoad={() => mermaid.init({ noteMargin: 10 }, '.mermaid')}
      />
      <DefaultSeo
        openGraph={{
          type: 'website',
          locale: 'en_IE',
          url: 'https://docs.nhost.io/',
          site_name: 'Nhost'
        }}
        twitter={{
          site: '@nhost',
          cardType: 'summary_large_image'
        }}
      />
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
