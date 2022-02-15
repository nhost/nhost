import Cookies from 'cookies'
import { NextPage, NextPageContext } from 'next'
import App, { AppContext } from 'next/app'
import React from 'react'

import {
  initNhost,
  Nhost,
  NHOST_NEXT_REFRESH_KEY,
  NHOST_REFRESH_TOKEN_KEY,
  NhostInitOptions
} from '@nhost/core'
import { NhostProvider } from '@nhost/react'

import { refresh } from './utils'

interface NhostPageContext extends NextPageContext {
  nhost: Nhost
}
interface NhostApolloAppContext extends AppContext {
  ctx: NhostPageContext
  AppTree: any
}
declare type NhostContext = NhostPageContext | NhostApolloAppContext

// Gets the display name of a JSX component for dev tools
function getDisplayName(Component: React.ComponentType<any>) {
  return Component.displayName || Component.name || 'Unknown'
}

export const configureNhostSSR = (options: Omit<NhostInitOptions, 'ssr'>) => {
  type NhostProps = Partial<{ session: any; nhost: Nhost }>
  const nhost = initNhost({ ...options, ssr: true })

  return (Page: NextPage<any> | typeof App) => {
    const getInitialProps = Page.getInitialProps
    function WithNhost({ session, ...props }: NhostProps) {
      return (
        <NhostProvider nhost={nhost} initialContext={session}>
          <Page {...props} nhost={nhost} />
        </NhostProvider>
      )
    }

    WithNhost.displayName = `WithNhost(${getDisplayName(Page)})`

    WithNhost.getInitialProps = async (pageCtx: NhostContext) => {
      const ctx = 'Component' in pageCtx ? pageCtx.ctx : pageCtx
      let pageProps = {}

      if (getInitialProps) {
        pageProps = await getInitialProps(pageCtx as any)
      }

      if (typeof window === 'undefined') {
        if (ctx.res && (ctx.res.headersSent || ctx.res.writableEnded)) {
          return pageProps
        }
        // !
        // ! 'Refresh' runs twice on login
        // !
        // ! 'Refresh' runs after logging in!
        // !
        // ? hasura-auth call could be here
        // ? and then, a custom API to refresh the token
        if (ctx.req && ctx.res) {
          const cookies = Cookies(ctx.req, ctx.res)

          const refreshToken = cookies.get(NHOST_REFRESH_TOKEN_KEY) ?? null
          if (refreshToken) {
            const session = await refresh(options.backendUrl, refreshToken)
            cookies.set(NHOST_REFRESH_TOKEN_KEY, session.refreshToken, {
              httpOnly: false,
              sameSite: true
            })
            cookies.set(
              NHOST_NEXT_REFRESH_KEY,
              new Date(Date.now() + session.accessTokenExpiresIn * 1_000).toISOString(),
              {
                httpOnly: false,
                sameSite: true
              }
            )
            return {
              ...pageProps,
              session
            }
          }
          return pageProps
        }
      }

      return pageProps
    }

    return WithNhost
  }
}
