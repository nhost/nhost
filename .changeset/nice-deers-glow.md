---
'@nhost/nhost-js': minor
---

Add `gql` support for GraphQL client
It is now possible to use a `graphql-tag` argument with `nhost.graphql.request`:

```js
import gql from 'graphql-tag'

const QUERY = gql`
  query {
    books {
      id
      title
    }
  }
`

const { data, error } = await nhost.graphql.request(QUERY)
```
