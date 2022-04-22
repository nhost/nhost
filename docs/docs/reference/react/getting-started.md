---
title: 'Getting started'
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Installation

<Tabs>
  <TabItem value="npm" label="npm" default>

```bash
npm install @nhost/react graphql
```

  </TabItem>
  <TabItem value="yarn" label="Yarn">

```bash
yarn add @nhost/react graphql
```

  </TabItem>
</Tabs>

---

## Configuration

`@nhost/react` exports a React provider `NhostReactProvider` that makes the authentication state and the several hooks available in your application. Wrap this component around your whole App.

```jsx
import React from 'react';
import ReactDOM from 'react-dom';

import { NhostClient, NhostReactProvider } from '@nhost/react';

import App from './App';

const nhost = new NhostClient({
  backendUrl: 'http://localhost:1337',
});

ReactDOM.render(
  <React.StrictMode>
    <NhostReactProvider nhost={nhost}>
      <App />
    </NhostReactProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);
```

---

### Options

```js
const nhost = new NhostClient({
  backendUrl,
  autoLogin,
  autoRefreshToken,
  clientStorageGetter,
  clientStorageSetter,
});
```

| Name                  | Type                                | Default            | Notes                                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backendUrl`          | string                              |                    | The Nhost app url, for instance `https://my-app.nhost.run`. When using the CLI, its value is `http://localhost:1337`                                                                                                                           |
| `autoLogin`           | boolean                             | `true`             | If set to `true`, the client will detect credentials in the current URL that could have been sent during an email verification or an Oauth authentication. It will also automatically authenticate all the active tabs in the current browser. |
| `autoRefreshToken`    | boolean                             | `true`             | If set to `true`, the JWT (access token) will be automatically refreshed before it expires.                                                                                                                                                    |
| `clientStorageGetter` | (key:string) => string \| null      | use `localStorage` | Nhost stores a refresh token in `localStorage` so the session can be restored when starting the browser.                                                                                                                                       |
| `clientStorageGetter` | (key: string, value: string \| null | use `localStorage` |                                                                                                                                                                                                                                                |
| `refreshIntervalTime` |                                     |                    |
