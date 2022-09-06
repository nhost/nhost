<h1 align="center">@nhost/react-apollo</h1>
<h2 align="center">For easy usage of Apollo and React</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/react-apollo">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/react-apollo">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

## Documentation

[Reference documentation](https://docs.nhost.io/reference/react/apollo)

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
  subdomain: '<Your Nhost project subdomain>',
  region: '<Your Nhost project region>'
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
