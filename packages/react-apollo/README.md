# Nhost React Apollo

For easy usage of Apollo and React with [Nhost](https://nhost.io).

## Install

`$ npm install @nhost/react-apollo @apollo/client graphql react react-dom`

or

`$ yarn add @nhost/react-apollo @apollo/client graphql react react-dom`

## Usage

```js
import React from 'react'
import ReactDOM from 'react-dom'
import { NhostClient, NhostApolloProvider } from '@nhost/react-apollo'
import { NhostProvider } from '@nhost/react'

import App from './App'

const nhost = new NhostClient({
  backendUrl: 'https://[app-subdomain].nhost.run'
})

ReactDOM.render(
  <React.StrictMode>
    <NhostProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <App />
      </NhostApolloProvider>
    </NhostProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
```

## Documentation

[https://docs.nhost.io/reference/supporting-libraries/react-apollo](https://docs.nhost.io/reference/supporting-libraries/react-apollo)
