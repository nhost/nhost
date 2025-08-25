<h1 align="center">@nhost/react-urql</h1>
<h2 align="center">Nhost - React - URQL</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/react-urql">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/react-urql">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

This package contains a `<NhostUrqlProvider />` with good defaults settings to quickly get started with [Nhost](http://nhost.io/), [React](https://reactjs.org/), and [URQL](https://formidable.com/open-source/urql/).

## Get Started

### Install

`npm install @nhost/react @nhost/react-urql urql graphql`

### Usage

```js
import React from 'react'
import ReactDOM from 'react-dom'
import { NhostClient, NhostProvider } from '@nhost/react'
import { NhostUrqlProvider } from '@nhost/react-urql'

import App from './App'

const nhost = new NhostClient({
  subdomain: '<Your Nhost project subdomain>',
  region: '<Your Nhost project region>'
})

ReactDOM.render(
  <React.StrictMode>
    <NhostProvider nhost={nhost}>
      <NhostUrqlProvider nhost={nhost}>
        <App />
      </NhostUrqlProvider>
    </NhostProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
```

## Customization

This package contains a URQL provider and client for Nhost with good default settings. If you want to customize them, it's recommended to use this code as inspiration and set up your own URQL provider and client in your own code base.
