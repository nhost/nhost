---
title: Graphql
---

This is the main module to interact with Nhost's GraphQL service.
Typically you would use this module via the main [Nhost client](./main#createclient)
but you can also use it directly if you have a specific use case.

# Import

```ts
import { createClient } from '@nhost/nhost-js/graphql'
```

# Usage

The `request` method provides type-safe GraphQL operations with full TypeScript support.
You can leverage generics to type your responses and use GraphQL document nodes for better
integration with third-party libraries.

## Basic Usage

```ts
import { createClient } from '@nhost/nhost-js'

const nhost = createClient({
  subdomain,
  region
})

const resp = await nhost.graphql.request({
  query: `query GetMovies {
          movies {
            id
            title
            director
            genre
          }
        }`
})
```

## Using Variables

You can pass variables to your GraphQL queries and mutations using the `variables` option:

```ts
import { createClient } from '@nhost/nhost-js'

const nhost = createClient({
  subdomain,
  region
})

const resp = await nhost.graphql.request({
  query: `query GetMovies($genre: String!) {
          movies(where: {genre: {_eq: $genre}}) {
            id
            title
            director
            genre
          }
        }`,
  variables: {
    genre: 'Sci-Fi'
  }
})

console.log(resp.body.data?.movies)
// [
//   {
//     id: '3d67a6d0-bfb5-444a-9152-aea543ebd171',
//     title: 'The Matrix',
//     director: 'Lana Wachowski, Lilly Wachowski',
//     genre: 'Sci-Fi'
//   },
//   {
//     id: '90f374db-16c1-4db5-ba55-643bf38953d3',
//     title: 'Inception',
//     director: 'Christopher Nolan',
//     genre: 'Sci-Fi'
//   },
// ]
```

This allows you to dynamically pass values to your queries and mutations, making them more
flexible and reusable.

## Using String Queries with Type Generics

You can type your GraphQL queries and responses using TypeScript generics:

```ts
import { createClient } from '@nhost/nhost-js'

const nhost = createClient({
  subdomain,
  region
})

// This is optional but allows you to type the response
// Tools like Apollo Client or The Guild's GraphQL Code Generator
// can generate these document nodes for you.
interface Movies {
  movies: {
    id: string
    title: string
    director: string
    genre: string
  }[]
}

const resp = await nhost.graphql.request<Movies>({
  query: `query GetMovies {
          movies {
            id
            title
            director
            genre
          }
        }`
})
```

## Using GraphQL Document Nodes

For better integration with third-party libraries like Apollo Client or The Guild's GraphQL
Code Generator, you can use GraphQL document nodes created with `gql` template literal tags:

```ts
import { createClient } from '@nhost/nhost-js'
import gql from 'graphql-tag'

const nhost = createClient({
  subdomain,
  region
})

// This is optional but allows you to type the response
// Tools like Apollo Client or The Guild's GraphQL Code Generator
// can generate these document nodes for you.
interface Movies {
  movies: {
    id: string
    title: string
    director: string
    genre: string
  }[]
}

const getMoviesQuery = gql`
  query GetMovies($genre: String!) {
    movies(where: { genre: { _eq: $genre } }) {
      id
      title
      director
      genre
    }
  }
`

const resp = await nhost.graphql.request<Movies>(getMoviesQuery, {
  genre: 'Sci-Fi'
})
console.log(resp.body.data?.movies)
// [
//   {
//     id: '3d67a6d0-bfb5-444a-9152-aea543ebd171',
//     title: 'The Matrix',
//     director: 'Lana Wachowski, Lilly Wachowski',
//     genre: 'Sci-Fi'
//   },
//   {
//     id: '90f374db-16c1-4db5-ba55-643bf38953d3',
//     title: 'Inception',
//     director: 'Christopher Nolan',
//     genre: 'Sci-Fi'
//   },
// ]
```

Using document nodes enables:

- Better IDE support with syntax highlighting and validation
- Integration with code generation tools
- Compatibility with Apollo Client and other GraphQL libraries

# Error handling

The SDK will throw errors in GraphQL operations that respond with an errors attribute
with length > 0. The error will be an instance of `FetchError<GraphQLResponse>` and will
contain the response body with the errors.

```ts
import { createClient } from '@nhost/nhost-js'
import { FetchError } from '@nhost/nhost-js/fetch'
import type { GraphQLResponse } from '@nhost/nhost-js/graphql'

const nhost = createClient({
  subdomain,
  region
})

try {
  await nhost.graphql.request({
    query: `
        query GetRestrictedObject {
          restrictedObject {
            restrictedField
          }
        }
      `
  })

  expect(true).toBe(false) // This should not be reached
} catch (error) {
  if (!(error instanceof FetchError)) {
    throw error // Re-throw if it's not a FetchError
  }

  const resp = error as FetchError<GraphQLResponse>
  console.log('Error:', JSON.stringify(resp.body, null, 2))
  // Error: {
  //   "body": {
  //     "errors": [
  //       {
  //         "message": "field 'restrictedObject' not found in type: 'query_root'",
  //         "extensions": {
  //           "path": "$.selectionSet.restrictedObject",
  //           "code": "validation-failed"
  //         }
  //       }
  //     ]
  //   },
  //   "status": 200,
  //   "headers": {}
  // }

  // error handling...
}
```

This type extends the standard `Error` type so if you want to just log the error you can
do so like this:

```ts
import { createClient } from '@nhost/nhost-js'
import { FetchError } from '@nhost/nhost-js/fetch'
import type { GraphQLResponse } from '@nhost/nhost-js/graphql'

const nhost = createClient({
  subdomain,
  region
})

try {
  await nhost.graphql.request({
    query: `
        query GetRestrictedObject {
          restrictedObject {
            restrictedField
          }
        }
      `
  })

  expect(true).toBe(false) // This should not be reached
} catch (error) {
  if (!(error instanceof Error)) {
    throw error // Re-throw if it's not an Error
  }

  console.log('Error:', error.message)
  // Error: field 'restrictedObject' not found in type: 'query_root'
}
```

# Interfaces

## Client

GraphQL client interface providing methods for executing queries and mutations

### Properties

#### url

```ts
url: string
```

URL for the GraphQL endpoint.

### Methods

#### pushChainFunction()

```ts
pushChainFunction(chainFunction: ChainFunction): void;
```

Add a middleware function to the fetch chain

##### Parameters

| Parameter       | Type                                      | Description                    |
| --------------- | ----------------------------------------- | ------------------------------ |
| `chainFunction` | [`ChainFunction`](./fetch#chainfunction) | The middleware function to add |

##### Returns

`void`

#### request()

##### Call Signature

```ts
request<TResponseData, TVariables>(request: GraphQLRequest<TVariables>, options?: RequestInit): Promise<FetchResponse<GraphQLResponse<TResponseData>>>;
```

Execute a GraphQL query operation

Queries are used to fetch data and should not modify any data on the server.

##### Type Parameters

| Type Parameter  | Default type                            |
| --------------- | --------------------------------------- |
| `TResponseData` | `unknown`                               |
| `TVariables`    | [`GraphQLVariables`](#graphqlvariables) |

##### Parameters

| Parameter  | Type                                                    | Description                                                    |
| ---------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| `request`  | [`GraphQLRequest`](#graphqlrequest)&lt;`TVariables`&gt; | GraphQL request object containing query and optional variables |
| `options?` | `RequestInit`                                           | Additional fetch options to apply to the request               |

##### Returns

`Promise`&lt;[`FetchResponse`](./fetch#fetchresponse)&lt;[`GraphQLResponse`](#graphqlresponse)&lt;`TResponseData`&gt;&gt;&gt;

Promise with the GraphQL response and metadata

##### Call Signature

```ts
request<TResponseData, TVariables>(
   document: TypedDocumentNode<TResponseData, TVariables>,
   variables?: TVariables,
   options?: RequestInit): Promise<FetchResponse<GraphQLResponse<TResponseData>>>;
```

Execute a GraphQL query operation using a typed document node

##### Type Parameters

| Type Parameter  | Default type                            |
| --------------- | --------------------------------------- |
| `TResponseData` | -                                       |
| `TVariables`    | [`GraphQLVariables`](#graphqlvariables) |

##### Parameters

| Parameter    | Type                                                     | Description                                                 |
| ------------ | -------------------------------------------------------- | ----------------------------------------------------------- |
| `document`   | `TypedDocumentNode`&lt;`TResponseData`, `TVariables`&gt; | TypedDocumentNode containing the query and type information |
| `variables?` | `TVariables`                                             | Variables for the GraphQL operation                         |
| `options?`   | `RequestInit`                                            | Additional fetch options to apply to the request            |

##### Returns

`Promise`&lt;[`FetchResponse`](./fetch#fetchresponse)&lt;[`GraphQLResponse`](#graphqlresponse)&lt;`TResponseData`&gt;&gt;&gt;

Promise with the GraphQL response and metadata

---

## GraphQLError

Represents a GraphQL error returned from the server.

### Properties

#### extensions?

```ts
optional extensions: object;
```

Additional error information specific to the GraphQL implementation

| Name   | Type     |
| ------ | -------- |
| `code` | `string` |
| `path` | `string` |

#### locations?

```ts
optional locations: object[];
```

Source locations in the GraphQL document where the error occurred

| Name     | Type     |
| -------- | -------- |
| `column` | `number` |
| `line`   | `number` |

#### message

```ts
message: string
```

Error message

#### path?

```ts
optional path: string[];
```

Path in the query where the error occurred

---

## GraphQLRequest

GraphQL request object used for queries and mutations.

### Type Parameters

| Type Parameter | Default type                            |
| -------------- | --------------------------------------- |
| `TVariables`   | [`GraphQLVariables`](#graphqlvariables) |

### Properties

#### operationName?

```ts
optional operationName: string;
```

Optional name of the operation to execute

#### query

```ts
query: string
```

The GraphQL query or mutation string

#### variables?

```ts
optional variables: TVariables;
```

Optional variables for parameterized queries

---

## GraphQLResponse

Standard GraphQL response format as defined by the GraphQL specification.

### Type Parameters

| Type Parameter  | Default type |
| --------------- | ------------ |
| `TResponseData` | `unknown`    |

### Properties

#### data?

```ts
optional data: TResponseData;
```

The data returned from successful execution

#### errors?

```ts
optional errors: GraphQLError[];
```

Array of errors if execution was unsuccessful or partially successful

# Type Aliases

## GraphQLVariables

```ts
type GraphQLVariables = Record<string, unknown>
```

Variables object for GraphQL operations.
Key-value pairs of variable names and their values.

# Functions

## createAPIClient()

```ts
function createAPIClient(url: string, chainFunctions: ChainFunction[]): Client
```

Creates a GraphQL API client for interacting with a GraphQL endpoint.

This client provides methods for executing queries and mutations against
a GraphQL API, with support for middleware functions to handle authentication,
error handling, and other cross-cutting concerns.

### Parameters

| Parameter        | Type                                        | Default value | Description                                       |
| ---------------- | ------------------------------------------- | ------------- | ------------------------------------------------- |
| `url`            | `string`                                    | `undefined`   | Base URL for the GraphQL endpoint                 |
| `chainFunctions` | [`ChainFunction`](./fetch#chainfunction)[] | `[]`          | Array of middleware functions for the fetch chain |

### Returns

[`Client`](#client)

GraphQL client with query and mutation methods
