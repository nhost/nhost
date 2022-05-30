# Nhost React Apollo

For easy usage of Apollo and React with [Nhost](https://nhost.io).

## Install

`$ npm install @nhost/react-apollo @nhost/react @apollo/client graphql react react-dom`

or

`$ yarn add @nhost/react-apollo @nhost/react @apollo/client graphql react react-dom`

## Usage

```js
import React from 'react'
import ReactDOM from 'react-dom'
import { NhostClient, NhostReactProvider } from '@nhost/react'
import { NhostApolloProvider } from '@nhost/react-apollo'

import App from './App'

const nhost = new NhostClient({
  backendUrl: 'https://[app-subdomain].nhost.run'
})

ReactDOM.render(
  <React.StrictMode>
    <NhostReactProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <App />
      </NhostApolloProvider>
    </NhostReactProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
```

## Documentation

[https://docs.nhost.io/reference/react/apollo](https://docs.nhost.io/reference/react/apollo)
