<h1 align="center">@nhost/graphql-js</h1>
<h2 align="center">Nhost GraphQL client</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/graphql-js">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/graphql-js">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

Nhost GraphQL client.

## Install

First, install `graphql-codegen` and the Nhost Typescript plugin:

```sh
yarn add @nhost/graphql-js graphql
yarn add -D @graphql-codegen/cli @graphql-codegen/typescript-nhost
```

Make sure strict null checks are enabled in `tsconfig.json`:

```json filename="tsconfig.json"
{
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

## Configure the code generator

Configure the code generator by adding a `codegen.yaml` file:

```yaml filename="codegen.yaml"
schema:
  - http://localhost:1337/v1/graphql:
      headers:
        x-hasura-admin-secret: nhost-admin-secret
generates:
  ./src/schema.ts:
    plugins:
      - typescript-nhost
```

Add the codegen script to `package.json`:

```json filename="package.json"
{
  "scripts": {
    "codegen": "graphql-codegen"
  }
}
```

Generate the schema:

```sh
yarn run codegen
```

## Usage

```ts filename="./src/main.ts"
import { NhostGraphqlClient } from '@nhost/graphql-js'
import schema from './schema'

const client = new NhostGraphqlClient({ url: 'http://localhost:1337/v1/graphql', schema })
```

### Basic GraphQL requests

### Queries

```ts
const todos = await client.query.todos({
  select: { createdAt: true, contents: true, user: { select: { displayName: true } } }
})

todos.map(({ createdAt, contents, user: { displayName } }) => {
  console.log(`${displayName} created the following todo at ${createdAt}: ${contents}`)
})
```

Select all scalar fields:

```ts
const todos = await client.query.todos()

todos.map(({ createdAt, contents }) => {
  console.log(`Todo created at ${createdAt}: ${contents}`)
})
```

Pass on parameters:

```ts
const todos = await client.query.todos({
  variables: { where: { contents: { _eq: 'document the sdk' } } },
  select: { createdAt: true, contents: true, user: { select: { displayName: true } } }
})

todos.map(({ createdAt, contents }) => {
  console.log(`${displayName} created the following todo at ${createdAt}: ${contents}`)
})
```

### Mutations

```ts
const { id } = await client.mutation.insertTodo({
  select: { id: true },
  variables: { contents: 'document the sdk', userId: 'xxx-yyy-zzz' }
})
```

### Enums

```ts
const todos = await client.query.todos({
  variables: {
    where: {
      category: { _eq: 'essay' } // the client detects 'essay' is a GraphQL enum value
    }
  },
  contents: true,
  category: true
})
```

### Unions

```ts
const giraffes = await client.query
  .giraffeFacts({
    _on: {
      GiraffeNumericFact: { value: true },
      GiraffeStringFact: { fact: true }
    }
  })
  .run()

giraffes.forEach((giraffe) => {
  if (giraffe.__typename === 'GiraffeNumericFact') {
    // * We are in the GiraffeNumericFact fragment: only `value` is available
    console.log('Value:', giraffe.value)
  } else {
    // * We are in the GiraffeStringFact fragment: only `fact` is available
    console.log('Fact:', giraffe.fact)
  }
})
```

### Interfaces

## Documentation

[https://docs.nhost.io/reference/javascript/graphql](https://docs.nhost.io/reference/javascript/graphql)
