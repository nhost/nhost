import Cookies from 'cookies'
import { NextPage, NextPageContext } from 'next'
import App, { AppContext } from 'next/app'
import React from 'react'

import {
  cookieStorageGetter,
  cookieStorageSetter,
  Nhost,
  NHOST_NEXT_REFRESH_KEY,
  NHOST_REFRESH_TOKEN_KEY,
  NhostClient,
  NhostClientOptions
} from '@nhost/core'
import { NhostProvider } from '@nhost/react'

import { refresh, Session } from './utils'

export interface NhostAppContext extends AppContext {
  ctx: NextPageContext
  AppTree: any
}
declare type NhostContext = NextPageContext | NhostAppContext

// Gets the display name of a JSX component for dev tools
function getDisplayName(Component: React.ComponentType<any>) {
  return Component.displayName || Component.name || 'Unknown'
}

export const configureNhostSSR = (options: NhostClientOptions) => {
  type NhostProps = Partial<{ session: Session; nhost: Nhost }>

  return (Page: NextPage<any> | typeof App) => {
    const getInitialProps = Page.getInitialProps
    function WithNhost({ session, ...props }: NhostProps) {
      const nhost = new NhostClient({
        ...options,
        storageGetter: cookieStorageGetter,
        storageSetter: cookieStorageSetter,
        initialContext: session
      })
      return (
        <NhostProvider nhost={nhost}>
          <Page {...props} />
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
              new Date(Date.now() + (session.accessTokenExpiresIn || 0) * 1_000).toISOString(),
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
