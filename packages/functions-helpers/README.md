<h1 align="center">@nhost/functions</h1>
<h2 align="center">Serverless Functions Helpers</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/functions">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/functions">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

- [x] Basic function handler
  - [x] Roles guard
  - [x] Enable CORS for browsers
- [x] Hasura event handler
  - [ ] cli command to add an event handler?
- [ ] Remote schema
  - [ ] With Pothos?
  - [ ] With graphql-yoga?
  - [ ] cli command to add a remote schema?
- [x] Nhost client
- [x] Code generation
- [ ] One-off event scheduler
  - [x] create
  - [x] delete
  - [ ] list?
- [ ] Add tests

## GraphQL Code Generation

The Functions helpers library contains the [react-query](https://github.com/prisma-labs/graphql-request) client. You can automatically generate the SDK from your `.graphql` files.

First, make sure you are running your project locally using the Nhost CLI.

Then create a file called `functions/active-users.graphql`:

```graphql
query activeUsers($active: Boolean!) {
  users(where: { disabled: { _neq: $active } }) {
    id
    displayName
  }
}
```

Run the following command:

```sh
npx functions-codegen
```

It will create a file `functions/_sdk.ts` that you can then use in any function, for instance `functions/active-users.ts`:

```ts
import { GraphQLClient, nhostFunction } from '@nhost/functions-helpers'
import { getSdk } from './_sdk'

const client = new GraphQLClient()
const { activeUsers } = getSdk(client)

export default nhostFunction(async (req, res) => {
  const { users } = await activeUsers()
  res.json(users)
})
```

The `functions-codegen` script accepts the following options:

- `--origin` sets the directory where it will look for the `.graphql` files. It defaults to `functions`.
- `--destination` sets the path of the generated file. It defaults to `<origin>/_sdk.ts`.
- `--watch` watches the changes of the `.graphql` files and updates the generated file accordingly.
