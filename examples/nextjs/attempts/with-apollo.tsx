import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client'
import withApollo, {
  ApolloAppContext,
  ApolloContext,
  ApolloPageContext,
  initApollo,
  InitApolloClient,
  WithApolloOptions,
  WithApolloProps,
  WithApolloState
} from 'next-with-apollo'
import Cookies from 'cookies'
import { NextPage } from 'next'
import apollo from 'next-with-apollo/lib/apollo'
import App, { AppContext } from 'next/app'
import { getDisplayName, NextComponentType, NextPageContext } from 'next/dist/shared/lib/utils'
import { render } from 'react-dom'
const COOKIE_NAME = 'token'
const NHOST_BACKEND_URL = 'http://127.0.0.1:1337'

export interface NhostPageContext<C = any> extends ApolloPageContext {
  additionalData: string
}
export interface NhostAppContext<C = any> extends ApolloAppContext {
  ctx: NhostPageContext<C>
  AppTree: any
}
export declare type NhostContext<C = any> = NhostPageContext<C> | NhostAppContext<C>

// ! copy-paste from hasura-auth
type Session = {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  user?: any
}

export const withNhost = (Component: NextComponentType<NextPageContext, any, {}>) => {
  const Session = (props: any) => {
    return <Component {...props} />
  }

  Session.getInitialProps = async (ctx: NextPageContext) => {
    console.log('yeeeha')
    let pageProps: any = {}

    return { bingo: 'BINGO' }
  }

  // Copy getInitial props so it will run as well

  return Session
}

const wa = withApollo(
  ({ initialState, ctx, headers }) => {
    console.log('inside the magic')
    // TODO won't work async -> fallback to a middleware
    // if (ctx) {
    //   // * Context exists: we're on the server side
    //   const cookies = new Cookies(ctx.req, ctx.res)
    //   const oldRefreshToken = cookies.get(COOKIE_NAME)
    //   if (oldRefreshToken) {
    //     try {
    //       //   const {
    //       //     data: { refreshToken, ...rest }
    //       //   } = await axios.post<Session>(`${NHOST_BACKEND_URL}/v1/auth/token`, {
    //       //     refreshToken: oldRefreshToken
    //       //   })
    //       const result = await fetch(`${NHOST_BACKEND_URL}/v1/auth/token`, {
    //         method: 'POST',
    //         headers: {
    //           'Content-Type': 'application/json'
    //         },
    //         body: JSON.stringify({ refreshToken: oldRefreshToken })
    //       })
    //       const { refreshToken, ...rest }: Session = await result.json()

    //       console.log('AUTH - set response headers')

    //       // * do NOT send the JWT back to the client, but store it somewhere for later
    //       // ctx.res.setHeader('authorization', `Bearer ${rest.accessToken}`)
    //       // ctx.res.setHeader('token', refreshToken)
    //       cookies.set(COOKIE_NAME, refreshToken, { sameSite: true, httpOnly: false })

    //       // response.cookie(COOKIE_NAME, refreshToken, { httpOnly: true, sameSite: true })
    //       // console.log('HERE', response.cookies)
    //       // return response
    //     } catch (error) {
    //       console.warn('error in refreshing the token')
    //       // return NextResponse.json({ token: 'error' })
    //     }
    //   } else {
    //     console.log('NOPE')
    //     // const response = NextResponse.next()
    //     cookies.set(COOKIE_NAME, '0c507be2-f496-47b6-abb9-284f99a11e73', {
    //       httpOnly: false,
    //       sameSite: true
    //     })
    //   }
    // }
    console.log(initialState, ctx, headers)
    return new ApolloClient({
      uri: 'http://127.0.0.1:1337/v1/graphql',
      cache: new InMemoryCache().restore(initialState || {})
    })
  },
  {
    render: ({ Page, props }) => {
      console.log('RENDER')
      return (
        <ApolloProvider client={props.apollo}>
          <Page {...props} />
        </ApolloProvider>
      )
    }
  }
)

export default wa
