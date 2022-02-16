import Cookies from 'cookies'
import { NextPage, NextPageContext } from 'next'
import App, { AppContext } from 'next/app'
import React from 'react'

import {
  cookieStorageGetter,
  cookieStorageSetter,
  INITIAL_MACHINE_CONTEXT,
  initNhost,
  Nhost,
  NHOST_NEXT_REFRESH_KEY,
  NHOST_REFRESH_TOKEN_KEY,
  NhostInitOptions
} from '@nhost/core'
import { NhostProvider } from '@nhost/react'

import { refresh, Session } from './utils'

export interface NhostPageContext extends NextPageContext {
  nhost: Nhost
}
export interface NhostApolloAppContext extends AppContext {
  ctx: NhostPageContext
  AppTree: any
}
declare type NhostContext = NhostPageContext | NhostApolloAppContext

// Gets the display name of a JSX component for dev tools
function getDisplayName(Component: React.ComponentType<any>) {
  return Component.displayName || Component.name || 'Unknown'
}

export const configureNhostSSR = (options: NhostInitOptions) => {
  type NhostProps = Partial<{ session: Session; nhost: Nhost }>

  return (Page: NextPage<any> | typeof App) => {
    const nhost = initNhost({
      ...options,
      start: false,
      storageGetter: cookieStorageGetter,
      storageSetter: cookieStorageSetter
    })

    const getInitialProps = Page.getInitialProps
    function WithNhost({ session, ...props }: NhostProps) {
      if (session) {
        nhost.machine = nhost.machine.withContext({ ...INITIAL_MACHINE_CONTEXT, ...session })
      }
      return (
        <NhostProvider nhost={nhost}>
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
