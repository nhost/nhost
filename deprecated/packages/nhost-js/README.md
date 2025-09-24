<h1 align="center">@nhost/nhost-js</h1>
<h2 align="center">Nhost JavaScript SDK</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/nhost-js">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/nhost-js">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

## Documentation

[Reference documentation](https://docs.nhost.io/reference/javascript)

## Install

```
npm install @nhost/nhost-js

# or yarn
yarn add @nhost/nhost-js
```

### Initialise

```js
import { NhostClient } from '@nhost/nhost-js'

const nhost = new NhostClient({
  subdomain: '<Your Nhost project subdomain>',
  region: '<Your Nhost project region>'
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
