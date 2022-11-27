<h1 align="center">@nhost/react-urql</h1>
<h2 align="center">Nhost React URQL client</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/react-urql">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/react-urql">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

## Documentation

[Reference documentation](https://docs.nhost.io/reference/react/urql)

## Install

`$ npm install @nhost/react-urql urql graphql`

or

`$ yarn add @nhost/react-urql urql graphql`

## Usage

```js
import React from 'react'
import ReactDOM from 'react-dom'
import { NhostClient, NhostReactProvider } from '@nhost/react'
import { NhostUrqlProvider } from '@nhost/react-urql'

import App from './App'

const nhost = new NhostClient({
  subdomain: '<Your Nhost project subdomain>',
  region: '<Your Nhost project region>'
})

ReactDOM.render(
  <React.StrictMode>
    <NhostReactProvider nhost={nhost}>
      <NhostUrqlProvider nhost={nhost}>
        <App />
      </NhostUrqlProvider>
    </NhostReactProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
```
