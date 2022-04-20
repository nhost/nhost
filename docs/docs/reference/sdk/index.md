---
title: 'Overview'
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Nhost SDK is the primary way of interacting with your Nhost app. It exposes a standard interface for each of the following services:

- GraphQL
- Authentication
- Storage
- Functions

## Installation

Install the dependency:

<Tabs>
  <TabItem value="npm" label="npm" default>

```bash
npm install @nhost/nhost-js graphql
```

  </TabItem>
  <TabItem value="yarn" label="Yarn">

```bash
yarn add @nhost/nhost-js graphql
```

  </TabItem>
</Tabs>

Then import and initialize a single `nhost` instance in your code:

```js
import { NhostClient } from '@nhost/nhost-js';

const nhost = new NhostClient({
  backendUrl: '<nhost-backend-url>',
});
```

---

## GraphQL support

While the Nhost SDK comes with a lightweight GraphQL client, you can connect to your Nhost backend with any GraphQL client of your choice. For complex applications, [Apollo Client](https://github.com/apollographql/apollo-client), [React Query](https://github.com/tannerlinsley/react-query) or [URQL](https://github.com/FormidableLabs/urql) might be good options.

---

## Security

The SDK manages refresh tokens automatically to respect the permission rules of your Nhost apps. Requests will be anonymous by default, and when you use the SDK to log a user in, the permissions for that user will be used for GraphQL, storage and cloud function calls.

---

## TypeScript support

The SDK has TypeScript typings included. You don’t have to import types separately.
