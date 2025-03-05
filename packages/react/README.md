# Nhost React

The Nhost React client exports a React provider, hooks, and helpers that make it easier to work with Nhost in your React app. If you're using React with Next.js, you should use the [Nhost Next.js client](/reference/nextjs).

## Documentation

- [Quickstart](https://docs.nhost.io/platform/quickstarts/react)
- [Reference documentation](https://docs.nhost.io/reference/react)

## Install

Install the Nhost React client together with GraphQL:

```bash
# With npm
npm install @nhost/react graphql

# With Yarm
yarn add @nhost/react graphql
```

## Initialise

Initialize a single `nhost` instance and wrap your app with the `NhostReactProvider`.

```jsx title=src/App.tsx
import React from 'react'
import ReactDOM from 'react-dom'

import { NhostClient, NhostProvider } from '@nhost/react'

import App from './App'

const nhost = new NhostClient({
  subdomain: '<Your Nhost app subdomain>',
  region: '<Your Nhost app region>'
})

ReactDOM.render(
  <React.StrictMode>
    <NhostProvider nhost={nhost}>
      <App />
    </NhostProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
```
