<h1 align="center">@nhost/functions</h1>
<h2 align="center">Serverless Functions Helpers</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/functions">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/functions">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

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

## Hasura Event Triggers

Hasura Event triggers can be configured to call a Nhost function. See the [Nhost documentation](https://docs.nhost.io/database/event-triggers) for further information.

The `eventFunction` helper adds types to the Hasura payload:

```ts
import { eventFunction } from '@nhost/functions-helpers'

export default eventFunction<ColumnValues>((req) => {
  console.log(req.body.created_at)
  console.log(req.body.table.name, req.body.table.schema)
  console.log(req.body.event.data.new)
  console.log(req.body.event.data.old)
})
```

You can improve the types by specifying the columns of the table:

```ts
import { eventFunction } from '@nhost/functions-helpers'

type ColumnValues = {
  name: string
}

export default eventFunction<ColumnValues>((req) => {
  console.log(req.body.event.data.new?.name)
  console.log(req.body.event.data.old?.name)
})
```

It is also possible to specify the event type:

```ts
export default eventFunction<ColumnValues>('INSERT', (req) => {
  console.log(req.body.event.data.new) // is typed as ColumnValues
  console.log(req.body.event.data.old) // is typed as null as it is an INSERT
})
```

If the handler is successfully executed, the function will return a `200` HTTP status code with:

```json
{
  "success": true
}
```

If an exception is thrown, it will return:

```json
{
  "success": false,
  "message": "error message"
}
```

If the thrown exception is an Express error, it will use its code as HTTP status code. It will use `500` otherwise.

It is still possible to determine another outcome to the handler:

```ts
export default eventFunction<ColumnValues>((req, res) => {
  res.status(501).json({ reason: 'not implemented' })
})
```
