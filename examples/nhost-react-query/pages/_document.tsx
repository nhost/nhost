import { ColorModeScript } from '@chakra-ui/react'
import customTheme from '@theme/customTheme'
import NextDocument, { Head, Html, Main, NextScript } from 'next/document'
import { ReactElement } from 'react'

export default class Document extends NextDocument {
  render(): ReactElement {
    return (
      <Html>
        <Head />
        <body>
          <ColorModeScript initialColorMode={customTheme.config.initialColorMode} />
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
