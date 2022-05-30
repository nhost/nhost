<h1 align="center">@nhost/nhost-js</h1>
<h2 align="center">Nhost JavaScript SDK</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/nhost-js">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/nhost-js">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
  <a href="https://prettier.io">
    <img src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg" alt="code style: prettier" />
  </a>
</p>

## Get Started

### Install

```
npm install @nhost/nhost-js
# or yarn
yarn add @nhost/nhost-js
```

### Initialize

```js
import { NhostClient } from '@nhost/nhost-js'

const nhost = new NhostClient({
  backendUrl: 'https://xxx.nhost.run'
})
```

## Features

### GraphQL

Access Nhost GraphQL methods using `nhost.graphql`.

### Authentication

Access Nhost Auth methods using `nhost.auth`.

### Storage

Access Nhost Storage methods using `nhost.storage`.

### Functions

Access Nhost Functions methods via `nhost.functions`.

## Documentation

[https://docs.nhost.io/reference/javascript](https://docs.nhost.io/reference/javascript)
