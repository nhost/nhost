---
title: Getting started
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
