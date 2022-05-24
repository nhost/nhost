<h1 align="center">@nhost/nextjs</h1>
<h2 align="center">Use Nhost with NextJS on SSR mode</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/nextjs">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/nextjs">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

The Nhost Next.js client exports a React provider for Next.js and React hooks that make it easier to work with Nhost in your Next.js app. The Next.js client is built on top of the Nhost React client and exports the same hooks and helpers.

## Documentation

- [Quickstart](https://docs.nhost.io/platform/quickstarts/nextjs)
- [Reference documentation](https://docs.nhost.io/reference/nextjs)

## Installation

Install the Nhost Next.js client, React client together with GraphQL:

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>

```bash
npm install @nhost/react @nhost/nextjs graphql
```

  </TabItem>
  <TabItem value="yarn" label="Yarn">

```bash
yarn add @nhost/react @nhost/nextjs graphql
```

  </TabItem>
</Tabs>

## Initializing

Initialize a single `nhost` instance and wrap your app with the `NhostNextProvider`.

```jsx title=pages/_app.js
import type { AppProps } from 'next/app'

import { NhostClient, NhostNextProvider } from '@nhost/nextjs'

const nhost = new NhostClient({
  backendUrl: '<Your Nhost Backend URL>'
})

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NhostNextProvider nhost={nhost} initial={pageProps.nhostSession}>
      <Component {...pageProps} />
    </NhostNextProvider>
  )
}

export default MyApp
```

:::info

The `nhost` instance created with the `NhostClient` above is the same as the [JavaScript Nhost client](/reference/javascript).

:::

## Server-Side Rendering (SSR)

You need to load the session from the server first from `getServerSideProps`. Once it is done, the `_app` component will make sure to load or update the session through `pageProps`.

```jsx title=pages/ssr-page.tsx
import { NextPageContext } from 'next'
import React from 'react'

import {
  getNhostSession,
  NhostSession,
  useAccessToken,
  useAuthenticated,
  useUserData
} from '@nhost/nextjs'

export async function getServerSideProps(context: NextPageContext) {
  const nhostSession = await getNhostSession('<Your Nhost Backend URL>', context)

  return {
    props: {
      nhostSession
    }
  }
}

const ServerSidePage: React.FC<{ initial: NhostSession }> = () => {
  const isAuthenticated = useAuthenticated()
  const user = useUserData()
  const accessToken = useAccessToken()

  if (!isAuthenticated) {
    return <div>User it not authenticated</div>
  }

  return (
    <div>
      <h1>{user?.displayName} is authenticated</h1>
      <div>Access token: {accessToken}</div>
    </div>
  )
}

export default ServerSidePage
```

## Apollo GraphQL

You can use Apollo's GraphQL Client together with Next.js and Nhost.

### Installation

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>

```bash
npm install @nhost/react-apollo @apollo/client
```

  </TabItem>
  <TabItem value="yarn" label="Yarn">

```bash
yarn add @nhost/react-apollo @apollo/client
```

  </TabItem>
</Tabs>

### Initializing

Wrap the React app with the `NhostApolloProvider` and make sure the `NhostApolloProvider` is nested inside the `NhostNextProvider`.

```jsx title=pages/_app.js
import type { AppProps } from 'next/app'

import { NhostClient, NhostNextProvider } from '@nhost/nextjs'
import { NhostApolloProvider } from '@nhost/react-apollo'

const nhost = new NhostClient({
  backendUrl: '<Your Nhost Backend URL>'
})

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NhostNextProvider nhost={nhost} initial={pageProps.nhostSession}>
      <NhostApolloProvider nhost={nhost}>
        <Component {...pageProps} />
      </NhostApolloProvider>
    </NhostNextProvider>
  )
}

export default MyApp
```

Since Next.js is built on top of React you can read more about how to use Apollo and GraphQL in [here](/reference/react/apollo#usage).
