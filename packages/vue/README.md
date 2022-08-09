# Nhost Vue

The Nhost Vue client exports a Nhost client that can be installed as a [Vue plugin](https://vuejs.org/guide/reusability/plugins.html), and [composables](https://vuejs.org/guide/reusability/composables.html) that make it easier to work with Nhost in your Vue app.

## Documentation

- [Quickstart](https://docs.nhost.io/platform/quickstarts/vue)
- [Reference documentation](https://docs.nhost.io/reference/vue)

## Installation

Install the Nhost Vue client together with GraphQL:

```bash
# With npm
npm install @nhost/vue graphql

# With Yarn
yarn add @nhost/vue graphql

```

## Initializing

Initialize a single `nhost` instance, and install it as a plugin in your Vue app.

```js title=src/main.js
import { createApp } from 'vue'
import { NhostClient } from '@nhost/vue'

import App from './App.vue'

const nhost = new NhostClient({
  subdomain: '<Your Nhost project subdomain>',
  region: '<Your Nhost project region>'
})

createApp(App).use(nhost).mount('#app')
```
