import '@/styles/fonts.css'
import '@/styles/globals.css'
import '@/styles/style.css'
import { DefaultSeo } from 'next-seo'

function MyApp({ Component, pageProps }) {
  return (
    <>
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
