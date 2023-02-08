import { Head, Html, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link
          rel="preload"
          href="/fonts/Mona-Sans.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="shortcut icon" href="/favicon.ico" />
      </Head>
      <body className="bg-black text-sm">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
