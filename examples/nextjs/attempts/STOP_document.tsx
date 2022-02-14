import type { GetServerSideProps } from 'next'
import Document, { DocumentContext } from 'next/document'
import Cookies from 'cookies'
// import { nhost } from './_app'

import { getDataFromTree } from '@apollo/client/react/ssr'
// import { getApolloClient } from '../helpers'
import { getApolloClient } from '../helpers'

class DocumentWithApollo extends Document {
  constructor(props) {
    super(props)

    /**
     * Attach apolloState to the "global" __NEXT_DATA__ so we can populate the ApolloClient cache
     */
    const { __NEXT_DATA__, apolloState } = props
    __NEXT_DATA__.apolloState = apolloState
    console.log('constructor')
  }

  static async getInitialProps(ctx: DocumentContext) {
    // TODO read carefully https://nextjs.org/docs/api-reference/data-fetching/get-initial-props
    const auth = ctx.res.getHeader('authorization')
    console.log('_document getInitialProps - start', auth)
    ctx.res.removeHeader('authorization')
    const startTime = Date.now()

    /**
     * Initialize and get a reference to ApolloClient, which is saved in a "global" variable.
     * The same client instance is returned to any other call to `getApolloClient`, so _app.js gets the same authenticated client to give to ApolloProvider.
     */
    const apolloClient = getApolloClient(true)

    await getDataFromTree(<ctx.AppTree {...(ctx as any).appProps} />)

    /**
     * Render the page as normal, but now that ApolloClient is initialized and the cache is full, each query will actually work.
     */
    const initialProps = await super.getInitialProps(ctx)
    /**
     * Extract the cache to pass along to the client so the queries are "hydrated" and don't need to actually request the data again!
     */

    const apolloState = apolloClient.extract()
    console.info(`getInitialProps - render Time: ${Date.now() - startTime} milliseconds.`)
    return { ...initialProps, apolloState }
  }
}

export default DocumentWithApollo
