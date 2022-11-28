---
'@nhost/nhost-js': minor
---

Use the `graphql-request` client at `nhost.graphql`

`nhost.graphql` is now a fully-configured [graphql-request](https://github.com/prisma-labs/graphql-request) client.
It adds the following features:

- better Typescript integration
- ability to use the client with the [GraphQL Code Generator](https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-graphql-request)
- batch requests with `nhost.graphql.batchRequests()`

### Breaking changes

Before:

```js
const { data, error } = await nhost.graphql.request('{ myQuery { id } }')
```

After:

```js
try {
  const data = await nhost.graphql.request('{ myQuery { id } }')
} catch (error) {
  console.log(error)
}
```

#### Custom headers

Before:

```js
await nhost.graphql.request(
  '{ myQuery { id } }',
  {},
  {
    headers: {
      'x-hasura-admin-secret': 'nhost-admin-secret'
    }
  }
)
```

After:

```js
await nhost.graphql.request(
  '{ myQuery { id } }',
  {},
  {
    'x-hasura-admin-secret': 'nhost-admin-secret'
  }
)
```
