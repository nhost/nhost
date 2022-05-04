---
title: 'Configuration'
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Installation

<Tabs>
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

---

## Configuration

Configuring Nhost with Next.js follows the same logic as React, except we are initializing with the `NhostClient` from the `@nhost/nextjs` package.
Under the hood, `NhostClient` uses cookies to store the refresh token, and disables auto-refresh and auto-login when running on the server-side.

```jsx
// {project-root}/pages/_app.tsx
import type { AppProps } from 'next/app';

import { NhostClient, NhostNextProvider } from '@nhost/nextjs';

import Header from '../components/Header';

const nhost = new NhostClient({ backendUrl: 'my-app.nhost.run' });

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NhostNextProvider nhost={nhost} initial={pageProps.nhostSession}>
      <div>
        <Header />
        <Component {...pageProps} />
      </div>
    </NhostNextProvider>
  );
}

export default MyApp;
```

---

## Client-side rendering

The logic is the same as in a classic React application:

```jsx
// {project-root}/pages/csr-page.tsx
import { NextPageContext } from 'next';
import React from 'react';

import { useAccessToken, useAuthenticated, useUserData } from '@nhost/nextjs';

const ClientSidePage: React.FC = () => {
  const isAuthenticated = useAuthenticated();
  const user = useUserData();
  const accessToken = useAccessToken();

  if (!isAuthenticated) {
    return <div>User it not authenticated</div>;
  }

  return (
    <div>
      <h1>{user?.displayName} is authenticated</h1>
      <div>Access token: {accessToken}</div>
    </div>
  );
};

export default ClientSidePage;
```

---

## Server-side rendering

You need to load the session from the server first from `getServerSideProps`. Once it is done, the `_app` component will make sure to load or update the session through `pageProps`.

```jsx
// {project-root}/pages/ssr-page.tsx
import { NextPageContext } from 'next';
import React from 'react';

import {
  getNhostSession,
  NhostSession,
  useAccessToken,
  useAuthenticated,
  useUserData,
} from '@nhost/nextjs';

export async function getServerSideProps(context: NextPageContext) {
  const nhostSession = await getNhostSession('my-app.nhost.run', context);

  return {
    props: {
      nhostSession,
    },
  };
}

const ServerSidePage: React.FC<{ initial: NhostSession }> = () => {
  const authenticated = useAuthenticated();
  const user = useUserData();
  const accessToken = useAccessToken();

  if (!authenticated) {
    return <div>User it not authenticated</div>;
  }

  return (
    <div>
      <h1>{user?.displayName} is authenticated</h1>
      <div>Access token: {accessToken}</div>
    </div>
  );
};

export default ServerSidePage;
```
