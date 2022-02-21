import { NextPageContext } from 'next'
import { AppContext } from 'next/app'
import React from 'react'

// TODO remove this file - design has been abandonned
export interface NhostAppContext extends AppContext {
  ctx: NextPageContext
  AppTree: any
}
declare type NhostContext = NextPageContext | NhostAppContext

// Gets the display name of a JSX component for dev tools
function getDisplayName(Component: React.ComponentType<any>) {
  return Component.displayName || Component.name || 'Unknown'
}
/*
export const configureNhostSSR = ({ backendUrl, initial = null }: NhostClientOptions) => {
  type NhostProps = { initial: NhostSession | null; nhost: Nhost }

  return (Page: NextPage<any> | typeof App) => {
    const getInitialProps = Page.getInitialProps
    function WithNhost({ initial, ...props }: NhostProps) {
      const nhost: Nhost = props.nhost || new NhostSSR({ backendUrl, session: initial })
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

      const initial = await getNhostCookieSession(backendUrl, ctx)

      const nhost = new NhostSSR({ initial, backendUrl })

      ;(nhost as any).toJSON = () => {
        return null
      }

      return {
        ...pageProps,
        initial,
        nhost
      }
    }

    return WithNhost
  }
}
*/
