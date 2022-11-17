## To-do list

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

## Notes on specific dossiers

### Code generation

To be able to use the generated `graphql-request` operations, we should use a compatible, external client:

```ts
import { GraphQLClient, nhostFunction } from '@nhost/functions-helpers'
import { getSdk } from './_sdk'

const client = new GraphQLClient()
const { activeUsers } = getSdk(client)
```

We could make `nhost.graphql` compatible with `graphql-request` so we could write:

```ts
import { NhostClient } from '@nhost/functions-helpers'
import { getSdk } from './_sdk'

const nhost = new NhostClient()
const { activeUsers } = getSdk(nhost.graphql)
```

The problem is both `nhost.graphql` and `graphql-request` expose a `request` method. They slightly differ.
