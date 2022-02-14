import cookie from 'cookie'
import { NextPage, NextPageContext } from 'next'
import App, { AppContext } from 'next/app'
import React from 'react'

import {
  initNhost,
  Nhost,
  NHOST_ACCESS_TOKEN_KEY,
  NHOST_REFRESH_TOKEN_KEY,
  NHOST_USER_KEY,
  NhostInitOptions
} from '@nhost/core'
import { NhostProvider } from '@nhost/react'

export interface NhostPageContext extends NextPageContext {
  nhost: Nhost
}
export interface NhostApolloAppContext extends AppContext {
  ctx: NhostPageContext
  AppTree: any
}
export declare type NhostContext = NhostPageContext | NhostApolloAppContext

// Gets the display name of a JSX component for dev tools
function getDisplayName(Component: React.ComponentType<any>) {
  return Component.displayName || Component.name || 'Unknown'
}

export const withNhost = (options: Omit<NhostInitOptions, 'ssr'>) => {
  type NhostProps = Partial<{ nhostCookie: any; nhost: Nhost }>
  const nhost = initNhost({ ...options, ssr: true })

  return (Page: NextPage<any> | typeof App) => {
    const getInitialProps = Page.getInitialProps
    function WithNhost({ nhostCookie, ...props }: NhostProps) {
      return (
        <NhostProvider nhost={nhost} initialContext={nhostCookie}>
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

        if (ctx.req?.headers.cookie) {
          const c = cookie.parse(ctx.req.headers.cookie)
          const userCookie = c[NHOST_USER_KEY]
          const nhostCookie = {
            user: userCookie ? JSON.parse(userCookie) : null,
            refreshToken: c[NHOST_REFRESH_TOKEN_KEY] ?? null,
            accessToken: c[NHOST_ACCESS_TOKEN_KEY] ?? null
          }
          return {
            ...pageProps,
            nhostCookie
          }
        }
      }

      return pageProps
    }

    return WithNhost
  }
}
